package serverapp

import (
	"MyServer/internal/auth"
	vfs "MyServer/internal/vfs/v2"
	authapi "MyServer/internal/vfs/v2/adapters/authapi"
	hookapi "MyServer/internal/vfs/v2/adapters/hookapi"
	httpapi "MyServer/internal/vfs/v2/adapters/httpapi"
	sitehttp "MyServer/internal/vfs/v2/adapters/sitehttp"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func newRouter(cfg Config, service *auth.Auth, vfsHandler *httpapi.Handler, hooks *hookapi.Handler, authAPI *authapi.Handler, site *sitehttp.Handler, publicSite *sitehttp.PublicHandler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.Recoverer, middleware.Logger)
	r.Use(actorMiddleware(cfg, service))
	r.Use(middleware.Timeout(cfg.HTTP.WriteTimeout))
	r.Get("/health/live", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	r.Get("/health/ready", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	r.Route("/api/v2/vfs", func(v chi.Router) {
		v.Use(httpapi.AuthenticatedOnly)
		httpapi.RegisterRoutes(v, vfsHandler)
		hookapi.RegisterRoutes(v, hooks)
	})
	r.Route("/api/v2/auth", func(a chi.Router) { authapi.RegisterRoutes(a, authAPI) })
	r.Route("/api/v2/site", func(s chi.Router) { sitehttp.RegisterPublicRoutes(s, publicSite) })
	// The site adapter owns browser GET routes only. API routes above remain
	// explicit and never fall through to the page renderer.
	sitehttp.RegisterRoutes(r, site)
	return r
}
func actorResolver(r *http.Request) (vfs.Actor, error) {
	actor, ok := vfs.ActorFromContext(r.Context())
	if !ok || actor.ID == "" {
		return vfs.Actor{}, errors.New("trusted actor is missing")
	}
	return actor, nil
}
func actorMiddleware(cfg Config, service *auth.Auth) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if raw := strings.TrimSpace(r.Header.Get("Authorization")); raw != "" {
				claims, err := service.AuthenticateRequest(r)
				if err != nil {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}
				id, err := claims.GetSubject()
				if err != nil {
					http.Error(w, "Unauthorized", 401)
					return
				}
				if _, err := strconv.ParseInt(id, 10, 64); err != nil {
					http.Error(w, "Unauthorized", 401)
					return
				}
				ctx := auth.ContextWithPrincipal(r.Context(), auth.Principal{UserID: mustInt64(id), SessionID: claims.SessionID})
				next.ServeHTTP(w, r.WithContext(vfs.ContextWithActor(ctx, vfs.Actor{Kind: vfs.ActorUser, ID: id})))
				return
			}
			// Guest identity is stateless; authenticated session identity comes
			// exclusively from a verified JWT, never from an anonymous cookie.
			next.ServeHTTP(w, r.WithContext(vfs.ContextWithActor(r.Context(), vfs.Actor{Kind: vfs.ActorGuest, ID: "anonymous"})))
		})
	}
}
func mustInt64(s string) int64 { n, _ := strconv.ParseInt(s, 10, 64); return n }
func cookieSameSite(value string) http.SameSite {
	switch value {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
