package users

import (
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	r.Post("/register", RegisterHandler(db, aut))
	r.Post("/login", LoginHandler(db, aut))
	r.Post("/refresh", RefreshHandler(db, aut))
	r.Post("/logout", LogoutHandler(db, aut))
	r.Get("/getUserData", GetUserDataHandler(db, aut))
	r.Get("/getUsersNames", GetUsersHandler(db, aut))
	r.Post("/update_password", UpdateUserPasswordHandler(db, aut))
	r.Delete("/delete_user", DeleteUserHandler(db, aut))
}
