package users

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type UserRoutes struct {
	db *sql.DB
	auth *auth.Auth
}

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	h := UserRoutes{
		db: db,
		auth: aut,
	}
	
	r.Post("/register", acl.RequirePermission(db, aut, "auth.register", http.HandlerFunc(h.AuthRegister)))
	r.Post("/login", acl.RequirePermission(db, aut, "auth.login", http.HandlerFunc(h.AuthLogin)))
	r.Post("/refresh", http.HandlerFunc(h.AuthRefresh))
	r.Post("/logout", acl.RequirePermission(db, aut, "auth.logout", http.HandlerFunc(h.AuthLogout)))

	r.Route("/users", func(r chi.Router) {
		r.Get("/", acl.RequirePermission(db, aut, "auth.users.list", http.HandlerFunc(h.GetUsers)))
		r.Route("/me", func(r chi.Router) {
			r.Get("/", acl.RequirePermission(db, aut, "auth.users.self.read", http.HandlerFunc(h.GetMe)))
			r.Patch("/", acl.RequirePermission(db, aut, "auth.users.self.update", http.HandlerFunc(h.UpdateMe)))
			r.Patch("/password", acl.RequirePermission(db, aut, "auth.self.update_password", http.HandlerFunc(h.MeChangePassword)))
		})
	})

	r.Route("/admin/users", func(r chi.Router) {
		r.Get("/", acl.RequirePermission(db, aut, "auth.admin.users.list", http.HandlerFunc(h.AdminGetUsers)))
		r.Get("/{userId}", acl.RequirePermission(db, aut, "auth.admin.users.read", http.HandlerFunc(h.AdminGetUserByID)))
		r.Post("/", acl.RequirePermission(db, aut, "auth.admin.users.create", http.HandlerFunc(h.AdminCreateUser)))
		r.Patch("/{userId}", acl.RequirePermission(db, aut, "auth.admin.users.update", http.HandlerFunc(h.AdminUpdateUser)))
		r.Patch("/{userId}/password", acl.RequirePermission(db, aut, "auth.admin.users.update_password", http.HandlerFunc(h.AdminChangeUserPassword)))
		r.Delete("/{userId}", acl.RequirePermission(db, aut, "auth.admin.users.delete", http.HandlerFunc(h.AdminDeleteUser)))
	})
}
