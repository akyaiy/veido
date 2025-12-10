package users

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	// Публичные маршруты
	r.Post("/register", RegisterHandler(db, aut))
	r.Post("/login", LoginHandler(db, aut))
	r.Post("/refresh", RefreshHandler(db, aut))

	// Требует авторизации
	r.Post("/logout", acl.RequirePermission(db, aut, "users.logout", LogoutHandler(db, aut)))
	r.Get("/getUserData", acl.RequirePermission(db, aut, "users.read", GetUserDataHandler(db, aut)))

	// Более привилегированные действия
	r.Get("/getUsersNames", acl.RequirePermission(db, aut, "users.list", GetUsersHandler(db, aut)))
	r.Post("/update_password", acl.RequirePermission(db, aut, "users.update_password", UpdateUserPasswordHandler(db, aut)))
	r.Delete("/delete_user", acl.RequirePermission(db, aut, "users.delete", DeleteUserHandler(db, aut)))
}
