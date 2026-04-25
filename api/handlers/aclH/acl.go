package aclH

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"MyServer/internal/server"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	h := AdminRoutes{
		db: db,
	}
	r.Route("/roles", func(r chi.Router) {
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, aut, "acl.roles.list.get", http.HandlerFunc(h.GetRoles)))
		r.Post("/", acl.RequirePermission(db, aut, "acl.roles.create", http.HandlerFunc(h.CreateRole)))
		r.Patch("/{roleId}", acl.RequirePermission(db, aut, "acl.roles.update", http.HandlerFunc(h.UpdateRole)))
		r.Delete("/{roleId}", acl.RequirePermission(db, aut, "acl.roles.delete", http.HandlerFunc(h.DeleteRole)))
		
		r.With(server.PaginationMiddleware).Get("/{roleId}/perms", acl.RequirePermission(db, aut, "acl.roles.permissions.list.get", http.HandlerFunc(h.GetRolePermissions)))
		r.Post("/{roleId}/perms", acl.RequirePermission(db, aut, "acl.permission.assign", http.HandlerFunc(h.AssignPermission)))
		r.Delete("/{roleId}/perms/{permId}", acl.RequirePermission(db, aut, "acl.permission.deassign", http.HandlerFunc(h.DeAssignPermission)))
	})
	
	r.With(server.PaginationMiddleware).Get("/users/{userId}/roles", acl.RequirePermission(db, aut, "acl.user.roles.list.get", http.HandlerFunc(h.GetUserRoles)))
	r.Post("/users/{userId}/roles", acl.RequirePermission(db, aut, "acl.user.roles.assign", http.HandlerFunc(h.AssignRole)))
	r.Delete("/users/{userId}/roles/{roleId}", acl.RequirePermission(db, aut, "acl.user.roles.deassign", http.HandlerFunc(h.DeAssignRole)))
	
	r.Route("/perms", func(r chi.Router) {
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, aut, "acl.permissions.list.get", http.HandlerFunc(h.GetPermissions)))
		r.Post("/", acl.RequirePermission(db, aut, "acl.permission.create", http.HandlerFunc(h.CreatePermission)))
		r.Patch("/{permId}", acl.RequirePermission(db, aut, "acl.permission.update", http.HandlerFunc(h.UpdatePermission)))
		r.Delete("/{permId}", acl.RequirePermission(db, aut, "acl.permission.delete", http.HandlerFunc(h.DeletePermission)))
	})
}