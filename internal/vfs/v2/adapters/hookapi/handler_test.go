package hookapi

import (
	"github.com/akyaiy/veido/pkg/vfs"
	"github.com/akyaiy/veido/pkg/vfs/hooks"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

type runtimeCall struct {
	resource vfs.URI
	hook     string
	input    json.RawMessage
	options  hooks.RunOptions
}

type recordingRuntime struct {
	calls []runtimeCall
	err   error
}

func (r *recordingRuntime) result(hook string) (hooks.Result, error) {
	if r.err != nil {
		return hooks.Result{}, r.err
	}
	return hooks.Result{Hook: hook, Version: 1, ExecutionID: "exec-1", Status: "completed", Output: json.RawMessage(`{"ok":true}`)}, nil
}
func (r *recordingRuntime) Run(_ context.Context, _ vfs.Actor, hook string, input json.RawMessage, options hooks.RunOptions) (hooks.Result, error) {
	r.calls = append(r.calls, runtimeCall{hook: hook, input: input, options: options})
	return r.result(hook)
}

func TestHookEndpointRunsGlobalHookAndReturnsResult(t *testing.T) {
	runtime := &recordingRuntime{}
	handler, err := NewHandler(runtime, func(*http.Request) (vfs.Actor, error) {
		return vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}, nil
	}, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	RegisterRoutes(router, handler)
	request := httptest.NewRequest(http.MethodPost, "/hooks/get-static/run", strings.NewReader(`{"input":{"path":"index.html"}}`))
	request.Header.Set("Idempotency-Key", "request-1")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"execution_id":"exec-1"`) || !strings.Contains(response.Body.String(), `"ok":true`) {
		t.Fatalf("response: status=%d body=%q", response.Code, response.Body.String())
	}
	if len(runtime.calls) != 1 || runtime.calls[0].resource != "" || runtime.calls[0].hook != "get-static" || runtime.calls[0].options.IdempotencyKey != "request-1" || string(runtime.calls[0].input) != `{"path":"index.html"}` {
		t.Fatalf("runtime calls = %+v", runtime.calls)
	}
}

func TestHookEndpointMapsStructuredRuntimeError(t *testing.T) {
	runtime := &recordingRuntime{err: &hooks.RunError{Code: "hook_step_failed", Message: "hook execution failed", ExecutionID: "exec-2", FailedStep: "read-template-asset", Cause: "permission_denied"}}
	handler, err := NewHandler(runtime, func(*http.Request) (vfs.Actor, error) {
		return vfs.Actor{Kind: vfs.ActorGuest}, nil
	}, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	RegisterRoutes(router, handler)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/hooks/get-static/run", strings.NewReader(`{"input":{}}`)))
	if response.Code != http.StatusForbidden || !strings.Contains(response.Body.String(), `"failed_step":"read-template-asset"`) || !strings.Contains(response.Body.String(), `"cause":"permission_denied"`) {
		t.Fatalf("response: status=%d body=%q", response.Code, response.Body.String())
	}
}

func TestHookEndpointRejectsUnknownFieldsAndInvalidURI(t *testing.T) {
	runtime := &recordingRuntime{}
	handler, err := NewHandler(runtime, func(*http.Request) (vfs.Actor, error) { return vfs.Actor{Kind: vfs.ActorGuest}, nil }, 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	RegisterRoutes(router, handler)
	for _, body := range []string{
		`{"resource_uri":"html@site[acme]:///","input":{}}`,
		`{"input":{},"actor":"admin"}`,
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/hooks/get-static/run", strings.NewReader(body)))
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body=%s status=%d response=%q", body, response.Code, response.Body.String())
		}
	}
	if len(runtime.calls) != 0 {
		t.Fatalf("invalid requests reached runtime: %+v", runtime.calls)
	}
}
