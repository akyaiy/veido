package httpapi

import (
	"MyServer/internal/common"
	"MyServer/internal/vfs/v2"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

type memoryEntry struct {
	node v2.Node
	data []byte
}

type memoryFrontend struct {
	mu      sync.Mutex
	entries map[string]memoryEntry
}

func newMemoryFrontend() *memoryFrontend {
	return &memoryFrontend{entries: map[string]memoryEntry{}}
}

func (f *memoryFrontend) Stat(_ context.Context, _ v2.Actor, uri common.CanonURI) (*v2.Node, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	entry, ok := f.entries[string(uri)]
	if !ok {
		return nil, v2.NewError(v2.KindNotFound, v2.OpStat, "resource not found", os.ErrNotExist)
	}
	node := entry.node
	return &node, nil
}

func (f *memoryFrontend) ReadDir(_ context.Context, _ v2.Actor, uri common.CanonURI) ([]*v2.Node, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	prefix := strings.TrimSuffix(string(uri), "/") + "/"
	items := make([]*v2.Node, 0)
	for key, entry := range f.entries {
		if strings.HasPrefix(key, prefix) && !strings.Contains(strings.TrimPrefix(key, prefix), "/") {
			node := entry.node
			items = append(items, &node)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	return items, nil
}

func (f *memoryFrontend) OpenFile(_ context.Context, _ v2.Actor, uri common.CanonURI, flags int) (v2.File, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	key := string(uri)
	entry, exists := f.entries[key]
	if flags&os.O_CREATE != 0 {
		if exists && flags&os.O_EXCL != 0 {
			return nil, v2.NewError(v2.KindAlreadyExists, v2.OpOpenFile, "resource already exists", os.ErrExist)
		}
		return newMemoryWriteFile(path.Base(key), nil, func(data []byte) {
			f.mu.Lock()
			defer f.mu.Unlock()
			f.entries[key] = memoryEntry{node: v2.Node{Name: path.Base(key), Kind: "file", Size: int64(len(data)), UpdatedAt: time.Now()}, data: data}
		}), nil
	}
	if !exists {
		return nil, v2.NewError(v2.KindNotFound, v2.OpOpenFile, "resource not found", os.ErrNotExist)
	}
	if flags&(os.O_WRONLY|os.O_RDWR|os.O_TRUNC) != 0 {
		initial := entry.data
		if flags&os.O_TRUNC != 0 {
			initial = nil
		}
		return newMemoryWriteFile(entry.node.Name, initial, func(data []byte) {
			f.mu.Lock()
			defer f.mu.Unlock()
			entry.data = data
			entry.node.Size = int64(len(data))
			entry.node.UpdatedAt = time.Now()
			f.entries[key] = entry
		}), nil
	}
	return newReadFile(entry.node.Name, string(entry.data)), nil
}

func (f *memoryFrontend) Mkdir(_ context.Context, _ v2.Actor, uri common.CanonURI) (*v2.Node, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	key := string(uri)
	if _, exists := f.entries[key]; exists {
		return nil, v2.NewError(v2.KindAlreadyExists, v2.OpMkdir, "resource already exists", os.ErrExist)
	}
	node := v2.Node{Name: path.Base(key), Kind: "directory", IsDir: true, UpdatedAt: time.Now()}
	f.entries[key] = memoryEntry{node: node}
	return &node, nil
}

func (f *memoryFrontend) Move(_ context.Context, _ v2.Actor, source, target common.CanonURI) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	entry, exists := f.entries[string(source)]
	if !exists {
		return v2.NewError(v2.KindNotFound, v2.OpMove, "resource not found", os.ErrNotExist)
	}
	if _, exists := f.entries[string(target)]; exists {
		return v2.NewError(v2.KindAlreadyExists, v2.OpMove, "target already exists", os.ErrExist)
	}
	delete(f.entries, string(source))
	entry.node.Name = path.Base(string(target))
	f.entries[string(target)] = entry
	return nil
}

func (f *memoryFrontend) Delete(_ context.Context, _ v2.Actor, uri common.CanonURI) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, exists := f.entries[string(uri)]; !exists {
		return v2.NewError(v2.KindNotFound, v2.OpDelete, "resource not found", os.ErrNotExist)
	}
	delete(f.entries, string(uri))
	return nil
}

func (f *memoryFrontend) Control(_ context.Context, _ v2.Actor, _ common.CanonURI, command string, input []byte) ([]byte, error) {
	if command != "echo" {
		return nil, v2.NewError(v2.KindUnsupported, v2.OpControl, "command is not supported", v2.ErrNotImplemented)
	}
	return append([]byte(nil), input...), nil
}

type memoryWriteFile struct {
	name   string
	buffer *bytes.Buffer
	commit func([]byte)
	closed bool
}

func newMemoryWriteFile(name string, initial []byte, commit func([]byte)) *memoryWriteFile {
	return &memoryWriteFile{name: name, buffer: bytes.NewBuffer(append([]byte(nil), initial...)), commit: commit}
}

func (f *memoryWriteFile) Read([]byte) (int, error) { return 0, os.ErrPermission }
func (f *memoryWriteFile) Write(p []byte) (int, error) {
	return f.buffer.Write(p)
}
func (f *memoryWriteFile) Seek(offset int64, whence int) (int64, error) {
	if whence == io.SeekEnd && offset == 0 {
		return int64(f.buffer.Len()), nil
	}
	return 0, os.ErrInvalid
}
func (f *memoryWriteFile) Close() error {
	if !f.closed {
		f.closed = true
		f.commit(append([]byte(nil), f.buffer.Bytes()...))
	}
	return nil
}
func (f *memoryWriteFile) Stat() (os.FileInfo, error) {
	return fakeFileInfo{name: f.name, size: int64(f.buffer.Len())}, nil
}

func TestHTTPWorkflow(t *testing.T) {
	frontend := newMemoryFrontend()
	router := testRouter(t, frontend, actorResolver(testActor), DefaultLimits())
	directoryURI := "local@default[alice]:///docs"
	fileURI := directoryURI + "/a.txt"
	movedURI := directoryURI + "/b.txt"

	steps := []struct {
		method string
		route  string
		uri    string
		body   string
		status int
	}{
		{http.MethodPost, "/api/v2/vfs/directory", directoryURI, "", http.StatusCreated},
		{http.MethodPost, "/api/v2/vfs/file", fileURI, "first", http.StatusCreated},
		{http.MethodGet, "/api/v2/vfs/stat", fileURI, "", http.StatusOK},
		{http.MethodGet, "/api/v2/vfs/read", fileURI, "", http.StatusOK},
		{http.MethodPut, "/api/v2/vfs/file", fileURI, "second", http.StatusNoContent},
		{http.MethodGet, "/api/v2/vfs/list", directoryURI, "", http.StatusOK},
	}
	for _, step := range steps {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request(step.method, step.route, step.uri, step.body))
		if response.Code != step.status {
			t.Fatalf("%s %s: status = %d, body = %s", step.method, step.route, response.Code, response.Body.String())
		}
	}

	moveBody, _ := json.Marshal(moveRequest{TargetURI: movedURI})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request(http.MethodPost, "/api/v2/vfs/move", fileURI, string(moveBody)))
	if response.Code != http.StatusNoContent {
		t.Fatalf("move status = %d, body = %s", response.Code, response.Body.String())
	}

	response = httptest.NewRecorder()
	router.ServeHTTP(response, request(http.MethodDelete, "/api/v2/vfs/resource", movedURI, ""))
	if response.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d, body = %s", response.Code, response.Body.String())
	}

	response = httptest.NewRecorder()
	router.ServeHTTP(response, request(http.MethodGet, "/api/v2/vfs/stat", movedURI, ""))
	if response.Code != http.StatusNotFound || responseProblemCode(t, response) != "not_found" {
		t.Fatalf("stat deleted status = %d, body = %s", response.Code, response.Body.String())
	}

	response = httptest.NewRecorder()
	controlRoute := "/api/v2/vfs/control?command=echo&uri=" + url.QueryEscape(fileURI)
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, controlRoute, strings.NewReader("ping")))
	if response.Code != http.StatusOK || response.Body.String() != "ping" {
		t.Fatalf("control status = %d, body = %s", response.Code, response.Body.String())
	}
}
