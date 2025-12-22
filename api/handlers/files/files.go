package files

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes регистрирует все маршруты /api/files/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	r.Get("/list", acl.RequirePermission(db, aut, "files.list", http.HandlerFunc(listHandler)))
	r.Get("/download", acl.RequirePermission(db, aut, "files.download", http.HandlerFunc(downloadHandler)))
	r.Post("/view", acl.RequirePermission(db, aut, "files.view", http.HandlerFunc(viewHandler)))
	r.Post("/upload", acl.RequirePermission(db, aut, "files.upload", http.HandlerFunc(uploadHandler)))
	r.Post("/mkdir", acl.RequirePermission(db, aut, "files.mkdir", http.HandlerFunc(mkdirHandler)))
	r.Post("/delete", acl.RequirePermission(db, aut, "files.delete", http.HandlerFunc(deleteHandler)))
}
