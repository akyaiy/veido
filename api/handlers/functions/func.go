package functions

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes регистрирует все маршруты /api/functions/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	// Примеры маршрутов с ACL
	r.Get("/source/*", acl.RequirePermission(db, aut, "functions.read", http.HandlerFunc(sourceHandler)))
	r.Post("/compile", acl.RequirePermission(db, aut, "functions.compile", http.HandlerFunc(compileHandler)))
	r.Post("/save", acl.RequirePermission(db, aut, "functions.save", http.HandlerFunc(writeSourceHandler)))
	r.Post("/run/*", acl.RequirePermission(db, aut, "functions.run", http.HandlerFunc(runHandler)))
	r.Get("/list", acl.RequirePermission(db, aut, "functions.list", http.HandlerFunc(listHandler)))
}
