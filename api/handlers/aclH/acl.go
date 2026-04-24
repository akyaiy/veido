package aclH

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"
	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	r.Route("/roles", func(r chi.Router) {
		r.Get("/", acl.RequirePermission(db, aut, "acl.roles.list.get", GetRoles))
		r.Post("/", acl.RequirePermission(db, aut, "acl.roles.create", CreateRole))
		r.Patch("/{roleId}", acl.RequirePermission(db, aut, "acl.roles.update", UpdateRole))
		r.Delete("/{roleId}", acl.RequirePermission(db, aut, "acl.roles.delete", DeleteRole))
		// Возможно, временное решение: логичнее присваивать роль пользователю, а не пользователя роли.
		// Но для простоты архитектуры, пока что оставим так
		r.Post("/{roleId}/users/", acl.RequirePermission(db, aut, "acl.roles.assign", AssignRole))
		r.Delete("/{roleId}/users/{userId}", acl.RequirePermission(db, aut, "acl.roles.deassign", DeAssignRole))

		r.Post("/{roleId}/perms/", acl.RequirePermission(db, aut, "acl.permission.assign", AssignPermission))
		r.Delete("/{roleId}/perms/{permId}", acl.RequirePermission(db, aut, "acl.permission.deassign", DeAssignPermission))
	})
	r.Route("/perms", func(r chi.Router) {
		r.Get("/", acl.RequirePermission(db, aut, "acl.permissions.list.get", GetPermissions))
		r.Post("/", acl.RequirePermission(db, aut, "acl.permission.create", CreatePermission))
		r.Patch("/{permId}", acl.RequirePermission(db, aut, "acl.permission.update", UpdatePermission))
		r.Delete("/{permId}", acl.RequirePermission(db, aut, "acl.permission.delete", DeletePermission))
	})
}