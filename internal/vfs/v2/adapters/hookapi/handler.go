// Package hookapi adapts the transport-neutral Hook Runtime to HTTP.
package hookapi

import (
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

const defaultMaxBodyBytes int64 = 256 << 10

var ErrInvalidConfiguration = errors.New("invalid hook HTTP adapter configuration")

type ActorResolver func(*http.Request) (vfs.Actor, error)

// Invocation identifies the already validated hook request at the HTTP
// boundary. A bridge may attach transport-only credentials to a private
// context and apply response mutations; the Hook Runtime remains independent
// from headers and cookies.
type Invocation struct {
	HookKey string
}

type TransportBridge interface {
	Prepare(*http.Request, Invocation) (context.Context, error)
	Complete(http.ResponseWriter, context.Context)
}

type Handler struct {
	runtime      hooks.Runtime
	resolveActor ActorResolver
	maxBodyBytes int64
	logger       *slog.Logger
	bridge       TransportBridge
}

type runRequest struct {
	Version int             `json:"version,omitempty"`
	Input   json.RawMessage `json:"input"`
}

type problemResponse struct {
	Error problemBody `json:"error"`
}

type problemBody struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	ExecutionID string `json:"execution_id,omitempty"`
	FailedStep  string `json:"failed_step,omitempty"`
	Cause       string `json:"cause,omitempty"`
	Retryable   bool   `json:"retryable"`
}

func NewHandler(runtime hooks.Runtime, resolveActor ActorResolver, maxBodyBytes int64, logger *slog.Logger) (*Handler, error) {
	return NewHandlerWithBridge(runtime, resolveActor, maxBodyBytes, logger, nil)
}

func NewHandlerWithBridge(runtime hooks.Runtime, resolveActor ActorResolver, maxBodyBytes int64, logger *slog.Logger, bridge TransportBridge) (*Handler, error) {
	if maxBodyBytes == 0 {
		maxBodyBytes = defaultMaxBodyBytes
	}
	if runtime == nil || resolveActor == nil || maxBodyBytes < 1 {
		return nil, ErrInvalidConfiguration
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Handler{runtime: runtime, resolveActor: resolveActor, maxBodyBytes: maxBodyBytes, logger: logger, bridge: bridge}, nil
}

func RegisterRoutes(router chi.Router, handler *Handler) {
	router.Post("/hooks/{hookKey}/run", handler.handleRun)
}

func (h *Handler) handleRun(w http.ResponseWriter, r *http.Request) {
	actor, err := h.resolveActor(r)
	if err != nil {
		h.writeProblem(w, r, http.StatusUnauthorized, &problemBody{Code: "unauthenticated", Message: "authentication is required"}, err)
		return
	}
	request, err := h.decodeRequest(w, r)
	if err != nil {
		h.writeProblem(w, r, statusForRequestError(err), &problemBody{Code: requestErrorCode(err), Message: err.Error()}, err)
		return
	}
	idempotencyKey, err := idempotencyKey(r)
	if err != nil {
		h.writeProblem(w, r, http.StatusBadRequest, &problemBody{Code: "invalid_argument", Message: err.Error()}, err)
		return
	}
	hookKey := chi.URLParam(r, "hookKey")
	if h.bridge != nil {
		ctx, prepareErr := h.bridge.Prepare(r, Invocation{HookKey: hookKey})
		if prepareErr != nil {
			h.writeProblem(w, r, http.StatusBadRequest, &problemBody{Code: "invalid_transport_credential", Message: "invalid authentication transport state"}, prepareErr)
			return
		}
		r = r.WithContext(ctx)
	}
	options := hooks.RunOptions{Version: request.Version, IdempotencyKey: idempotencyKey}
	var result hooks.Result
	result, err = h.runtime.Run(r.Context(), actor, hookKey, request.Input, options)
	if h.bridge != nil {
		h.bridge.Complete(w, r.Context())
	}
	if err != nil {
		status, body := runProblem(err)
		h.writeProblem(w, r, status, &body, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) decodeRequest(w http.ResponseWriter, r *http.Request) (runRequest, error) {
	var request runRequest
	if r.ContentLength > h.maxBodyBytes {
		return request, &requestError{tooLarge: true, message: "request body is too large"}
	}
	r.Body = http.MaxBytesReader(w, r.Body, h.maxBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		var maxBytes *http.MaxBytesError
		if errors.As(err, &maxBytes) {
			return request, &requestError{tooLarge: true, message: "request body is too large"}
		}
		return request, &requestError{message: "invalid request body"}
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return request, &requestError{message: "request body must contain one JSON value"}
	}
	if request.Version < 0 || (len(request.Input) > 0 && !json.Valid(request.Input)) {
		return request, &requestError{message: "invalid hook invocation"}
	}
	return request, nil
}

type requestError struct {
	tooLarge bool
	message  string
}

func (e *requestError) Error() string { return e.message }

func statusForRequestError(err error) int {
	var requestErr *requestError
	if errors.As(err, &requestErr) && requestErr.tooLarge {
		return http.StatusRequestEntityTooLarge
	}
	return http.StatusBadRequest
}

func requestErrorCode(err error) string {
	if statusForRequestError(err) == http.StatusRequestEntityTooLarge {
		return "payload_too_large"
	}
	return "invalid_argument"
}

func idempotencyKey(r *http.Request) (string, error) {
	values := r.Header.Values("Idempotency-Key")
	if len(values) > 1 {
		return "", fmt.Errorf("Idempotency-Key must occur at most once")
	}
	if len(values) == 0 {
		return "", nil
	}
	key := strings.TrimSpace(values[0])
	if key == "" || len(key) > 256 || strings.ContainsAny(key, "\x00\r\n") {
		return "", fmt.Errorf("invalid Idempotency-Key")
	}
	return key, nil
}

func runProblem(err error) (int, problemBody) {
	var runErr *hooks.RunError
	if !errors.As(err, &runErr) {
		return http.StatusInternalServerError, problemBody{Code: "internal", Message: "internal hook error"}
	}
	status := http.StatusInternalServerError
	switch runErr.Cause {
	case "invalid_argument":
		status = http.StatusBadRequest
	case "not_found":
		status = http.StatusNotFound
	case "permission_denied":
		status = http.StatusForbidden
	case "conflict", "failed_precondition":
		status = http.StatusConflict
	case "resource_exhausted":
		status = http.StatusTooManyRequests
	case "unavailable":
		status = http.StatusServiceUnavailable
	case "canceled":
		status = http.StatusRequestTimeout
	case "deadline_exceeded":
		status = http.StatusGatewayTimeout
	}
	return status, problemBody{Code: runErr.Code, Message: runErr.Message, ExecutionID: runErr.ExecutionID, FailedStep: runErr.FailedStep, Cause: runErr.Cause, Retryable: runErr.Retryable}
}

func (h *Handler) writeProblem(w http.ResponseWriter, r *http.Request, status int, body *problemBody, err error) {
	if status >= http.StatusInternalServerError {
		h.logger.ErrorContext(r.Context(), "hook HTTP request failed", slog.String("code", body.Code), slog.Any("error", err))
	}
	writeJSON(w, status, problemResponse{Error: *body})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	buffer := bytes.NewBuffer(nil)
	if err := json.NewEncoder(buffer).Encode(value); err != nil {
		http.Error(w, "internal response encoding error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(buffer.Bytes())
}
