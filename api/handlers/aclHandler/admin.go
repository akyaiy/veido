package aclHandler

import (
	"database/sql"
	"encoding/json"
	"net/http"

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
}

type item struct {
	Name string `json:"name"`
}

type bindIDs struct {
	RoleID int64 `json:"role_id"`
	PermID int64 `json:"perm_id"`
	UserID int64 `json:"user_id"`
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
