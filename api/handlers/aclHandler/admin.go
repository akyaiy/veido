package aclHandler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"MyServer/internal/acl"
	"MyServer/internal/auth"

	"github.com/go-chi/chi/v5"
)

type AdminRoutes struct {
	DB  *sql.DB
	Aut *auth.Auth
}

func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
	h := &AdminRoutes{DB: db, Aut: aut}

	r.Post("/create-role", h.CreateRole)
	r.Post("/create-permission", h.CreatePermission)
	r.Post("/assign-permission", h.AssignPermissionToRole)
	r.Post("/assign-role", h.AssignRoleToUser)

	r.Get("/roles", h.GetRoles)
	r.Get("/permissions", h.GetPermissions)
	r.Get("/role-permissions", h.GetRolePermissions)
	r.Post("/remove-permission", h.RemovePermissionFromRole)
}

type item struct {
	Name string `json:"name"`
}

type bindIDs struct {
	RoleID int64 `json:"role_id"`
	PermID int64 `json:"perm_id"`
	UserID int64 `json:"user_id"`
}

func (h *AdminRoutes) GetRoles(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`SELECT id, name FROM roles ORDER BY id`)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	type Role struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	var roles []Role
	for rows.Next() {
		var r Role
		rows.Scan(&r.ID, &r.Name)
		roles = append(roles, r)
	}

	json.NewEncoder(w).Encode(roles)
}

func (h *AdminRoutes) GetPermissions(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`SELECT id, key FROM permissions ORDER BY id`)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	type Perm struct {
		ID  int    `json:"id"`
		Key string `json:"key"`
	}

	var perms []Perm
	for rows.Next() {
		var p Perm
		rows.Scan(&p.ID, &p.Key)
		perms = append(perms, p)
	}

	json.NewEncoder(w).Encode(perms)
}

func (h *AdminRoutes) RemovePermissionFromRole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RoleID int `json:"role_id"`
		PermID int `json:"perm_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	// Удаляем связь role-permission
	_, err := h.DB.Exec(`DELETE FROM role_permissions WHERE role_id=? AND permission_id=?`, req.RoleID, req.PermID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	w.Write([]byte("Удалено"))
}

func (h *AdminRoutes) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	roleIDStr := r.URL.Query().Get("role_id")
	roleID, err := strconv.Atoi(roleIDStr)
	if err != nil {
		http.Error(w, "Неверный role_id", 400)
		return
	}

	// Получаем все разрешения для роли
	rows, err := h.DB.Query(`
		SELECT p.id, p.key
		FROM role_permissions rp
		JOIN permissions p ON rp.permission_id = p.id
		WHERE rp.role_id = ?`, roleID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	var perms []map[string]interface{}
	for rows.Next() {
		var id int
		var key string
		if err := rows.Scan(&id, &key); err != nil {
			continue
		}
		perms = append(perms, map[string]interface{}{
			"id":   id,
			"name": key, // фронтенду удобно вернуть как "name"
		})
	}

	json.NewEncoder(w).Encode(perms)
}

func (h *AdminRoutes) CreateRole(w http.ResponseWriter, r *http.Request) {
	var body item
	json.NewDecoder(r.Body).Decode(&body)
	if err := acl.CreateRole(h.DB, body.Name); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Write([]byte("OK"))
}

func (h *AdminRoutes) CreatePermission(w http.ResponseWriter, r *http.Request) {
	var body item
	json.NewDecoder(r.Body).Decode(&body)
	if err := acl.CreatePermission(h.DB, body.Name); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Write([]byte("OK"))
}

func (h *AdminRoutes) AssignPermissionToRole(w http.ResponseWriter, r *http.Request) {
	var b bindIDs
	json.NewDecoder(r.Body).Decode(&b)
	if err := acl.AssignPermissionToRole(h.DB, b.RoleID, b.PermID); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Write([]byte("OK"))
}

func (h *AdminRoutes) AssignRoleToUser(w http.ResponseWriter, r *http.Request) {
	var b bindIDs
	json.NewDecoder(r.Body).Decode(&b)
	if err := acl.AssignRoleToUser(h.DB, b.RoleID, b.UserID); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Write([]byte("OK"))
}
