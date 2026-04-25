package aclH

import (
	"MyServer/internal/acl"
	"MyServer/internal/server"
	"MyServer/internal/utils"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

type AdminRoutes struct {
	db *sql.DB
}

type item struct {
	Name string `json:"name"`
}

type bindIDs struct {
	RoleID int64 `json:"role_id"`
	PermID int64 `json:"perm_id"`
	UserID int64 `json:"user_id"`
}

type Status struct {
	Stat string `json:"status"`
	Message string `json:"message,omitempty"`
}

func (h *AdminRoutes) GetRoles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	pg := server.GetPagination(r)
	roles := acl.GetRoles(h.db, pg.Limit, pg.Offset)
	json.NewEncoder(w).Encode(roles)
}

func (h *AdminRoutes) CreateRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var newRole acl.Role
	json.NewDecoder(r.Body).Decode(&newRole)
	if !utils.IsASCIIAlphaNumeric(newRole.Name) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Only aA-zZ, 0-9, \"_\" and \"-\" symbols are supported",
		})
		return
	}
	id := acl.CreateRole(h.db, newRole.Name)
	if id < 1 {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Role already exists",
		})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) UpdateRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var role acl.Role
	json.NewDecoder(r.Body).Decode(&role)
	if role.ID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid role ID",
		})
		return
	}
	if !utils.IsASCIIAlphaNumeric(role.Name) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Only aA-zZ, 0-9, \"_\" and \"-\" symbols are supported",
		})
		return
	}
	err := acl.UpdateRole(h.db, role)
	if err != nil {
		if err.Error() == "role does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Role does not exists",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) DeleteRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	roleIDStr := chi.URLParam(r, "roleId")
	roleID, err := strconv.Atoi(roleIDStr)
	if err != nil || roleID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid role ID",
		})
		return
	}
	err = acl.DeleteRole(h.db, int64(roleID))
	if err != nil {
		if err.Error() == "role does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Role does not exists",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) AssignRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var bind bindIDs
	json.NewDecoder(r.Body).Decode(&bind)
	if bind.UserID < 1 || bind.RoleID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid user or role ID",
		})
		return
	}
	err := acl.AssignRoleToUser(h.db, bind.RoleID, bind.UserID)
	if err != nil {
		if err.Error() == "user or role does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "User or role does not exists",
			})
		} else if strings.Contains(err.Error(), "role already assigned") {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Role already assigned",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) DeAssignRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userIDStr := chi.URLParam(r, "userId")
	roleIDStr := chi.URLParam(r, "roleId")
	userID, err1 := strconv.Atoi(userIDStr)
	roleID, err2 := strconv.Atoi(roleIDStr)
	if err1 != nil || err2 != nil || userID < 1 || roleID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid user or role ID",
		})
		return
	}
	err := acl.DeAssignRoleToUser(h.db, int64(roleID), int64(userID))
	if err != nil {
		if err.Error() == "relation does not exist" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Relation does not exist",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) GetUserRoles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userIDStr := chi.URLParam(r, "userId")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid user ID",
		})
		return
	}
	pg := server.GetPagination(r)
	roles := acl.GetUserRoles(h.db, int64(userID), pg.Limit, pg.Offset)
	json.NewEncoder(w).Encode(roles)
}

func (h *AdminRoutes) GetPermissions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	pg := server.GetPagination(r)
	perms := acl.GetPermissions(h.db, pg.Limit, pg.Offset)
	json.NewEncoder(w).Encode(perms)
}

func (h *AdminRoutes) CreatePermission(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var newPerm acl.Permission
	json.NewDecoder(r.Body).Decode(&newPerm)
	if !utils.IsASCIIAlphaNumeric(newPerm.Key) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Only aA-zZ, 0-9, \"_\" and \"-\" symbols are supported",
		})
		return
	}
	id := acl.CreatePermission(h.db, newPerm.Key)
	if id < 1 {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Permission already exists",
		})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) UpdatePermission(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var perm acl.Permission
	json.NewDecoder(r.Body).Decode(&perm)
	if perm.ID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid permission ID",
		})
		return
	}
	if !utils.IsASCIIAlphaNumeric(perm.Key) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Only aA-zZ, 0-9, \"_\" and \"-\" symbols are supported",
		})
		return
	}
	err := acl.UpdatePermission(h.db, perm)
	if err != nil {
		if err.Error() == "permission does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Permission does not exists",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) DeletePermission(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	permIDStr := chi.URLParam(r, "permId")
	permID, err := strconv.Atoi(permIDStr)
	if err != nil || permID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid permission ID",
		})
		return
	}
	err = acl.DeletePermission(h.db, int64(permID))
	if err != nil {
		if err.Error() == "permission does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Permission does not exists",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	roleIDStr := chi.URLParam(r, "roleId")
	roleID, err := strconv.Atoi(roleIDStr)
	if err != nil || roleID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid role ID",
		})
		return
	}
	pg := server.GetPagination(r)
	perms := acl.GetRolePermissions(h.db, int64(roleID), pg.Limit, pg.Offset)
	json.NewEncoder(w).Encode(perms)
}

func (h *AdminRoutes) AssignPermission(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	roleIDStr := chi.URLParam(r, "roleId")
	roleID, err := strconv.Atoi(roleIDStr)
	if err != nil || roleID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid role ID",
		})
		return
	}
	var bind bindIDs
	json.NewDecoder(r.Body).Decode(&bind)
	if bind.PermID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid permission ID",
		})
		return
	}
	err = acl.AssignPermissionToRole(h.db, int64(roleID), bind.PermID)
	if err != nil {
		if err.Error() == "role or permission does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Role or permission does not exists",
			})
		} else if strings.Contains(err.Error(), "permission already assigned") {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Permission already assigned",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) DeAssignPermission(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	roleIDStr := chi.URLParam(r, "roleId")
	permIDStr := chi.URLParam(r, "permId")
	roleID, err1 := strconv.Atoi(roleIDStr)
	permID, err2 := strconv.Atoi(permIDStr)
	if err1 != nil || err2 != nil || roleID < 1 || permID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid role or permission ID",
		})
		return
	}
	err := acl.DeAssignPermissionToRole(h.db, int64(roleID), int64(permID))
	if err != nil {
		if err.Error() == "relation does not exist" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Relation does not exist",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}


