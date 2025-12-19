package aclH

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"

	"github.com/go-chi/chi/v5"
)

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	h := &AdminRoutes{DB: db, Aut: aut}

	//	r.Post("/register", acl.RequirePermission(db, aut, "users.register", RegisterHandler(db, aut)))

	r.Get("/roles", acl.RequirePermission(db, aut, "acl.roles", h.GetRoles))
	r.Post("/create-role", acl.RequirePermission(db, aut, "acl.create_role", h.CreateRole))
	r.Post("/assign-role", acl.RequirePermission(db, aut, "acl.assign_role", h.AssignRoleToUser))
	r.Get("/user-roles", acl.RequirePermission(db, aut, "acl.user_roles", h.GetUserRoles))
	r.Post("/remove-role", acl.RequirePermission(db, aut, "acl.remove_role", h.RemoveRoleFromUser))

	r.Get("/permissions", acl.RequirePermission(db, aut, "acl.permissions", h.GetPermissions))
	r.Post("/create-permission", acl.RequirePermission(db, aut, "acl.create_permission", h.CreatePermission))
	r.Post("/assign-permission", acl.RequirePermission(db, aut, "acl.assign_permission", h.AssignPermissionToRole))
	r.Get("/role-permissions", acl.RequirePermission(db, aut, "acl.role_permissions", h.GetRolePermissions))
	r.Post("/remove-permission", acl.RequirePermission(db, aut, "acl.remove_permission", h.RemovePermissionFromRole))
}
