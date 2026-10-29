package aclH

import (
	"github.com/akyaiy/veido/internal/acl"
	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/internal/server"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, auth *auth.Auth) {
	h := AdminRoutes{
		db: db,
		auth: auth,
	}
	r.Route("/groups", func(r chi.Router) {
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, "acl.groups.list.get", http.HandlerFunc(h.GetGroups)))
		r.Post("/", acl.RequirePermission(db, "acl.groups.create", http.HandlerFunc(h.CreateGroup)))
		r.Patch("/{groupId}", acl.RequirePermission(db, "acl.groups.update", http.HandlerFunc(h.UpdateGroup)))
		r.Delete("/{groupId}", acl.RequirePermission(db, "acl.groups.delete", http.HandlerFunc(h.DeleteGroup)))
		
		r.With(server.PaginationMiddleware).Get("/{groupId}/perms", acl.RequirePermission(db, "acl.groups.permissions.list.get", http.HandlerFunc(h.GetGroupPermissions)))
		r.Post("/{groupId}/perms", acl.RequirePermission(db, "acl.permission.assign", http.HandlerFunc(h.AssignPermission)))
		r.Delete("/{groupId}/perms/{permId}", acl.RequirePermission(db, "acl.permission.deassign", http.HandlerFunc(h.DeAssignPermission)))
	})
	
	r.Route("/users", func(r chi.Router) {
		r.Get("/{userId}/perms", acl.RequirePermission(db, "acl.user.permissions.list.get", http.HandlerFunc(h.CheckUserPermissions)))

		r.With(server.PaginationMiddleware).Get("/{userId}/groups", acl.RequirePermission(db, "acl.user.groups.list.get", http.HandlerFunc(h.GetUserGroups)))
		r.Post("/{userId}/groups", acl.RequirePermission(db, "acl.user.groups.assign", http.HandlerFunc(h.AssignGroup)))
		r.Delete("/{userId}/groups/{groupId}", acl.RequirePermission(db, "acl.user.groups.deassign", http.HandlerFunc(h.DeAssignGroup)))
	})

	r.Route("/me", func(r chi.Router) {
		r.Get("/perms", acl.RequirePermission(db, "acl.self.permissions.check", http.HandlerFunc(h.CheckMyPermissions)))
		r.Get("/groups", acl.RequirePermission(db, "acl.self.groups.get", http.HandlerFunc(h.GetMyGroups)))
	})
	
	r.Route("/perms", func(r chi.Router) {
		r.With(server.PaginationMiddleware).Get("/", acl.RequirePermission(db, "acl.permissions.list.get", http.HandlerFunc(h.GetPermissions)))
		r.Post("/", acl.RequirePermission(db, "acl.permission.create", http.HandlerFunc(h.CreatePermission)))
		r.Patch("/{permId}", acl.RequirePermission(db, "acl.permission.update", http.HandlerFunc(h.UpdatePermission)))
		r.Delete("/{permId}", acl.RequirePermission(db, "acl.permission.delete", http.HandlerFunc(h.DeletePermission)))
	})
}