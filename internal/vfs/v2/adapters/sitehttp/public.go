package sitehttp

import (
	"github.com/akyaiy/veido/internal/common"
	"github.com/akyaiy/veido/internal/vfs/v2"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/go-chi/chi/v5"
)

// PublicHandler exposes only site views. It keeps provider metadata and all
// canonical URIs on the server side.
type PublicHandler struct {
	frontend     v2.VFSFrontend
	resolveActor ActorResolver
	siteURI      common.CanonURI
}

func NewPublicHandler(frontend v2.VFSFrontend, resolveActor ActorResolver, siteURI common.CanonURI) (*PublicHandler, error) {
	if frontend == nil || resolveActor == nil || siteURI == "" {
		return nil, ErrInvalidConfiguration
	}
	return &PublicHandler{frontend: frontend, resolveActor: resolveActor, siteURI: siteURI}, nil
}

func RegisterPublicRoutes(r chi.Router, h *PublicHandler) {
	r.Get("/tree", h.tree)
	r.Get("/pages/{pageKey}", h.page)
	r.Get("/blocks/{blockKey}", h.block)
}

func (h *PublicHandler) tree(w http.ResponseWriter, r *http.Request) {
	h.writeFileJSON(w, r, "/tree.json")
}

func (h *PublicHandler) page(w http.ResponseWriter, r *http.Request) {
	h.bundle(w, r, "/pages/"+chi.URLParam(r, "pageKey")+"/info.json", "page_key")
}
func (h *PublicHandler) block(w http.ResponseWriter, r *http.Request) {
	h.bundle(w, r, "/blocks/"+chi.URLParam(r, "blockKey")+"/meta.json", "block_key")
}

func (h *PublicHandler) bundle(w http.ResponseWriter, r *http.Request, metadataPath, keyField string) {
	key := strings.TrimSuffix(strings.TrimPrefix(metadataPath, "/pages/"), "/info.json")
	if keyField == "block_key" {
		key = strings.TrimSuffix(strings.TrimPrefix(metadataPath, "/blocks/"), "/meta.json")
	}
	if !safeKey(key) {
		h.notFound(w)
		return
	}
	actor, ok := h.actor(w, r)
	if !ok {
		return
	}
	metadata, err := h.read(r, actor, h.sitePath(metadataPath))
	if err != nil {
		h.viewError(w, err)
		return
	}
	var source struct {
		BundleRootURI string `json:"bundle_root_uri"`
		PageKey       string `json:"page_key"`
		BlockKey      string `json:"block_key"`
	}
	if json.Unmarshal(metadata, &source) != nil || source.BundleRootURI == "" || (keyField == "page_key" && source.PageKey != key) || (keyField == "block_key" && source.BlockKey != key) {
		h.notFound(w)
		return
	}
	root, err := v2URI(source.BundleRootURI)
	if err != nil {
		h.notFound(w)
		return
	}
	files := map[string]string{}
	for _, name := range []string{"content.md", "style.css", "script.js"} {
		data, err := h.read(r, actor, common.CanonURI(string(root)+"/"+name))
		if err != nil {
			// Content blocks deliberately contain only content.md.
			if keyField == "block_key" && name != "content.md" && isNotFound(err) {
				continue
			}
			h.viewError(w, err)
			return
		}
		files[name] = string(data)
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"key": key, "files": files})
}

func (h *PublicHandler) writeFileJSON(w http.ResponseWriter, r *http.Request, sitePath string) {
	actor, ok := h.actor(w, r)
	if !ok {
		return
	}
	data, err := h.read(r, actor, h.sitePath(sitePath))
	if err != nil {
		h.viewError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(data)
}
func (h *PublicHandler) actor(w http.ResponseWriter, r *http.Request) (v2.Actor, bool) {
	actor, err := h.resolveActor(r)
	if err != nil {
		h.notFound(w)
		return v2.Actor{}, false
	}
	return actor, true
}
func (h *PublicHandler) sitePath(p string) common.CanonURI {
	return common.CanonURI(strings.TrimSuffix(string(h.siteURI), "/") + p)
}
func (h *PublicHandler) read(r *http.Request, actor v2.Actor, uri common.CanonURI) ([]byte, error) {
	f, err := h.frontend.OpenFile(r.Context(), actor, uri, os.O_RDONLY)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}
func (h *PublicHandler) notFound(w http.ResponseWriter) { http.NotFound(w, nil) }
func (h *PublicHandler) viewError(w http.ResponseWriter, err error) {
	if isNotFound(err) || errors.Is(err, v2.ErrPermissionDenied) {
		h.notFound(w)
		return
	}
	http.Error(w, "internal site error", http.StatusInternalServerError)
}
func isNotFound(err error) bool {
	return errors.Is(err, os.ErrNotExist) || errors.Is(err, v2.ErrNotFound)
}
func v2URI(raw string) (common.CanonURI, error) { return common.CastURI(raw) }

func safeKey(key string) bool {
	return key != "" && key == strings.TrimSpace(key) && key != "." && key != ".." && !strings.ContainsAny(key, "/\\\x00{}*") && path.Clean(key) == key
}
