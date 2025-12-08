package files

import (
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterUserRoutes регистрирует все маршруты /api/files/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	//fmt.Printf("ЗапросЖ %v", r)
	r.Get("/list", listHandler)
	r.Get("/download", downloadHandler)
	r.Post("/view", viewHandler)
	r.Post("/upload", uploadHandler)
	r.Post("/mkdir", mkdirHandler)
	r.Post("/delete", deleteHandler)
}
