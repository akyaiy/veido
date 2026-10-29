package hooks_test

import (
	"github.com/akyaiy/veido/pkg/vfs"
	"github.com/akyaiy/veido/pkg/vfs/hooks"
	"github.com/akyaiy/veido/pkg/vfs/hooksdk"
	"context"
	"encoding/json"
	"errors"
	"os"
	"sync"
	"testing"
	"time"
)

type vfsCall struct {
	operation string
	actor     vfs.Actor
	uri       vfs.URI
}

type recordingFrontend struct {
	mu    sync.Mutex
	calls []vfsCall
}

func (f *recordingFrontend) record(operation string, actor vfs.Actor, uri vfs.URI) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, vfsCall{operation: operation, actor: actor, uri: uri})
}
func (f *recordingFrontend) snapshot() []vfsCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]vfsCall(nil), f.calls...)
}
func (f *recordingFrontend) Stat(_ context.Context, actor vfs.Actor, uri vfs.URI) (*vfs.Node, error) {
	f.record("stat", actor, uri)
	return &vfs.Node{Name: "resource"}, nil
}
func (f *recordingFrontend) ReadDir(_ context.Context, actor vfs.Actor, uri vfs.URI) ([]*vfs.Node, error) {
	f.record("read_dir", actor, uri)
	return nil, nil
}
func (f *recordingFrontend) OpenFile(_ context.Context, actor vfs.Actor, uri vfs.URI, _ int) (vfs.File, error) {
	f.record("open_file", actor, uri)
	return nil, os.ErrPermission
}
func (f *recordingFrontend) Mkdir(_ context.Context, actor vfs.Actor, uri vfs.URI) (*vfs.Node, error) {
	f.record("mkdir", actor, uri)
	return &vfs.Node{Name: "directory", IsDir: true}, nil
}
func (f *recordingFrontend) Move(_ context.Context, actor vfs.Actor, source, _ vfs.URI) error {
	f.record("move", actor, source)
	return nil
}
func (f *recordingFrontend) Delete(_ context.Context, actor vfs.Actor, uri vfs.URI) error {
	f.record("delete", actor, uri)
	return nil
}
func (f *recordingFrontend) Control(_ context.Context, actor vfs.Actor, uri vfs.URI, _ string, _ []byte) ([]byte, error) {
	f.record("control", actor, uri)
	return []byte(`{"ok":true}`), nil
}

type inspectInput struct {
	FirstURI  string `json:"first_uri"`
	SecondURI string `json:"second_uri"`
}
type inspectOutput struct {
	Visited int `json:"visited"`
}

func TestRuntimeUsesSameActorForEveryVFSOperationAndCachesIdempotentResult(t *testing.T) {
	frontend := &recordingFrontend{}
	registry := hooks.NewRegistry(hooks.DefaultEngines())
	definition := hooksdk.Native("inspect", 1, hooksdk.NativeOptions{Enabled: true, Active: true}, func(ctx context.Context, execution hooks.Execution, input inspectInput) (inspectOutput, error) {
		first := mustURI(t, input.FirstURI)
		second := mustURI(t, input.SecondURI)
		if _, err := execution.VFS.Stat(ctx, first); err != nil {
			return inspectOutput{}, hooks.FailStep("stat-first", err)
		}
		if _, err := execution.VFS.Control(ctx, second, "inspect", nil); err != nil {
			return inspectOutput{}, hooks.FailStep("control-second", err)
		}
		return inspectOutput{Visited: 2}, nil
	})
	if err := registry.Register(definition); err != nil {
		t.Fatal(err)
	}
	if err := registry.Freeze(context.Background()); err != nil {
		t.Fatal(err)
	}
	runtime, err := hooks.NewRuntime(registry, frontend, hooks.NewMemoryExecutionStore())
	if err != nil {
		t.Fatal(err)
	}
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}
	input := json.RawMessage(`{"first_uri":"demo@files[site]:///one","second_uri":"demo@files[site]:///two"}`)
	first, err := runtime.Run(context.Background(), actor, "inspect", input, hooks.RunOptions{IdempotencyKey: "request-1"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := runtime.Run(context.Background(), actor, "inspect", json.RawMessage(`{ "second_uri":"demo@files[site]:///two", "first_uri":"demo@files[site]:///one" }`), hooks.RunOptions{IdempotencyKey: "request-1"})
	if err != nil {
		t.Fatal(err)
	}
	if first.ExecutionID != second.ExecutionID || first.Status != "completed" {
		t.Fatalf("idempotent results = %+v %+v", first, second)
	}
	calls := frontend.snapshot()
	if len(calls) != 2 {
		t.Fatalf("VFS calls = %+v, want exactly two", calls)
	}
	for _, call := range calls {
		if call.actor != actor {
			t.Fatalf("VFS actor = %+v, want %+v", call.actor, actor)
		}
	}

	_, err = runtime.Run(context.Background(), actor, "inspect", json.RawMessage(`{"first_uri":"demo@files[site]:///different","second_uri":"demo@files[site]:///two"}`), hooks.RunOptions{IdempotencyKey: "request-1"})
	var runErr *hooks.RunError
	if !errors.As(err, &runErr) || runErr.Code != "idempotency_conflict" {
		t.Fatalf("idempotency conflict = %#v, %v", runErr, err)
	}
}

func TestRuntimePreservesSafeVFSFailureMessage(t *testing.T) {
	registry := hooks.NewRegistry(hooks.DefaultEngines())
	definition := hooksdk.Native("safe-failure", 1, hooksdk.NativeOptions{Enabled: true, Active: true}, func(context.Context, hooks.Execution, struct{}) (struct{}, error) {
		return struct{}{}, vfs.NewError(vfs.KindConflict, vfs.OpControl, "user already exists", errors.New("sqlite constraint detail"))
	})
	if err := registry.Register(definition); err != nil {
		t.Fatal(err)
	}
	if err := registry.Freeze(context.Background()); err != nil {
		t.Fatal(err)
	}
	runtime, err := hooks.NewRuntime(registry, &recordingFrontend{}, hooks.NewMemoryExecutionStore())
	if err != nil {
		t.Fatal(err)
	}
	_, err = runtime.Run(context.Background(), vfs.Actor{Kind: vfs.ActorGuest}, "safe-failure", json.RawMessage(`{}`), hooks.RunOptions{})
	var runErr *hooks.RunError
	if !errors.As(err, &runErr) || runErr.Cause != "conflict" || runErr.Message != "user already exists" {
		t.Fatalf("run error = %#v, %v", runErr, err)
	}
}

func TestRuntimeEnforcesStepAndTimeoutLimits(t *testing.T) {
	registry := hooks.NewRegistry(hooks.DefaultEngines())
	stepLimited := hooksdk.Native("step-limited", 1, hooksdk.NativeOptions{Enabled: true, Active: true, Limits: hooks.Limits{MaxSteps: 1}}, func(ctx context.Context, execution hooks.Execution, _ struct{}) (struct{}, error) {
		uri := mustURI(t, "demo@files[site]:///one")
		if _, err := execution.VFS.Stat(ctx, uri); err != nil {
			return struct{}{}, err
		}
		_, err := execution.VFS.Stat(ctx, uri)
		return struct{}{}, hooks.FailStep("second-stat", err)
	})
	timed := hooksdk.Native("timed", 1, hooksdk.NativeOptions{Enabled: true, Active: true, Limits: hooks.Limits{Timeout: 20 * time.Millisecond}}, func(ctx context.Context, _ hooks.Execution, _ struct{}) (struct{}, error) {
		<-ctx.Done()
		return struct{}{}, ctx.Err()
	})
	if err := registry.Register(stepLimited); err != nil {
		t.Fatal(err)
	}
	if err := registry.Register(timed); err != nil {
		t.Fatal(err)
	}
	if err := registry.Freeze(context.Background()); err != nil {
		t.Fatal(err)
	}
	runtime, err := hooks.NewRuntime(registry, &recordingFrontend{}, hooks.NewMemoryExecutionStore())
	if err != nil {
		t.Fatal(err)
	}
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}
	_, err = runtime.Run(context.Background(), actor, "step-limited", json.RawMessage(`{}`), hooks.RunOptions{})
	var stepErr *hooks.RunError
	if !errors.As(err, &stepErr) || stepErr.Cause != "resource_exhausted" || stepErr.FailedStep != "second-stat" {
		t.Fatalf("step limit error = %#v, %v", stepErr, err)
	}
	_, err = runtime.Run(context.Background(), actor, "timed", json.RawMessage(`{}`), hooks.RunOptions{})
	var timeoutErr *hooks.RunError
	if !errors.As(err, &timeoutErr) || timeoutErr.Cause != "deadline_exceeded" || !timeoutErr.Retryable {
		t.Fatalf("timeout error = %#v, %v", timeoutErr, err)
	}
}

func TestRegistryRejectsDuplicatesMissingEnginesAndMutationAfterFreeze(t *testing.T) {
	definition := hooksdk.Native("inspect", 1, hooksdk.NativeOptions{Enabled: true, Active: true}, func(context.Context, hooks.Execution, struct{}) (struct{}, error) { return struct{}{}, nil })
	registry := hooks.NewRegistry(hooks.DefaultEngines())
	if err := registry.Register(definition); err != nil {
		t.Fatal(err)
	}
	if err := registry.Register(definition); !errors.Is(err, hooks.ErrDuplicateDefinition) {
		t.Fatalf("duplicate error = %v", err)
	}
	if err := registry.Freeze(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := registry.Register(hooksdk.Native("other", 1, hooksdk.NativeOptions{Enabled: true, Active: true}, func(context.Context, hooks.Execution, struct{}) (struct{}, error) { return struct{}{}, nil })); !errors.Is(err, hooks.ErrRegistryFrozen) {
		t.Fatalf("frozen registry error = %v", err)
	}

	missing := hooks.NewRegistry(nil)
	if err := missing.Register(definition); err != nil {
		t.Fatal(err)
	}
	if err := missing.Freeze(context.Background()); !errors.Is(err, hooks.ErrEngineNotFound) {
		t.Fatalf("missing engine error = %v", err)
	}
}

func mustURI(t *testing.T, raw string) vfs.URI {
	t.Helper()
	uri, err := vfs.ParseURI(raw)
	if err != nil {
		t.Fatal(err)
	}
	return uri
}
