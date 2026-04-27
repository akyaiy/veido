package users

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"MyServer/internal/server"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

type AuthRoutes struct {
	db *sql.DB
	auth *auth.Auth
}

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	h := AuthRoutes{
		db: db,
		auth: aut,
	}
	// AUTH
	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", acl.RequirePermission(db, aut, "auth.register", h.AuthRegister))
		r.Post("/login", acl.RequirePermission(db, aut, "auth.login", h.AuthLogin))
		r.Post("/refresh", h.AuthRefresh)
		r.Post("/logout", acl.RequirePermission(db, aut, "auth.logout", h.AuthLogout))
	})

	r.Route("/me", func(r chi.Router) {
		r.Get("/", acl.RequirePermission(db, aut, "auth.self.read", h.MeGet))
		r.Patch("/", acl.RequirePermission(db, aut, "auth.self.update", h.MeUpdate))
		r.Patch("/password", acl.RequirePermission(db, aut, "auth.self.update_password", h.MeUpdatePassword))
	})

	// USERS
	r.Route("/users", func(r chi.Router) {
		r.Route("/admin", func(r chi.Router) {
			r.Post("/", acl.RequirePermission(db, aut, "auth.admin.users.create", h.UsersAdminCreate))
			r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, aut, "auth.admin.users.list", h.UsersAdminList))
			r.Get("/{id}", acl.RequirePermission(db, aut, "auth.admin.users.read", h.UsersAdminRead))
			r.Patch("/{id}", acl.RequirePermission(db, aut, "auth.admin.users.update", h.UsersAdminUpdate))
			r.Patch("/{id}/password", acl.RequirePermission(db, aut, "auth.admin.users.update_password", h.UsersAdminUpdatePassword))
			r.Delete("/{id}", acl.RequirePermission(db, aut, "auth.admin.users.delete", h.UsersAdminDelete))
		})
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, aut, "auth.users.list", h.UsersList))
		r.Get("/{id}", acl.RequirePermission(db, aut, "auth.users.read", h.UsersRead))
	})
}
