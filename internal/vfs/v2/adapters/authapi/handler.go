// Package authapi exposes the fixed public authentication surface.
package authapi

import (
	"github.com/akyaiy/veido/internal/auth/vfshooks"
	"github.com/akyaiy/veido/internal/vfs/v2"
	"github.com/akyaiy/veido/internal/vfs/v2/adapters/hookapi"
	"github.com/akyaiy/veido/pkg/vfs/hooks"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type ActorResolver func(*http.Request) (v2.Actor, error)

type Handler struct {
	runtime hooks.Runtime
	resolve ActorResolver
	bridge  hookapi.TransportBridge
}

func NewHandler(runtime hooks.Runtime, resolve ActorResolver, bridge hookapi.TransportBridge) (*Handler, error) {
	if runtime == nil || resolve == nil {
		return nil, errors.New("invalid auth HTTP adapter configuration")
	}
	return &Handler{runtime: runtime, resolve: resolve, bridge: bridge}, nil
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/register", h.run(vfshooks.HookRegister))
	r.Post("/login", h.run(vfshooks.HookLogin))
	r.Post("/refresh", h.run(vfshooks.HookRefresh))
	r.Post("/logout", h.run(vfshooks.HookLogout))
	r.Post("/change-password", h.run(vfshooks.HookChangePassword))
	r.Post("/revoke-sessions", h.run(vfshooks.HookRevokeSessions))
}

func (h *Handler) run(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, err := h.resolve(r)
		if err != nil {
			writeProblem(w, http.StatusUnauthorized, "unauthenticated", "authentication is required")
			return
		}
		var input json.RawMessage
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256<<10))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil || !json.Valid(input) {
			writeProblem(w, http.StatusBadRequest, "invalid_argument", "invalid request body")
			return
		}
		var extra any
		if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
			writeProblem(w, http.StatusBadRequest, "invalid_argument", "request body must contain one JSON value")
			return
		}
		if h.bridge != nil {
			ctx, err := h.bridge.Prepare(r, hookapi.Invocation{HookKey: key})
			if err != nil {
				writeProblem(w, http.StatusBadRequest, "invalid_transport_credential", "invalid authentication transport state")
				return
			}
			r = r.WithContext(ctx)
		}
		result, err := h.runtime.Run(r.Context(), actor, key, input, hooks.RunOptions{})
		if h.bridge != nil {
			h.bridge.Complete(w, r.Context())
		}
		if err != nil {
			writeRunProblem(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(result.Output)
	}
}

func writeRunProblem(w http.ResponseWriter, err error) {
	var runErr *hooks.RunError
	if !errors.As(err, &runErr) {
		writeProblem(w, http.StatusInternalServerError, "internal", "authentication operation failed")
		return
	}
	status := http.StatusInternalServerError
	switch runErr.Cause {
	case "invalid_argument":
		status = http.StatusBadRequest
	case "not_found", "permission_denied":
		status = http.StatusNotFound
	case "conflict", "failed_precondition":
		status = http.StatusConflict
	case "resource_exhausted":
		status = http.StatusTooManyRequests
	case "unavailable":
		status = http.StatusServiceUnavailable
	}
	writeProblem(w, status, runErr.Code, runErr.Message)
}

func writeProblem(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": code, "message": message}})
}
