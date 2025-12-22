package aclH

import (
	"MyServer/internal/acl"
	"MyServer/internal/auth"
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterUserRoutes регистрирует все маршруты /api/users/*
func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	h := &AdminRoutes{DB: db, Aut: aut}

	//	r.Post("/register", acl.RequirePermission(db, aut, "users.register", RegisterHandler(db, aut)))

	r.Get("/roles", acl.RequirePermission(db, aut, "acl.roles", http.HandlerFunc(h.GetRoles)))
	r.Post("/create-role", acl.RequirePermission(db, aut, "acl.create_role", http.HandlerFunc(h.CreateRole)))
	r.Post("/assign-role", acl.RequirePermission(db, aut, "acl.assign_role", http.HandlerFunc(h.AssignRoleToUser)))
	r.Get("/user-roles", acl.RequirePermission(db, aut, "acl.user_roles", http.HandlerFunc(h.GetUserRoles)))
	r.Post("/remove-role", acl.RequirePermission(db, aut, "acl.remove_role", http.HandlerFunc(h.RemoveRoleFromUser)))

	r.Get("/permissions", acl.RequirePermission(db, aut, "acl.permissions", http.HandlerFunc(h.GetPermissions)))
	r.Post("/create-permission", acl.RequirePermission(db, aut, "acl.create_permission", http.HandlerFunc(h.CreatePermission)))
	r.Post("/assign-permission", acl.RequirePermission(db, aut, "acl.assign_permission", http.HandlerFunc(h.AssignPermissionToRole)))
	r.Get("/role-permissions", acl.RequirePermission(db, aut, "acl.role_permissions", http.HandlerFunc(h.GetRolePermissions)))
	r.Post("/remove-permission", acl.RequirePermission(db, aut, "acl.remove_permission", http.HandlerFunc(h.RemovePermissionFromRole)))
}
