package providersdk_test

import (
	"MyServer/pkg/vfs"
	sdk "MyServer/pkg/vfs/providersdk"
	"MyServer/pkg/vfs/providertest"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
)

type item struct {
	Key   string `json:"key"`
	Actor string `json:"actor"`
}

func fixture(t *testing.T) (*sdk.Provider, *atomic.Int32) {
	t.Helper()
	tree := sdk.New()
	calls := new(atomic.Int32)
	items := sdk.Collection(tree.Root(), "items", "id", sdk.CollectionSpec[sdk.Unit, item]{
		List: func(context.Context, sdk.Request, sdk.Unit) ([]item, error) { return []item{{Key: "one"}}, nil },
		Lookup: func(ctx context.Context, req sdk.Request, _ sdk.Unit, key string) (item, error) {
			calls.Add(1)
			if key != "one" {
				return item{}, os.ErrNotExist
			}
			actor, err := sdk.Actor(ctx)
			return item{key, actor.ID}, err
		},
		Node: func(i item) *vfs.Node { n := sdk.DirNode(i.Key); n.Kind = "item"; return n },
	})
	sdk.JSON(items, "a.json", func(ctx context.Context, req sdk.Request, i item) (item, error) { return i, nil })
	sdk.JSON(items, "b.json", func(ctx context.Context, req sdk.Request, i item) (item, error) { return i, nil })
	sdk.Directory(items, "details")
	sdk.JSON(tree.Root(), "hidden.json", func(context.Context, sdk.Request, sdk.Unit) (bool, error) { return true, nil }).Hidden()
	p, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	return p, calls
}
func harness(t *testing.T, p vfs.FSProvider, options providertest.Options) *providertest.Harness {
	t.Helper()
	h, err := providertest.New(context.Background(), func(context.Context, vfs.ProviderConnection) (vfs.FSProvider, error) { return p, nil }, options)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = h.Close() })
	return h
}

func TestCollectionTreeAndRequestIsolation(t *testing.T) {
	p, calls := fixture(t)
	h := harness(t, p, providertest.Options{})
	ctx := context.Background()
	nodes, err := h.Frontend.ReadDir(ctx, h.Actor, h.URI("/items/one"))
	if err != nil {
		t.Fatal(err)
	}
	if len(nodes) != 3 || calls.Load() != 1 {
		t.Fatalf("nodes=%d lookups=%d, want 3 and 1", len(nodes), calls.Load())
	}
	if _, err := h.Frontend.ReadDir(ctx, h.Actor, h.URI("/items/one")); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Fatalf("lookup leaked between operations: %d", calls.Load())
	}
	for _, path := range []string{"/items/missing", "/items/missing/details", "/items/missing/a.json"} {
		if _, err := h.Frontend.Stat(ctx, h.Actor, h.URI(path)); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("Stat(%s)=%v", path, err)
		}
	}
	if _, err := h.Frontend.OpenFile(ctx, h.Actor, h.URI("/items/missing/a.json"), os.O_RDONLY); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("OpenFile missing item=%v", err)
	}
	providertest.CheckTree(t, ctx, h, providertest.CheckOptions{Expected: []string{"/items/one/a.json", "/hidden.json"}})
	var wg sync.WaitGroup
	for _, id := range []string{"alice", "bob"} {
		id := id
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 10 {
				f, err := h.Frontend.OpenFile(ctx, vfs.Actor{Kind: vfs.ActorUser, ID: id}, h.URI("/items/one/a.json"), os.O_RDONLY)
				if err != nil {
					t.Error(err)
					return
				}
				data, err := io.ReadAll(f)
				_ = f.Close()
				if err != nil {
					t.Error(err)
					return
				}
				var got item
				if err = json.Unmarshal(data, &got); err != nil || got.Actor != id {
					t.Errorf("actor=%s got=%s error=%v", id, data, err)
				}
			}
		}()
	}
	wg.Wait()
}

func TestBuildValidationAndFreeze(t *testing.T) {
	for _, name := range []string{"../bad", "a/b", "{id}", "", "a\\b"} {
		tree := sdk.New()
		sdk.Directory(tree.Root(), name)
		if _, err := tree.Build(); err == nil {
			t.Errorf("accepted invalid name %q", name)
		}
	}
	tree := sdk.New()
	sdk.Directory(tree.Root(), "same")
	sdk.Directory(tree.Root(), "same")
	if _, err := tree.Build(); err == nil {
		t.Fatal("accepted duplicate route")
	}
	tree = sdk.New()
	sdk.Directory(tree.Root(), "ok")
	p, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	sdk.Directory(tree.Root(), "late")
	if _, err = tree.Build(); err == nil {
		t.Fatal("rebuilt frozen tree")
	}
	if _, err = p.Stat(context.Background(), "/late"); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("mutated built provider")
	}
}

func TestCheapMetadataDoesNotRender(t *testing.T) {
	tree := sdk.New()
	renders := 0
	sdk.JSON(tree.Root(), "value.json", func(context.Context, sdk.Request, sdk.Unit) (int, error) { renders++; return 42, nil }).Metadata(func(context.Context, sdk.Request, sdk.Unit) (*vfs.Node, error) {
		return sdk.FileNode("value.json", 3), nil
	})
	p, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	if _, err = p.ReadDir(context.Background(), "/"); err != nil {
		t.Fatal(err)
	}
	if renders != 0 {
		t.Fatal("listing rendered a document despite explicit metadata")
	}
	f, err := p.OpenFile(context.Background(), "/value.json", os.O_RDONLY)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil || string(data) != "42\n" || renders != 1 {
		t.Fatalf("data=%q renders=%d err=%v", data, renders, err)
	}
}

func TestDocumentsCommitAbortAndValidation(t *testing.T) {
	type settings struct {
		Enabled bool `json:"enabled"`
	}
	for _, tc := range []struct {
		name, payload string
		want          error
		cancel, abort bool
	}{
		{"valid", `{"enabled":true}`, nil, false, false},
		{"unknown field", `{"surprise":true}`, vfs.ErrInvalidArgument, false, false},
		{"trailing value", `{} {}`, vfs.ErrInvalidArgument, false, false},
		{"broken", `{`, vfs.ErrInvalidArgument, false, false},
		{"domain validation", `{"enabled":false}`, vfs.ErrFailedPrecondition, false, false},
		{"too large", `{"enabled":true,"extra":"12345678901234567890"}`, vfs.ErrResourceExhausted, false, false},
		{"canceled", `{"enabled":true}`, context.Canceled, true, false},
		{"aborted source", `{"enabled":true}`, io.ErrUnexpectedEOF, false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			saves := 0
			tree := sdk.New()
			sdk.Document(tree.Root(), "settings.json", sdk.DocumentSpec[sdk.Unit, settings]{
				Read:    func(context.Context, sdk.Request, sdk.Unit) (settings, error) { return settings{}, nil },
				Replace: func(context.Context, sdk.Request, sdk.Unit, settings) error { saves++; return nil },
				Validate: func(ctx context.Context, s settings) error {
					if !s.Enabled {
						return vfs.ErrFailedPrecondition
					}
					return nil
				}, MaxBytes: 32,
			})
			p, err := tree.Build()
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			file, err := p.OpenFile(ctx, "/settings.json", os.O_WRONLY|os.O_TRUNC)
			if err != nil {
				t.Fatal(err)
			}
			_, transferErr := file.Write([]byte(tc.payload))
			if tc.cancel {
				cancel()
			}
			if tc.abort {
				transferErr = io.ErrUnexpectedEOF
			}
			err = vfs.FinishWrite(file, transferErr)
			if !errors.Is(err, tc.want) {
				t.Fatalf("finish=%v want=%v", err, tc.want)
			}
			_ = file.Close()
			_ = file.Close()
			wantSaves := 0
			if tc.want == nil {
				wantSaves = 1
			}
			if saves != wantSaves {
				t.Fatalf("saves=%d want=%d", saves, wantSaves)
			}
		})
	}
}

type denyExec struct{}

func (denyExec) Can(ctx context.Context, actor vfs.Actor, action vfs.Action, ref vfs.ResourceRef) (bool, error) {
	return action != vfs.ActionExec, nil
}
func TestCommandsUseExecuteACLAndTypedPayloads(t *testing.T) {
	type input struct {
		Value int `json:"value"`
	}
	tree := sdk.New()
	calls := 0
	sdk.Command(tree.Root(), "double", sdk.CommandSpec[sdk.Unit, input, int]{Handle: func(ctx context.Context, req sdk.Request, _ sdk.Unit, in input) (int, error) {
		calls++
		return 2 * in.Value, nil
	}})
	p, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	h := harness(t, p, providertest.Options{Authorizer: denyExec{}})
	if _, err = h.Frontend.Control(context.Background(), h.Actor, h.URI("/"), "double", []byte(`{"value":4}`)); !errors.Is(err, vfs.ErrPermissionDenied) || calls != 0 {
		t.Fatalf("ACL err=%v calls=%d", err, calls)
	}
	h = harness(t, p, providertest.Options{})
	out, err := h.Frontend.Control(context.Background(), h.Actor, h.URI("/"), "double", []byte(`{"value":4}`))
	if err != nil || string(out) != "8\n" || calls != 1 {
		t.Fatalf("out=%s err=%v calls=%d", out, err, calls)
	}
	if _, err = h.Frontend.Control(context.Background(), h.Actor, h.URI("/"), "unknown", nil); !errors.Is(err, vfs.ErrUnsupported) {
		t.Fatal(err)
	}
	if len(p.Routes()[0].Commands) != 1 {
		t.Fatal("missing command schema")
	}
}

func TestDefinitionDefaultsAndValidation(t *testing.T) {
	type config struct {
		Count int    `json:"count"`
		Name  string `json:"name"`
	}
	opened := 0
	d := sdk.Definition[config]{Key: "example", Defaults: func() config { return config{Count: 7} }, Validate: func(ctx context.Context, c config) error {
		if c.Count < 0 {
			return vfs.ErrInvalidArgument
		}
		return nil
	}, Open: func(context.Context, vfs.ProviderConnection, config) (vfs.FSProvider, error) {
		opened++
		return sdk.New().Build()
	}}
	c, err := d.Config(context.Background(), []byte(`{"name":"hello"}`))
	if err != nil || !reflect.DeepEqual(c, config{Count: 7, Name: "hello"}) {
		t.Fatalf("%+v %v", c, err)
	}
	for _, data := range []string{`{"count":-1}`, `{"unknown":true}`, `{} {}`} {
		if _, err := d.Factory()(context.Background(), vfs.ProviderConnection{ProviderKey: "example", Config: []byte(data)}); err == nil {
			t.Fatalf("accepted %s", data)
		}
	}
	if opened != 0 {
		t.Fatal("opened backend with invalid config")
	}
	type recursive struct {
		Next *recursive `json:"next,omitempty"`
	}
	if _, err = json.Marshal(sdk.Schema[recursive]()); err != nil {
		t.Fatal(err)
	}
}

func TestCatalogKeepsDetachedDescriptions(t *testing.T) {
	type config struct {
		Secret string `json:"secret" secret:"true"`
	}
	d := sdk.Definition[config]{Key: "example", Open: func(context.Context, vfs.ProviderConnection, config) (vfs.FSProvider, error) {
		return sdk.New().Build()
	}}
	catalog := sdk.NewCatalog()
	if err := sdk.RegisterDefinition(catalog, d); err != nil {
		t.Fatal(err)
	}
	if err := sdk.RegisterDefinition(catalog, d); !errors.Is(err, vfs.ErrAlreadyExists) {
		t.Fatal(err)
	}
	if _, ok := catalog.Factory("example"); !ok {
		t.Fatal("factory missing")
	}
	info := catalog.Providers()
	props := info[0].ConfigSchema.(map[string]any)["properties"].(map[string]any)
	if props["secret"].(map[string]any)["writeOnly"] != true {
		t.Fatal("secret field is not marked")
	}
	props["secret"] = "changed"
	if reflect.DeepEqual(info, catalog.Providers()) {
		t.Fatal("caller mutated catalog schema")
	}
	if err := catalog.Check(context.Background(), "example", []byte("{}")); !errors.Is(err, vfs.ErrUnsupported) {
		t.Fatal(err)
	}
}
