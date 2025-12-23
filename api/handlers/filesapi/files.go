package filesapi

import (
	//"MyServer/internal/acl"
	//"MyServer/internal/auth"
	//"database/sql"
	//"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes регистрирует все маршруты /api/files/*
// -------------------- REGISTER --------------------
func RegisterRoutes(r chi.Router) {
	r.HandleFunc("/*", FilesHandler)
}
