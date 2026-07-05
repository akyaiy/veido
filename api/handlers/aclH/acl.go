package aclH

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"MyServer/internal/server"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, auth *auth.Auth) {
	h := AdminRoutes{
		db: db,
		auth: auth,
	}
	r.Route("/roles", func(r chi.Router) {
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, "acl.roles.list.get", http.HandlerFunc(h.GetRoles)))
		r.Post("/", acl.RequirePermission(db, "acl.roles.create", http.HandlerFunc(h.CreateRole)))
		r.Patch("/{roleId}", acl.RequirePermission(db, "acl.roles.update", http.HandlerFunc(h.UpdateRole)))
		r.Delete("/{roleId}", acl.RequirePermission(db, "acl.roles.delete", http.HandlerFunc(h.DeleteRole)))
		
		r.With(server.PaginationMiddleware).Get("/{roleId}/perms", acl.RequirePermission(db, "acl.roles.permissions.list.get", http.HandlerFunc(h.GetRolePermissions)))
		r.Post("/{roleId}/perms", acl.RequirePermission(db, "acl.permission.assign", http.HandlerFunc(h.AssignPermission)))
		r.Delete("/{roleId}/perms/{permId}", acl.RequirePermission(db, "acl.permission.deassign", http.HandlerFunc(h.DeAssignPermission)))
	})
	
	r.Route("/users", func(r chi.Router) {
		r.Get("/{userId}/perms", acl.RequirePermission(db, "acl.user.permissions.list.get", http.HandlerFunc(h.CheckUserPermissions)))

		r.With(server.PaginationMiddleware).Get("/{userId}/roles", acl.RequirePermission(db, "acl.user.roles.list.get", http.HandlerFunc(h.GetUserRoles)))
		r.Post("/{userId}/roles", acl.RequirePermission(db, "acl.user.roles.assign", http.HandlerFunc(h.AssignRole)))
		r.Delete("/{userId}/roles/{roleId}", acl.RequirePermission(db, "acl.user.roles.deassign", http.HandlerFunc(h.DeAssignRole)))
	})

	r.Route("/me", func(r chi.Router) {
		r.Get("/perms", acl.RequirePermission(db, "acl.self.permissions.check", http.HandlerFunc(h.CheckMyPermissions)))
		r.Get("/roles", acl.RequirePermission(db, "acl.self.roles.get", http.HandlerFunc(h.GetMyRoles)))
	})
	
	r.Route("/perms", func(r chi.Router) {
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, "acl.permissions.list.get", http.HandlerFunc(h.GetPermissions)))
		r.Post("/", acl.RequirePermission(db, "acl.permission.create", http.HandlerFunc(h.CreatePermission)))
		r.Patch("/{permId}", acl.RequirePermission(db, "acl.permission.update", http.HandlerFunc(h.UpdatePermission)))
		r.Delete("/{permId}", acl.RequirePermission(db, "acl.permission.delete", http.HandlerFunc(h.DeletePermission)))
	})
}