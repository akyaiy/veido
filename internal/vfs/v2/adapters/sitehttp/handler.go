// Package sitehttp exposes one HTML site through its site-bound get-static
// hook. It never opens provider resources directly.
package sitehttp

import (
	"MyServer/internal/vfs/v2/providers/html/hooks/getstatic"
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

var ErrInvalidConfiguration = errors.New("invalid site HTTP adapter configuration")

type ActorResolver func(*http.Request) (vfs.Actor, error)

type Config struct {
	SiteURI     vfs.URI
	Entrypoint  string
	TemplateKey string
	Frontend    vfs.Frontend
}

type Handler struct {
	runtime      hooks.Runtime
	resolveActor ActorResolver
	config       Config
	logger       *slog.Logger
}

func NewHandler(runtime hooks.Runtime, resolveActor ActorResolver, config Config, logger *slog.Logger) (*Handler, error) {
	if config.TemplateKey == "" {
		config.TemplateKey = "default-spa"
	}
	if runtime == nil || resolveActor == nil || config.SiteURI == "" || config.Entrypoint == "" || path.Clean(config.Entrypoint) != config.Entrypoint || strings.HasPrefix(config.Entrypoint, "/") {
		return nil, ErrInvalidConfiguration
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Handler{runtime: runtime, resolveActor: resolveActor, config: config, logger: logger}, nil
}

func RegisterRoutes(router chi.Router, handler *Handler) {
	router.Get("/", handler.handleRoot)
	router.Get("/_static", handler.handleMissingStatic)
	router.Get("/_static/*", handler.handleStatic)
	router.Get("/*", handler.handlePage)
}

func (h *Handler) handleRoot(w http.ResponseWriter, r *http.Request) {
	if !h.resolveRoute(w, r) {
		return
	}
	h.serveStatic(w, r, h.config.Entrypoint)
}

func (h *Handler) handleStatic(w http.ResponseWriter, r *http.Request) {
	assetPath := chi.URLParam(r, "*")
	if assetPath == "" {
		h.writeProblem(w, r, http.StatusNotFound, "not_found", "static asset not found", nil)
		return
	}
	h.serveStatic(w, r, assetPath)
}

func (h *Handler) handleMissingStatic(w http.ResponseWriter, r *http.Request) {
	h.writeProblem(w, r, http.StatusNotFound, "not_found", "static asset not found", nil)
}

func (h *Handler) serveStatic(w http.ResponseWriter, r *http.Request, assetPath string) {
	actor, err := h.resolveActor(r)
	if err != nil {
		h.writeProblem(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required", err)
		return
	}
	input, err := json.Marshal(getstatic.Input{SiteURI: h.config.SiteURI, TemplateKey: h.config.TemplateKey, Path: assetPath})
	if err != nil {
		h.writeProblem(w, r, http.StatusInternalServerError, "internal", "internal site error", err)
		return
	}
	result, err := h.runtime.Run(r.Context(), actor, getstatic.HookKey, input, hooks.RunOptions{})
	if err != nil {
		status, code, message := hookProblem(err)
		h.writeProblem(w, r, status, code, message, err)
		return
	}
	var output getstatic.Output
	if err := json.Unmarshal(result.Output, &output); err != nil || output.ContentType == "" || output.ETag == "" || output.Size != int64(len(output.Content)) {
		h.writeProblem(w, r, http.StatusInternalServerError, "invalid_hook_output", "invalid get-static output", err)
		return
	}
	h.writeContent(w, r, output)
}

func (h *Handler) handlePage(w http.ResponseWriter, r *http.Request) {
	if !h.resolveRoute(w, r) {
		return
	}
	h.serveStatic(w, r, h.config.Entrypoint)
}

// resolveRoute uses the same actor-filtered tree that backs the public Site
// API. A nil Frontend preserves the standalone static adapter used by tools.
func (h *Handler) resolveRoute(w http.ResponseWriter, r *http.Request) bool {
	if h.config.Frontend == nil {
		return true
	}
	actor, err := h.resolveActor(r)
	if err != nil {
		h.writeProblem(w, r, http.StatusNotFound, "not_found", "page not found", err)
		return false
	}
	treeURI, err := siteURI(h.config.SiteURI, "/tree.json")
	if err != nil {
		h.writeProblem(w, r, http.StatusInternalServerError, "internal", "internal site error", err)
		return false
	}
	file, err := h.config.Frontend.OpenFile(r.Context(), actor, treeURI, os.O_RDONLY)
	if err != nil {
		h.routeError(w, r, err)
		return false
	}
	data, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		h.routeError(w, r, readErr)
		return false
	}
	if closeErr != nil {
		h.routeError(w, r, closeErr)
		return false
	}
	var tree struct {
		Pages []routePage `json:"pages"`
	}
	if err := json.Unmarshal(data, &tree); err != nil {
		h.writeProblem(w, r, http.StatusInternalServerError, "internal", "invalid site tree", err)
		return false
	}
	requestPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/"), "/")
	if routeMatches(tree.Pages, strings.Split(requestPath, "/")) {
		return true
	}
	h.writeProblem(w, r, http.StatusNotFound, "not_found", "page not found", nil)
	return false
}

type routePage struct {
	Slug     string      `json:"slug"`
	Children []routePage `json:"children"`
}

func routeMatches(pages []routePage, segments []string) bool {
	if len(segments) == 1 && segments[0] == "" {
		return len(pages) > 0
	}
	if len(segments) == 0 {
		return len(pages) > 0
	}
	for _, page := range pages {
		if page.Slug == segments[0] {
			return len(segments) == 1 || routeMatches(page.Children, segments[1:])
		}
	}
	return false
}
func (h *Handler) routeError(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, os.ErrNotExist) || errors.Is(err, vfs.ErrNotFound) || errors.Is(err, vfs.ErrPermissionDenied) {
		h.writeProblem(w, r, http.StatusNotFound, "not_found", "page not found", err)
		return
	}
	h.writeProblem(w, r, http.StatusInternalServerError, "internal", "internal site error", err)
}
func siteURI(base vfs.URI, resourcePath string) (vfs.URI, error) {
	return (vfs.ResourceAddress{ProviderKey: base.Provider(), ConnectionKey: base.ConnectionKey(), ScopeKey: base.ScopeKey(), Path: resourcePath}).URI()
}

func (h *Handler) writeContent(w http.ResponseWriter, r *http.Request, output getstatic.Output) {
	if match := r.Header.Get("If-None-Match"); match != "" && subtle.ConstantTimeCompare([]byte(match), []byte(output.ETag)) == 1 {
		w.Header().Set("ETag", output.ETag)
		w.Header().Set("Cache-Control", output.CacheControl)
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", output.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(output.Size, 10))
	w.Header().Set("ETag", output.ETag)
	w.Header().Set("Cache-Control", output.CacheControl)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(output.Content); err != nil {
		h.logger.ErrorContext(r.Context(), "site response failed", slog.Any("error", err))
	}
}

func hookProblem(err error) (int, string, string) {
	var runErr *hooks.RunError
	if !errors.As(err, &runErr) {
		return http.StatusInternalServerError, "internal", "internal site error"
	}
	switch runErr.Cause {
	case "invalid_argument":
		return http.StatusBadRequest, runErr.Code, runErr.Message
	case "not_found":
		return http.StatusNotFound, runErr.Code, runErr.Message
	case "permission_denied":
		return http.StatusForbidden, runErr.Code, runErr.Message
	case "conflict", "failed_precondition":
		return http.StatusConflict, runErr.Code, runErr.Message
	case "resource_exhausted":
		return http.StatusRequestEntityTooLarge, runErr.Code, runErr.Message
	case "unavailable":
		return http.StatusServiceUnavailable, runErr.Code, runErr.Message
	case "deadline_exceeded":
		return http.StatusGatewayTimeout, runErr.Code, runErr.Message
	case "canceled":
		return http.StatusRequestTimeout, runErr.Code, runErr.Message
	default:
		return http.StatusInternalServerError, runErr.Code, runErr.Message
	}
}

func (h *Handler) writeProblem(w http.ResponseWriter, r *http.Request, status int, code, message string, err error) {
	if status >= http.StatusInternalServerError {
		h.logger.ErrorContext(r.Context(), "site request failed", slog.String("code", code), slog.Any("error", err))
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": code, "message": message}})
}
