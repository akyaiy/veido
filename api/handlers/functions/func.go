package functions

import (
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterUserRoutes регистрирует все маршруты /api/functions/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	//fmt.Printf("ЗапросЖ %v", r)
	r.Get("/source/*", sourceHandler)
	r.Post("/compile", compileHandler)
	r.Post("/save", writeSourceHandler)
	r.Post("/run/*", runHandler)
	r.Get("/list", listHandler)
}
