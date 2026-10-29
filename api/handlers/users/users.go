package users

import (
	"github.com/akyaiy/veido/internal/acl"
	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/internal/server"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type AuthRoutes struct {
	db *sql.DB
	auth *auth.Auth
}

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, auth *auth.Auth) {
	h := AuthRoutes{
		db: db,
		auth: auth,
	}
	// AUTH
	r.Post("/register", acl.RequirePermission(db, "auth.register", http.HandlerFunc(h.AuthRegister)))
	r.Route("/session", func(r chi.Router) {
		r.Post("/login", acl.RequirePermission(db, "auth.login", http.HandlerFunc(h.AuthLogin)))
		r.Post("/refresh", h.AuthRefresh)
		r.Post("/logout", acl.RequirePermission(db, "auth.logout", http.HandlerFunc(h.AuthLogout)))
	})

	r.Route("/me", func(r chi.Router) {
		r.Get("/", acl.RequirePermission(db, "auth.self.read", http.HandlerFunc(h.MeGet)))
		r.Patch("/", acl.RequirePermission(db, "auth.self.update", http.HandlerFunc(h.MeUpdate)))
		r.Patch("/password", acl.RequirePermission(db, "auth.self.update_password", http.HandlerFunc(h.MeUpdatePassword)))
	})

	// USERS
	r.Route("/users", func(r chi.Router) {
		r.Route("/admin", func(r chi.Router) {
			r.Post("/", acl.RequirePermission(db, "auth.admin.users.create", http.HandlerFunc(h.UsersAdminCreate)))
			r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, "auth.admin.users.list", http.HandlerFunc(h.UsersAdminList)))
			r.Get("/{id}", acl.RequirePermission(db, "auth.admin.users.read", http.HandlerFunc(h.UsersAdminRead)))
			r.Patch("/{id}", acl.RequirePermission(db, "auth.admin.users.update", http.HandlerFunc(h.UsersAdminUpdate)))
			r.Patch("/{id}/password", acl.RequirePermission(db, "auth.admin.users.update_password", http.HandlerFunc(h.UsersAdminUpdatePassword)))
			r.Delete("/{id}", acl.RequirePermission(db, "auth.admin.users.delete", http.HandlerFunc(h.UsersAdminDelete)))
		})
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, "auth.users.list", http.HandlerFunc(h.UsersList)))
		r.Get("/{id}", acl.RequirePermission(db, "auth.users.read", http.HandlerFunc(h.UsersRead)))
	})
}
