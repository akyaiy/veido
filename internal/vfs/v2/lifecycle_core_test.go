package v2

import (
	"MyServer/internal/common"
	"context"
	"errors"
	"os"
	"testing"
)

type lifecycleTestOperation struct {
	sink *lifecycleTestSink
}

func (o lifecycleTestOperation) Commit(context.Context) error {
	o.sink.committed++
	return o.sink.commitErr
}
func (o lifecycleTestOperation) Abort(context.Context, error) error { o.sink.aborted++; return nil }
func (o lifecycleTestOperation) Recover(context.Context, error) error {
	o.sink.recovered++
	return nil
}

type lifecycleTestSink struct {
	mutations []LifecycleMutation
	committed int
	aborted   int
	recovered int
	commitErr error
}

func (s *lifecycleTestSink) Prepare(_ context.Context, mutation LifecycleMutation) (LifecycleOperation, error) {
	s.mutations = append(s.mutations, mutation)
	return lifecycleTestOperation{sink: s}, nil
}
func (*lifecycleTestSink) Recover(context.Context) error { return nil }

type lifecycleTestProvider struct {
	mutation                     LifecycleMutation
	mkdirErr, moveErr, deleteErr error
}

func (*lifecycleTestProvider) Stat(context.Context, string) (*Node, error) {
	return nil, os.ErrNotExist
}
func (*lifecycleTestProvider) ReadDir(context.Context, string) ([]*Node, error) {
	return nil, os.ErrNotExist
}
func (*lifecycleTestProvider) OpenFile(context.Context, string, int) (File, error) {
	return nil, os.ErrNotExist
}
func (p *lifecycleTestProvider) capture(ctx context.Context) {
	p.mutation, _ = LifecycleMutationFromContext(ctx)
}
func (p *lifecycleTestProvider) Mkdir(ctx context.Context, _ string, _ string) (*Node, error) {
	p.capture(ctx)
	if p.mkdirErr != nil {
		return nil, p.mkdirErr
	}
	return &Node{Name: "node", IsDir: true}, nil
}
func (p *lifecycleTestProvider) Move(ctx context.Context, _ string, _ string, _ string) error {
	p.capture(ctx)
	return p.moveErr
}
func (p *lifecycleTestProvider) Delete(ctx context.Context, _ string) error {
	p.capture(ctx)
	return p.deleteErr
}
func (*lifecycleTestProvider) Control(context.Context, string, string, []byte) ([]byte, error) {
	return nil, os.ErrPermission
}

type lifecycleTestPool struct{ provider FSProvider }

func (p lifecycleTestPool) Get(context.Context, ProviderConnection) (FSProvider, error) {
	return p.provider, nil
}
func (lifecycleTestPool) Invalidate(ProviderConnection) {}

func newLifecycleTestCore(sink ResourceLifecycleSink, provider FSProvider) (*VFSCore, Actor, func(string) common.CanonURI) {
	connection := ProviderConnection{ScopeKey: "alice", ProviderKey: "local", ConnectionKey: "default"}
	core := &VFSCore{
		scopeResolver:      &scopeGateTestResolver{scope: Scope{Key: "alice"}},
		connectionResolver: &scopeGateTestConnectionResolver{connection: connection},
		authorizer: &scopeGateTestAuthorizer{can: func(common.Action, common.ResourceRef) (bool, error) {
			return true, nil
		}},
		providerPool: lifecycleTestPool{provider: provider},
		lifecycle:    sink,
	}
	uri := func(path string) common.CanonURI {
		value, err := (common.ResourceAddress{ProviderKey: "local", ConnectionKey: "default", ScopeKey: "alice", Path: path}).URI()
		if err != nil {
			panic(err)
		}
		return value
	}
	return core, Actor{Kind: ActorUser, ID: "1"}, uri
}

func TestCorePreparesAndCommitsLifecycleMutations(t *testing.T) {
	cases := []struct {
		name string
		kind LifecycleKind
		run  func(*VFSCore, Actor, func(string) common.CanonURI) error
	}{
		{"mkdir", LifecycleCreate, func(c *VFSCore, a Actor, uri func(string) common.CanonURI) error {
			_, err := c.Mkdir(context.Background(), a, uri("/docs"))
			return err
		}},
		{"move", LifecycleMove, func(c *VFSCore, a Actor, uri func(string) common.CanonURI) error {
			return c.Move(context.Background(), a, uri("/from"), uri("/to"))
		}},
		{"delete", LifecycleDelete, func(c *VFSCore, a Actor, uri func(string) common.CanonURI) error {
			return c.Delete(context.Background(), a, uri("/docs"))
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sink := &lifecycleTestSink{}
			provider := &lifecycleTestProvider{}
			core, actor, uri := newLifecycleTestCore(sink, provider)
			if err := tc.run(core, actor, uri); err != nil {
				t.Fatal(err)
			}
			if len(sink.mutations) != 1 || sink.mutations[0].Kind != tc.kind || sink.mutations[0].OperationID == "" {
				t.Fatalf("mutations = %+v", sink.mutations)
			}
			if sink.committed != 1 || sink.aborted != 0 || sink.recovered != 0 {
				t.Fatalf("commit=%d abort=%d recover=%d", sink.committed, sink.aborted, sink.recovered)
			}
			if provider.mutation.OperationID != sink.mutations[0].OperationID {
				t.Fatalf("provider operation = %q, want %q", provider.mutation.OperationID, sink.mutations[0].OperationID)
			}
		})
	}
}

func TestCoreRecoversAfterLifecycleCommitFailure(t *testing.T) {
	commitErr := errors.New("acl journal unavailable")
	sink := &lifecycleTestSink{commitErr: commitErr}
	core, actor, uri := newLifecycleTestCore(sink, &lifecycleTestProvider{})
	_, err := core.Mkdir(context.Background(), actor, uri("/docs"))
	if !errors.Is(err, commitErr) || sink.recovered != 1 {
		t.Fatalf("Mkdir() err=%v recover=%d", err, sink.recovered)
	}
}

func TestCoreAbortsLifecycleWhenProviderRejectsMutation(t *testing.T) {
	cases := []struct {
		name string
		run  func(*VFSCore, Actor, func(string) common.CanonURI) error
	}{
		{"mkdir", func(c *VFSCore, a Actor, uri func(string) common.CanonURI) error {
			_, err := c.Mkdir(context.Background(), a, uri("/docs"))
			return err
		}},
		{"move", func(c *VFSCore, a Actor, uri func(string) common.CanonURI) error {
			return c.Move(context.Background(), a, uri("/from"), uri("/to"))
		}},
		{"delete", func(c *VFSCore, a Actor, uri func(string) common.CanonURI) error {
			return c.Delete(context.Background(), a, uri("/docs"))
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			provider := &lifecycleTestProvider{mkdirErr: errors.New("provider rejected"), moveErr: errors.New("provider rejected"), deleteErr: errors.New("provider rejected")}
			sink := &lifecycleTestSink{}
			core, actor, uri := newLifecycleTestCore(sink, provider)
			if err := tc.run(core, actor, uri); err == nil {
				t.Fatal("mutation unexpectedly succeeded")
			}
			if sink.committed != 0 || sink.aborted != 1 || sink.recovered != 0 {
				t.Fatalf("commit=%d abort=%d recover=%d", sink.committed, sink.aborted, sink.recovered)
			}
		})
	}
}
