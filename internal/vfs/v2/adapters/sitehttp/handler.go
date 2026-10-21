// Package sitehttp exposes one HTML site through its site-bound get-static
// hook. It never opens provider resources directly.
package sitehttp

import (
	"MyServer/internal/vfs/v2/providers/html/hooks/getpage"
	"MyServer/internal/vfs/v2/providers/html/hooks/getstatic"
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"bytes"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"html"
	"log/slog"
	"mime"
	"net/http"
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
	actor, err := h.resolveActor(r)
	if err != nil {
		h.writeProblem(w, r, http.StatusUnauthorized, "unauthenticated", "authentication is required", err)
		return
	}
	input, err := json.Marshal(getpage.Input{SiteURI: h.config.SiteURI, TemplateKey: h.config.TemplateKey, Path: r.URL.Path})
	if err != nil {
		h.writeProblem(w, r, http.StatusInternalServerError, "internal", "internal site error", err)
		return
	}
	result, err := h.runtime.Run(r.Context(), actor, getpage.HookKey, input, hooks.RunOptions{})
	if err != nil {
		status, code, message := hookProblem(err)
		h.writeProblem(w, r, status, code, message, err)
		return
	}
	var output getpage.Output
	expectedRoute := strings.TrimSuffix(r.URL.Path, "/")
	if err := json.Unmarshal(result.Output, &output); err != nil || output.Route != expectedRoute {
		h.writeProblem(w, r, http.StatusInternalServerError, "invalid_hook_output", "invalid get-page output", err)
		return
	}
	if !output.Found {
		if output.Code != getpage.NotFoundCode {
			h.writeProblem(w, r, http.StatusInternalServerError, "invalid_hook_output", "invalid get-page output", nil)
			return
		}
		h.writePageNotFound(w, r)
		return
	}
	if output.Bootstrap.Route != expectedRoute || output.Bootstrap.PageKey != output.PageKey || output.Bootstrap.SiteName == "" || output.Bootstrap.BundleRootURI == "" || output.ContentType == "" || output.ETag == "" || output.Size != int64(len(output.Content)) {
		h.writeProblem(w, r, http.StatusInternalServerError, "invalid_hook_output", "invalid get-page output", nil)
		return
	}
	content, err := embedBootstrap(output.Output, output.Bootstrap)
	if err != nil {
		h.writeProblem(w, r, http.StatusInternalServerError, "invalid_hook_output", "get-page entrypoint cannot carry bootstrap data", err)
		return
	}
	h.writeContent(w, r, content)
}

func embedBootstrap(output getstatic.Output, bootstrap getpage.Bootstrap) (getstatic.Output, error) {
	marker := []byte("</head>")
	index := bytes.Index(output.Content, marker)
	if index < 0 {
		return getstatic.Output{}, errors.New("entrypoint has no closing head element")
	}
	data, err := json.Marshal(bootstrap)
	if err != nil {
		return getstatic.Output{}, err
	}
	tag := make([]byte, 0, len(data)+80)
	tag = append(tag, []byte(`<script id="html-page-bootstrap" type="application/json">`)...)
	tag = append(tag, data...)
	tag = append(tag, []byte("</script>\n")...)
	content := make([]byte, 0, len(output.Content)+len(tag))
	content = append(content, output.Content[:index]...)
	content = append(content, tag...)
	content = append(content, output.Content[index:]...)
	digest := sha256.Sum256(content)
	output.Content = content
	output.Size = int64(len(content))
	output.Digest = hex.EncodeToString(digest[:])
	output.ETag = `"sha256-` + output.Digest + `"`
	return output, nil
}

func (h *Handler) writePageNotFound(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Vary", "Accept")
	if !acceptsHTML(r.Header.Get("Accept")) {
		h.writeProblem(w, r, http.StatusNotFound, "page_not_found", "page not found", nil)
		return
	}
	body := `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 — Страница не найдена</title></head>
<body><main><h1>Страница не найдена</h1><p>Путь <code>` + html.EscapeString(r.URL.Path) + `</code> не существует.</p><p><a href="/">На главную</a></p></main></body>
</html>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusNotFound)
	if _, err := w.Write([]byte(body)); err != nil {
		h.logger.ErrorContext(r.Context(), "site not-found response failed", slog.Any("error", err))
	}
}

func acceptsHTML(accept string) bool {
	var htmlQuality, jsonQuality float64 = -1, -1
	for _, item := range strings.Split(accept, ",") {
		mediaType, params, err := mime.ParseMediaType(strings.TrimSpace(item))
		if err != nil {
			continue
		}
		quality := 1.0
		if raw := params["q"]; raw != "" {
			parsed, err := strconv.ParseFloat(raw, 64)
			if err != nil || parsed < 0 || parsed > 1 {
				continue
			}
			quality = parsed
		}
		switch strings.ToLower(mediaType) {
		case "text/html", "application/xhtml+xml":
			if quality > htmlQuality {
				htmlQuality = quality
			}
		case "application/json", "application/problem+json":
			if quality > jsonQuality {
				jsonQuality = quality
			}
		}
	}
	return htmlQuality > 0 && htmlQuality >= jsonQuality
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
