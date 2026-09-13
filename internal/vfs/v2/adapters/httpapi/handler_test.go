package httpapi

import (
	"MyServer/internal/common"
	"MyServer/internal/vfs/v2"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

var testActor = v2.Actor{Kind: v2.ActorUser, ID: "42"}

type fakeFrontend struct {
	statFn     func(context.Context, v2.Actor, common.CanonURI) (*v2.Node, error)
	readDirFn  func(context.Context, v2.Actor, common.CanonURI) ([]*v2.Node, error)
	openFileFn func(context.Context, v2.Actor, common.CanonURI, int) (v2.File, error)
	mkdirFn    func(context.Context, v2.Actor, common.CanonURI) (*v2.Node, error)
	moveFn     func(context.Context, v2.Actor, common.CanonURI, common.CanonURI) error
	deleteFn   func(context.Context, v2.Actor, common.CanonURI) error
	controlFn  func(context.Context, v2.Actor, common.CanonURI, string, []byte) ([]byte, error)
}

func (f *fakeFrontend) Stat(ctx context.Context, actor v2.Actor, uri common.CanonURI) (*v2.Node, error) {
	return f.statFn(ctx, actor, uri)
}

func (f *fakeFrontend) ReadDir(ctx context.Context, actor v2.Actor, uri common.CanonURI) ([]*v2.Node, error) {
	return f.readDirFn(ctx, actor, uri)
}

func (f *fakeFrontend) OpenFile(ctx context.Context, actor v2.Actor, uri common.CanonURI, flags int) (v2.File, error) {
	return f.openFileFn(ctx, actor, uri, flags)
}

func (f *fakeFrontend) Mkdir(ctx context.Context, actor v2.Actor, uri common.CanonURI) (*v2.Node, error) {
	return f.mkdirFn(ctx, actor, uri)
}

func (f *fakeFrontend) Move(ctx context.Context, actor v2.Actor, source, target common.CanonURI) error {
	return f.moveFn(ctx, actor, source, target)
}

func (f *fakeFrontend) Delete(ctx context.Context, actor v2.Actor, uri common.CanonURI) error {
	return f.deleteFn(ctx, actor, uri)
}

func (f *fakeFrontend) Control(ctx context.Context, actor v2.Actor, uri common.CanonURI, command string, input []byte) ([]byte, error) {
	return f.controlFn(ctx, actor, uri, command, input)
}

type fakeFile struct {
	reader   *bytes.Reader
	written  bytes.Buffer
	info     os.FileInfo
	writeErr error
	statErr  error
	closeErr error
	closed   bool
}

func newReadFile(name, contents string) *fakeFile {
	return &fakeFile{
		reader: bytes.NewReader([]byte(contents)),
		info:   fakeFileInfo{name: name, size: int64(len(contents))},
	}
}

func newWriteFile() *fakeFile {
	return &fakeFile{reader: bytes.NewReader(nil), info: fakeFileInfo{name: "file.txt"}}
}

func (f *fakeFile) Read(p []byte) (int, error) { return f.reader.Read(p) }
func (f *fakeFile) Write(p []byte) (int, error) {
	if f.writeErr != nil {
		return 0, f.writeErr
	}
	return f.written.Write(p)
}
func (f *fakeFile) Seek(offset int64, whence int) (int64, error) {
	return f.reader.Seek(offset, whence)
}
func (f *fakeFile) Close() error {
	f.closed = true
	return f.closeErr
}
func (f *fakeFile) Stat() (os.FileInfo, error) { return f.info, f.statErr }

type fakeFileInfo struct {
	name string
	size int64
}

func (i fakeFileInfo) Name() string       { return i.name }
func (i fakeFileInfo) Size() int64        { return i.size }
func (i fakeFileInfo) Mode() os.FileMode  { return 0 }
func (i fakeFileInfo) ModTime() time.Time { return time.Time{} }
func (i fakeFileInfo) IsDir() bool        { return false }
func (i fakeFileInfo) Sys() any           { return nil }

func testRouter(t *testing.T, frontend v2.VFSFrontend, resolver ActorResolver, limits Limits) http.Handler {
	t.Helper()
	handler, err := NewHandler(frontend, resolver, limits, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("NewHandler() error = %v", err)
	}
	router := chi.NewRouter()
	router.Route("/api/v2/vfs", func(r chi.Router) { RegisterRoutes(r, handler) })
	return router
}

func actorResolver(actor v2.Actor) ActorResolver {
	return func(*http.Request) (v2.Actor, error) { return actor, nil }
}

func request(method, route, uri, body string) *http.Request {
	if uri != "" {
		route += "?uri=" + url.QueryEscape(uri)
	}
	return httptest.NewRequest(method, route, strings.NewReader(body))
}

func TestReadOnlyEndpoints(t *testing.T) {
	canonical := "local@default[alice]:///docs/a.txt"
	updated := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	frontend := &fakeFrontend{
		statFn: func(_ context.Context, actor v2.Actor, uri common.CanonURI) (*v2.Node, error) {
			assertTarget(t, actor, uri, canonical)
			return &v2.Node{Name: "a.txt", Kind: "file", Size: 5, UpdatedAt: updated}, nil
		},
		readDirFn: func(_ context.Context, actor v2.Actor, uri common.CanonURI) ([]*v2.Node, error) {
			assertTarget(t, actor, uri, canonical)
			return []*v2.Node{{Name: "a.txt", Kind: "file", Size: 5}}, nil
		},
		openFileFn: func(_ context.Context, actor v2.Actor, uri common.CanonURI, flags int) (v2.File, error) {
			assertTarget(t, actor, uri, canonical)
			if flags != os.O_RDONLY {
				t.Fatalf("OpenFile flags = %d, want O_RDONLY", flags)
			}
			return newReadFile("a.txt", "hello"), nil
		},
	}
	router := testRouter(t, frontend, actorResolver(testActor), DefaultLimits())

	t.Run("stat", func(t *testing.T) {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request(http.MethodGet, "/api/v2/vfs/stat", canonical, ""))
		if response.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
		}
		var got nodeResponse
		if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if got.Name != "a.txt" || got.Kind != "file" || got.Size != 5 || !got.UpdatedAt.Equal(updated) {
			t.Fatalf("response = %+v", got)
		}
	})

	t.Run("list", func(t *testing.T) {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request(http.MethodGet, "/api/v2/vfs/list", canonical, ""))
		if response.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
		}
		var got listResponse
		if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if len(got.Items) != 1 || got.Items[0].Name != "a.txt" {
			t.Fatalf("response = %+v", got)
		}
	})

	t.Run("read", func(t *testing.T) {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request(http.MethodGet, "/api/v2/vfs/read", canonical, ""))
		if response.Code != http.StatusOK || response.Body.String() != "hello" {
			t.Fatalf("status = %d, body = %q", response.Code, response.Body.String())
		}
		if got := response.Header().Get("Content-Type"); got != "application/octet-stream" {
			t.Fatalf("Content-Type = %q", got)
		}
		if got := response.Header().Get("Content-Length"); got != "5" {
			t.Fatalf("Content-Length = %q", got)
		}
	})
}

func TestMutatingEndpoints(t *testing.T) {
	canonical := "local@default[alice]:///docs/a.txt"
	target := "local@default[alice]:///archive/a.txt"
	createFile := newWriteFile()
	replaceFile := newWriteFile()
	openCalls := 0
	frontend := &fakeFrontend{
		openFileFn: func(_ context.Context, actor v2.Actor, uri common.CanonURI, flags int) (v2.File, error) {
			assertTarget(t, actor, uri, canonical)
			openCalls++
			switch openCalls {
			case 1:
				if flags != os.O_CREATE|os.O_WRONLY|os.O_EXCL {
					t.Fatalf("create flags = %d", flags)
				}
				return createFile, nil
			case 2:
				if flags != os.O_WRONLY|os.O_TRUNC {
					t.Fatalf("replace flags = %d", flags)
				}
				return replaceFile, nil
			default:
				t.Fatalf("unexpected OpenFile call")
				return nil, errors.New("unreachable")
			}
		},
		mkdirFn: func(_ context.Context, actor v2.Actor, uri common.CanonURI) (*v2.Node, error) {
			assertTarget(t, actor, uri, canonical)
			return &v2.Node{Name: "a.txt", Kind: "directory", IsDir: true}, nil
		},
		moveFn: func(_ context.Context, actor v2.Actor, source, gotTarget common.CanonURI) error {
			assertTarget(t, actor, source, canonical)
			if string(gotTarget) != target {
				t.Fatalf("target = %q", gotTarget)
			}
			return nil
		},
		deleteFn: func(_ context.Context, actor v2.Actor, uri common.CanonURI) error {
			assertTarget(t, actor, uri, canonical)
			return nil
		},
		controlFn: func(_ context.Context, actor v2.Actor, uri common.CanonURI, command string, input []byte) ([]byte, error) {
			assertTarget(t, actor, uri, canonical)
			if command != "export" || string(input) != `{"format":"pdf"}` {
				t.Fatalf("control = (%q, %q)", command, input)
			}
			return []byte("result"), nil
		},
	}
	router := testRouter(t, frontend, actorResolver(testActor), DefaultLimits())

	tests := []struct {
		name        string
		method      string
		route       string
		body        string
		wantStatus  int
		wantBody    string
		contentType string
	}{
		{"create file", http.MethodPost, "/api/v2/vfs/file", "new", http.StatusCreated, "", ""},
		{"replace file", http.MethodPut, "/api/v2/vfs/file", "replacement", http.StatusNoContent, "", ""},
		{"mkdir", http.MethodPost, "/api/v2/vfs/directory", "", http.StatusCreated, "", "application/json; charset=utf-8"},
		{"move", http.MethodPost, "/api/v2/vfs/move", `{"target_uri":"` + target + `"}`, http.StatusNoContent, "", ""},
		{"delete", http.MethodDelete, "/api/v2/vfs/resource", "", http.StatusNoContent, "", ""},
		{"control", http.MethodPost, "/api/v2/vfs/control&command=export", `{"format":"pdf"}`, http.StatusOK, "result", "application/octet-stream"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			route := test.route
			if strings.Contains(route, "&command=") {
				parts := strings.SplitN(route, "&", 2)
				route = parts[0] + "?" + parts[1] + "&uri=" + url.QueryEscape(canonical)
			} else {
				route += "?uri=" + url.QueryEscape(canonical)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(test.method, route, strings.NewReader(test.body)))
			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
			if test.wantBody != "" && response.Body.String() != test.wantBody {
				t.Fatalf("body = %q", response.Body.String())
			}
			if test.contentType != "" && response.Header().Get("Content-Type") != test.contentType {
				t.Fatalf("Content-Type = %q", response.Header().Get("Content-Type"))
			}
		})
	}
	if got := createFile.written.String(); got != "new" || !createFile.closed {
		t.Fatalf("created file = %q, closed = %v", got, createFile.closed)
	}
	if got := replaceFile.written.String(); got != "replacement" || !replaceFile.closed {
		t.Fatalf("replaced file = %q, closed = %v", got, replaceFile.closed)
	}
}

func TestRequestValidationAndLimits(t *testing.T) {
	frontend := &fakeFrontend{
		openFileFn: func(context.Context, v2.Actor, common.CanonURI, int) (v2.File, error) {
			t.Fatal("OpenFile must not be called")
			return nil, nil
		},
		moveFn: func(context.Context, v2.Actor, common.CanonURI, common.CanonURI) error {
			t.Fatal("Move must not be called")
			return nil
		},
		controlFn: func(context.Context, v2.Actor, common.CanonURI, string, []byte) ([]byte, error) {
			t.Fatal("Control must not be called")
			return nil, nil
		},
	}
	limits := Limits{MaxFileWriteBytes: 3, MaxControlBytes: 3, MaxJSONBytes: 64}
	router := testRouter(t, frontend, actorResolver(testActor), limits)
	canonical := "local@default[alice]:///a.txt"

	tests := []struct {
		name   string
		method string
		route  string
		body   string
		status int
		code   string
	}{
		{"missing uri", http.MethodGet, "/api/v2/vfs/stat", "", http.StatusBadRequest, "invalid_argument"},
		{"duplicate uri", http.MethodGet, "/api/v2/vfs/stat?uri=a&uri=b", "", http.StatusBadRequest, "invalid_argument"},
		{"invalid uri", http.MethodGet, "/api/v2/vfs/stat?uri=plain-path", "", http.StatusBadRequest, "invalid_argument"},
		{"file too large", http.MethodPost, "/api/v2/vfs/file?uri=" + url.QueryEscape(canonical), "four", http.StatusRequestEntityTooLarge, "payload_too_large"},
		{"control too large", http.MethodPost, "/api/v2/vfs/control?command=x&uri=" + url.QueryEscape(canonical), "four", http.StatusRequestEntityTooLarge, "payload_too_large"},
		{"move unknown field", http.MethodPost, "/api/v2/vfs/move?uri=" + url.QueryEscape(canonical), `{"target_uri":"` + canonical + `","extra":true}`, http.StatusBadRequest, "invalid_argument"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(test.method, test.route, strings.NewReader(test.body)))
			if response.Code != test.status {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
			if got := responseProblemCode(t, response); got != test.code {
				t.Fatalf("error code = %q", got)
			}
		})
	}

	unauthenticated := testRouter(t, frontend, func(*http.Request) (v2.Actor, error) {
		return v2.Actor{}, ErrUnauthenticated
	}, limits)
	response := httptest.NewRecorder()
	unauthenticated.ServeHTTP(response, request(http.MethodGet, "/api/v2/vfs/stat", canonical, ""))
	if response.Code != http.StatusUnauthorized || responseProblemCode(t, response) != "unauthenticated" {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestWriteCloseErrorPreventsSuccess(t *testing.T) {
	file := newWriteFile()
	file.closeErr = v2.NewError(v2.KindUnavailable, v2.OpClose, "commit failed", errors.New("storage down"))
	frontend := &fakeFrontend{openFileFn: func(context.Context, v2.Actor, common.CanonURI, int) (v2.File, error) {
		return file, nil
	}}
	router := testRouter(t, frontend, actorResolver(testActor), DefaultLimits())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request(http.MethodPost, "/api/v2/vfs/file", "local@default[alice]:///a.txt", "data"))
	if response.Code != http.StatusServiceUnavailable || responseProblemCode(t, response) != "unavailable" {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestChunkedWriteLimit(t *testing.T) {
	file := newWriteFile()
	frontend := &fakeFrontend{openFileFn: func(context.Context, v2.Actor, common.CanonURI, int) (v2.File, error) {
		return file, nil
	}}
	limits := Limits{MaxFileWriteBytes: 3, MaxControlBytes: 3, MaxJSONBytes: 64}
	router := testRouter(t, frontend, actorResolver(testActor), limits)
	req := request(http.MethodPost, "/api/v2/vfs/file", "local@default[alice]:///a.txt", "four")
	req.ContentLength = -1
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusRequestEntityTooLarge || responseProblemCode(t, response) != "payload_too_large" {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	if !file.closed {
		t.Fatal("file was not closed after body limit error")
	}
}

func TestNewHandlerValidation(t *testing.T) {
	frontend := &fakeFrontend{}
	if _, err := NewHandler(nil, actorResolver(testActor), DefaultLimits(), nil); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("NewHandler(nil) error = %v", err)
	}
	if _, err := NewHandler(frontend, nil, DefaultLimits(), nil); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("NewHandler(nil resolver) error = %v", err)
	}
	if _, err := NewHandler(frontend, actorResolver(testActor), Limits{}, nil); !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("NewHandler(zero limits) error = %v", err)
	}
	if _, err := NewHandler(frontend, actorResolver(testActor), DefaultLimits(), nil); err != nil {
		t.Fatalf("NewHandler(defaults) error = %v", err)
	}
}

func TestRouterErrorsUseProblemContract(t *testing.T) {
	frontend := &fakeFrontend{}
	router := testRouter(t, frontend, actorResolver(testActor), DefaultLimits())
	tests := []struct {
		method string
		path   string
		status int
		code   string
	}{
		{http.MethodGet, "/api/v2/vfs/missing", http.StatusNotFound, "not_found"},
		{http.MethodPatch, "/api/v2/vfs/stat", http.StatusMethodNotAllowed, "method_not_allowed"},
	}
	for _, test := range tests {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
		if response.Code != test.status || responseProblemCode(t, response) != test.code {
			t.Fatalf("%s %s: status = %d, body = %s", test.method, test.path, response.Code, response.Body.String())
		}
	}
}

func assertTarget(t *testing.T, actor v2.Actor, uri common.CanonURI, wantURI string) {
	t.Helper()
	if actor != testActor || string(uri) != wantURI {
		t.Fatalf("target = (%+v, %q), want (%+v, %q)", actor, uri, testActor, wantURI)
	}
}

func responseProblemCode(t *testing.T, response *httptest.ResponseRecorder) string {
	t.Helper()
	var problem problemResponse
	if err := json.Unmarshal(response.Body.Bytes(), &problem); err != nil {
		t.Fatalf("decode problem: %v; body = %s", err, response.Body.String())
	}
	return problem.Error.Code
}
