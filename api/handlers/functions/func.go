package functions

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)
// RegisterRoutes регистрирует все маршруты /api/functions/*
func RegisterRoutes(r chi.Router, db *sql.DB, _ *auth.Auth) {
	r.Get("/source/*", acl.RequirePermission(db, "functions.read", http.HandlerFunc(sourceHandler)))
	r.Post("/compile", acl.RequirePermission(db, "functions.compile", http.HandlerFunc(compileHandler)))
	r.Post("/save", acl.RequirePermission(db, "functions.save", http.HandlerFunc(writeSourceHandler)))
	r.Post("/run/*", acl.RequirePermission(db, "functions.run", http.HandlerFunc(runHandler)))
	r.Get("/list", acl.RequirePermission(db, "functions.list", http.HandlerFunc(listHandler)))
}
