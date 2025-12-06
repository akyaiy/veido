package functions

import (
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	//fmt.Printf("ЗапросЖ %v", r)
	r.Get("/source/*", sourceHandler)
	r.Post("/compile", compileHandler)
	r.Post("/save", writeSourceHandler)
	r.Post("/run/*", runHandler)
	r.Get("/list", listHandler)
}

/***

http.HandleFunc("/source/", sourceHandler)
http.HandleFunc("/compile", compileHandler)
http.HandleFunc("/functions/", runHandler)
http.HandleFunc("/list", listHandler)


*/
