package httpapi

import (
	"MyServer/internal/vfs/v2"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
)

const (
	defaultMaxFileWriteBytes int64 = 32 << 20
	defaultMaxControlBytes   int64 = 1 << 20
	defaultMaxJSONBytes      int64 = 64 << 10
)

var (
	ErrInvalidConfiguration = errors.New("invalid HTTP VFS adapter configuration")
	ErrUnauthenticated      = errors.New("VFS actor is not authenticated")
)

type ActorResolver func(*http.Request) (v2.Actor, error)

type Limits struct {
	MaxFileWriteBytes int64
	MaxControlBytes   int64
	MaxJSONBytes      int64
}

func DefaultLimits() Limits {
	return Limits{
		MaxFileWriteBytes: defaultMaxFileWriteBytes,
		MaxControlBytes:   defaultMaxControlBytes,
		MaxJSONBytes:      defaultMaxJSONBytes,
	}
}

type Handler struct {
	frontend     v2.VFSFrontend
	resolveActor ActorResolver
	limits       Limits
	logger       *slog.Logger
}

func NewHandler(frontend v2.VFSFrontend, resolveActor ActorResolver, limits Limits, logger *slog.Logger) (*Handler, error) {
	if frontend == nil || resolveActor == nil || limits.MaxFileWriteBytes <= 0 || limits.MaxControlBytes <= 0 || limits.MaxJSONBytes <= 0 {
		return nil, ErrInvalidConfiguration
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Handler{
		frontend:     frontend,
		resolveActor: resolveActor,
		limits:       limits,
		logger:       logger,
	}, nil
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.NotFound(h.handleRouteNotFound)
	r.MethodNotAllowed(h.handleMethodNotAllowed)
	r.Get("/stat", h.handleStat)
	r.Get("/list", h.handleList)
	r.Get("/read", h.handleRead)
	r.Post("/file", h.handleCreateFile)
	r.Put("/file", h.handleReplaceFile)
	r.Post("/directory", h.handleCreateDirectory)
	r.Post("/move", h.handleMove)
	r.Delete("/resource", h.handleDelete)
	r.Post("/control", h.handleControl)
}

func (h *Handler) handleRouteNotFound(w http.ResponseWriter, r *http.Request) {
	h.writeError(w, r, requestProblem(http.StatusNotFound, "not_found", "HTTP endpoint not found", nil))
}

func (h *Handler) handleMethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	h.writeError(w, r, requestProblem(http.StatusMethodNotAllowed, "method_not_allowed", "HTTP method is not allowed", nil))
}
