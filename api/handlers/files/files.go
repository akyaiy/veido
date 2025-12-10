package files

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes регистрирует все маршруты /api/files/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	r.Get("/list", acl.RequirePermission(db, aut, "files.list", listHandler))
	r.Get("/download", acl.RequirePermission(db, aut, "files.download", downloadHandler))
	r.Post("/view", acl.RequirePermission(db, aut, "files.view", viewHandler))
	r.Post("/upload", acl.RequirePermission(db, aut, "files.upload", uploadHandler))
	r.Post("/mkdir", acl.RequirePermission(db, aut, "files.mkdir", mkdirHandler))
	r.Post("/delete", acl.RequirePermission(db, aut, "files.delete", deleteHandler))
}
