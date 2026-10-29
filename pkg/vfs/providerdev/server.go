// Package providerdev serves a single provider behind a real VFS core for
// local development. It uses a fixed developer actor and must bind to loopback.
package providerdev

import (
	"github.com/akyaiy/veido/internal/vfs/v2/adapters/httpapi"
	dav "github.com/akyaiy/veido/internal/vfs/v2/adapters/webdav"
	"github.com/akyaiy/veido/pkg/vfs"
	"github.com/akyaiy/veido/pkg/vfs/providersdk"
	"github.com/akyaiy/veido/pkg/vfs/providertest"
	"context"
	"encoding/json"
	"html/template"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"golang.org/x/net/webdav"
)

type Options struct {
	Connection vfs.ProviderConnection
	Info       providersdk.ProviderInfo
}
type Server struct {
	http.Handler
	Harness *providertest.Harness
}

func (s *Server) Close() error { return s.Harness.Close() }

func New(ctx context.Context, factory vfs.ProviderFactory, options Options) (*Server, error) {
	h, err := providertest.New(ctx, factory, providertest.Options{Connection: options.Connection})
	if err != nil {
		return nil, err
	}
	api, err := httpapi.NewHandler(h.Frontend, func(*http.Request) (vfs.Actor, error) { return h.Actor, nil }, httpapi.DefaultLimits(), nil)
	if err != nil {
		h.Close()
		return nil, err
	}
	davfs, err := dav.NewWebDAVAdapter(h.Frontend, h.Actor, h.URI("/"))
	if err != nil {
		h.Close()
		return nil, err
	}
	r := chi.NewRouter()
	r.Route("/api/v2/vfs", func(r chi.Router) { httpapi.RegisterRoutes(r, api) })
	davHandler := dav.TransactionalWrites(&webdav.Handler{Prefix: "/dav", FileSystem: davfs, LockSystem: webdav.NewMemLS()})
	r.Handle("/dav", davHandler)
	r.Handle("/dav/*", davHandler)
	r.Get("/_provider", func(w http.ResponseWriter, r *http.Request) {
		var routes []providersdk.RouteInfo
		if described, ok := h.Provider.(interface {
			Routes() []providersdk.RouteInfo
		}); ok {
			routes = described.Routes()
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(struct {
			Info   providersdk.ProviderInfo `json:"provider"`
			URI    vfs.URI                  `json:"uri"`
			Routes []providersdk.RouteInfo  `json:"routes,omitempty"`
		}{options.Info, h.URI("/"), routes})
	})
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = inspector.Execute(w, map[string]string{"Key": h.Connection.ProviderKey, "URI": string(h.URI("/")), "List": "/api/v2/vfs/list?uri=" + url.QueryEscape(string(h.URI("/")))})
	})
	return &Server{Handler: r, Harness: h}, nil
}

var inspector = template.Must(template.New("inspector").Parse(`<!doctype html><html lang="en"><meta charset="utf-8"><title>VFS provider development</title><style>body{font:17px system-ui;max-width:850px;margin:60px auto;padding:0 24px;line-height:1.6}code{background:#eee;padding:3px 6px}a{color:#1555bc}</style><h1>{{.Key}}</h1><p>Provider development server · fixed developer actor</p><p><code>{{.URI}}</code></p><ul><li><a href="{{.List}}">List the root through VFS</a></li><li><a href="/_provider">Routes, commands and configuration schema</a></li><li><a href="/dav/">WebDAV mount</a></li></ul><p>HTTP API: <code>/api/v2/vfs</code>. Provider calls pass through the VFS core. Keep this development server on loopback.</p></html>`))
