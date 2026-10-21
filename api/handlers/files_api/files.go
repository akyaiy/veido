package files_api

import (
	"MyServer/internal/auth"
	"MyServer/internal/shared"
	"MyServer/internal/vfs"
	"MyServer/internal/vfs/providers"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type FileHandler struct {
	Manager      vfs.FSManager
	MountManager providers.MountManagerFSProviderContract
	SharedManager *shared.SharedOPs
	auth         *auth.Auth
}

func NewFileHandler(manager vfs.FSManager, mountManager providers.MountManagerFSProviderContract, sharedManager *shared.SharedOPs, auth *auth.Auth) *FileHandler {
	return &FileHandler{
		Manager:      manager,
		MountManager: mountManager,
		SharedManager: sharedManager,
		auth:         auth,
	}
}

func RegisterRoutes(r chi.Router, h *FileHandler) {
	r.Route("/api/files/acc2fs", func(r chi.Router) {
		r.Get("/*", http.StripPrefix("/api/files/acc2fs", http.HandlerFunc(h.handleGet)).ServeHTTP)
		r.Post("/*", http.StripPrefix("/api/files/acc2fs", http.HandlerFunc(h.handlePost)).ServeHTTP)
		r.Patch("/*", http.StripPrefix("/api/files/acc2fs", http.HandlerFunc(h.handlePatch)).ServeHTTP)
		r.Delete("/*", http.StripPrefix("/api/files/acc2fs", http.HandlerFunc(h.handleDelete)).ServeHTTP)
	})

	r.Route("/api/files/mounts", func(r chi.Router) {
		r.Get("/", http.StripPrefix("/api/files/mounts", http.HandlerFunc(h.handleMountsGet)).ServeHTTP)
		r.Post("/", http.StripPrefix("/api/files/mounts", http.HandlerFunc(h.handleMountsPost)).ServeHTTP)
		r.Delete("/{mountPath}", http.StripPrefix("/api/files/mounts", http.HandlerFunc(h.handleMountsDelete)).ServeHTTP)
	})

	r.Route("/api/files/shared", func(r chi.Router) {
		r.Get("/", http.StripPrefix("/api/files/shared", http.HandlerFunc(h.handleSharedGet)).ServeHTTP)
		r.Post("/*", http.StripPrefix("/api/files/shared", http.HandlerFunc(h.handleSharedPost)).ServeHTTP)
		r.Delete("/*", http.StripPrefix("/api/files/shared", http.HandlerFunc(h.handleSharedDelete)).ServeHTTP)
	})
}
