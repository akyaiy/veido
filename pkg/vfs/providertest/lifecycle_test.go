package providertest_test

import (
	"github.com/akyaiy/veido/pkg/vfs"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"github.com/akyaiy/veido/pkg/vfs/providertest"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"testing"
)

type stagedBackend struct {
	data       []byte
	exists     bool
	failCommit bool
}

func (b *stagedBackend) Stat(ctx context.Context, path string) (*vfs.Node, error) {
	if path == "/" {
		return sdk.DirNode("/"), nil
	}
	if !b.exists {
		return nil, os.ErrNotExist
	}
	return sdk.FileNode("file", int64(len(b.data))), nil
}
func (b *stagedBackend) ReadDir(context.Context, string) ([]*vfs.Node, error) { return nil, nil }
func (b *stagedBackend) OpenRead(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(b.data)), nil
}
func (b *stagedBackend) OpenWrite(ctx context.Context, path string, flags int) (vfs.File, error) {
	if flags&os.O_EXCL != 0 && b.exists {
		return nil, os.ErrExist
	}
	var buffer bytes.Buffer
	return sdk.WriteFile(ctx, sdk.FileNode("file", 0), &buffer, func() error {
		if b.failCommit {
			return vfs.ErrUnavailable
		}
		b.data = append([]byte(nil), buffer.Bytes()...)
		b.exists = true
		return nil
	}, func() error { buffer.Reset(); return nil }), nil
}

type events struct {
	prepared, created, aborted, recovered int
	err                                   error
}

func (e *events) Prepare(_ context.Context, mutation vfs.LifecycleMutation) (vfs.LifecycleOperation, error) {
	if mutation.OperationID == "" || mutation.Kind != vfs.LifecycleCreate {
		return nil, errors.New("invalid lifecycle mutation")
	}
	e.prepared++
	return eventOperation{events: e}, nil
}
func (*events) Recover(context.Context) error { return nil }

type eventOperation struct{ events *events }

func (o eventOperation) Commit(context.Context) error {
	o.events.created++
	return o.events.err
}
func (o eventOperation) Abort(context.Context, error) error { o.events.aborted++; return nil }
func (o eventOperation) Recover(context.Context, error) error {
	o.events.recovered++
	return nil
}

func TestCreatedEventFollowsSuccessfulCommit(t *testing.T) {
	for _, scenario := range []string{"success", "abort", "commit failure", "event failure"} {
		t.Run(scenario, func(t *testing.T) {
			backend := &stagedBackend{failCommit: scenario == "commit failure"}
			sink := &events{}
			if scenario == "event failure" {
				sink.err = vfs.ErrUnavailable
			}
			h, err := providertest.New(context.Background(), func(context.Context, vfs.ProviderConnection) (vfs.FSProvider, error) {
				return sdk.FromBackend(backend), nil
			}, providertest.Options{Lifecycle: sink})
			if err != nil {
				t.Fatal(err)
			}
			defer h.Close()
			file, err := h.Frontend.OpenFile(context.Background(), h.Actor, h.URI("/file"), os.O_CREATE|os.O_EXCL|os.O_WRONLY)
			if err != nil {
				t.Fatal(err)
			}
			if sink.prepared != 1 || sink.created != 0 {
				t.Fatal("lifecycle was not prepared before content was committed")
			}
			_, err = file.Write([]byte("content"))
			if err != nil {
				t.Fatal(err)
			}
			if scenario == "abort" {
				err = vfs.FinishWrite(file, io.ErrUnexpectedEOF)
				if !errors.Is(err, io.ErrUnexpectedEOF) {
					t.Fatal(err)
				}
			} else {
				err = vfs.FinishWrite(file, nil)
			}
			_ = file.Close()
			_ = file.Close()
			want := 1
			if scenario == "abort" || scenario == "commit failure" {
				want = 0
			}
			if sink.created != want || backend.exists != (want == 1) {
				t.Fatalf("events=%d exists=%v", sink.created, backend.exists)
			}
			if scenario == "abort" && sink.aborted != 1 {
				t.Fatalf("aborted=%d, want 1", sink.aborted)
			}
			if (scenario == "commit failure" || scenario == "event failure") && sink.recovered != 1 {
				t.Fatalf("recovered=%d, want 1", sink.recovered)
			}
			if scenario == "commit failure" || scenario == "event failure" {
				if !errors.Is(err, vfs.ErrUnavailable) {
					t.Fatalf("lost completion error: %v", err)
				}
			}
			if scenario == "success" {
				file, err = h.Frontend.OpenFile(context.Background(), h.Actor, h.URI("/file"), os.O_CREATE|os.O_TRUNC|os.O_WRONLY)
				if err != nil {
					t.Fatal(err)
				}
				if err = vfs.FinishWrite(file, nil); err != nil {
					t.Fatal(err)
				}
				if sink.created != 1 {
					t.Fatal("replacement emitted a second created event")
				}
			}
		})
	}
}
