package providerdev_test

import (
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/providerdev"
	sdk "MyServer/pkg/vfs/providersdk"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type brokenBody struct{ sent bool }

func (b *brokenBody) Read(p []byte) (int, error) {
	if !b.sent {
		b.sent = true
		return copy(p, []byte(`{"value":7}`)), nil
	}
	return 0, io.ErrUnexpectedEOF
}
func (*brokenBody) Close() error { return nil }

func TestHTTPAndWebDAVAbortSourceErrors(t *testing.T) {
	for _, protocol := range []string{"http", "webdav"} {
		for _, failure := range []bool{false, true} {
			t.Run(protocol+"/"+map[bool]string{false: "complete", true: "source-error"}[failure], func(t *testing.T) {
				type value struct {
					Value int `json:"value"`
				}
				saves := 0
				tree := sdk.New()
				sdk.Document(tree.Root(), "value.json", sdk.DocumentSpec[sdk.Unit, value]{
					Read:    func(context.Context, sdk.Request, sdk.Unit) (value, error) { return value{}, nil },
					Replace: func(context.Context, sdk.Request, sdk.Unit, value) error { saves++; return nil },
				})
				p, err := tree.Build()
				if err != nil {
					t.Fatal(err)
				}
				server, err := providerdev.New(context.Background(), func(context.Context, vfs.ProviderConnection) (vfs.FSProvider, error) { return p, nil }, providerdev.Options{})
				if err != nil {
					t.Fatal(err)
				}
				defer server.Close()
				target := "/dav/value.json"
				if protocol == "http" {
					target = "/api/v2/vfs/file?uri=" + url.QueryEscape(string(server.Harness.URI("/value.json")))
				}
				req := httptest.NewRequest(http.MethodPut, target, strings.NewReader(`{"value":7}`))
				if failure {
					req.Body = &brokenBody{}
					req.ContentLength = -1
				}
				rec := httptest.NewRecorder()
				server.ServeHTTP(rec, req)
				if failure {
					if saves != 0 || rec.Code < 400 {
						t.Fatalf("partial upload committed: saves=%d status=%d", saves, rec.Code)
					}
				} else if saves != 1 || rec.Code < 200 || rec.Code >= 300 {
					t.Fatalf("valid upload: saves=%d status=%d body=%s", saves, rec.Code, rec.Body.String())
				}
			})
		}
	}
}

func TestInspectorAndPayloadLimit(t *testing.T) {
	saves := 0
	tree := sdk.New()
	sdk.BytesDocument(tree.Root(), "value.txt", func(context.Context, sdk.Request, sdk.Unit) ([]byte, error) { return []byte("old"), nil }, func(context.Context, sdk.Request, sdk.Unit, []byte) error { saves++; return nil }, 4)
	p, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	server, err := providerdev.New(context.Background(), func(context.Context, vfs.ProviderConnection) (vfs.FSProvider, error) { return p, nil }, providerdev.Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer server.Close()
	for _, target := range []string{"/", "/_provider"} {
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, httptest.NewRequest("GET", target, nil))
		if rec.Code != 200 {
			t.Fatalf("%s: %d", target, rec.Code)
		}
		if target == "/_provider" && !json.Valid(rec.Body.Bytes()) {
			t.Fatal("invalid description")
		}
	}
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, httptest.NewRequest("PUT", "/api/v2/vfs/file?uri="+url.QueryEscape(string(server.Harness.URI("/value.txt"))), strings.NewReader("12345")))
	if rec.Code != http.StatusTooManyRequests || saves != 0 {
		t.Fatalf("limit: status=%d saves=%d", rec.Code, saves)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = p.Stat(ctx, "/"); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
