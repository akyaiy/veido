package aclH

// TODO: стандартизировать структуру ответов как в auth пакете

import (
	"github.com/akyaiy/veido/internal/acl"
	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/internal/server"
	"github.com/akyaiy/veido/internal/utils"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

type AdminRoutes struct {
	db *sql.DB
	auth *auth.Auth
}

type item struct {
	Name string `json:"name"`
}

type bindIDs struct {
	GroupID int64 `json:"groupId"`
	PermID int64 `json:"permId"`
	UserID int64 `json:"userId"`
}

type Status struct {
	Stat string `json:"status"`
	Message string `json:"message,omitempty"`
}

func (h *AdminRoutes) GetGroups(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	pg := server.GetPagination(r)
	groups := acl.GetGroups(h.db, pg.Limit, pg.Offset)
	json.NewEncoder(w).Encode(groups)
}

func (h *AdminRoutes) CreateGroup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var newGroup acl.Group
	json.NewDecoder(r.Body).Decode(&newGroup)
	if !utils.IsASCIIAlphaNumeric(newGroup.Name) || newGroup.Name == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Only aA-zZ, 0-9, \"_\" and \"-\" symbols are supported",
		})
		return
	}
	id := acl.CreateGroup(h.db, newGroup.Name)
	if id < 1 {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Group already exists",
		})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func (h *AdminRoutes) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var group acl.Group
	json.NewDecoder(r.Body).Decode(&group)
	groupIDStr := chi.URLParam(r, "groupId")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil || groupID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid group ID",
		})
		return
	}
	if groupID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid group ID",
		})
		return
	}
	if !utils.IsASCIIAlphaNumeric(group.Name) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Only aA-zZ, 0-9, \"_\" and \"-\" symbols are supported",
		})
		return
	}
	group.ID = int64(groupID)
	err = acl.UpdateGroup(h.db, group)
	if err != nil {
		if err.Error() == "group does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Group does not exists",
			})
		} else if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Group with this name already exists",
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

func (h *AdminRoutes) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	groupIDStr := chi.URLParam(r, "groupId")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil || groupID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid group ID",
		})
		return
	}
	err = acl.DeleteGroup(h.db, int64(groupID))
	if err != nil {
		if err.Error() == "group does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Group does not exists",
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

func (h *AdminRoutes) AssignGroup(w http.ResponseWriter, r *http.Request) {
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
	var bind bindIDs
	json.NewDecoder(r.Body).Decode(&bind)
	if userID < 1 || bind.GroupID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid user or group ID",
		})
		return
	}
	err = acl.AssignGroupToUser(h.db, bind.GroupID, int64(userID))
	if err != nil {
		if err.Error() == "user or group does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "User or group does not exists",
			})
		} else if strings.Contains(err.Error(), "group already assigned") {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Group already assigned",
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

func (h *AdminRoutes) DeAssignGroup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userIDStr := chi.URLParam(r, "userId")
	groupIDStr := chi.URLParam(r, "groupId")
	userID, err1 := strconv.Atoi(userIDStr)
	groupID, err2 := strconv.Atoi(groupIDStr)
	if err1 != nil || err2 != nil || userID < 1 || groupID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid user or group ID",
		})
		return
	}
	err := acl.DeAssignGroupToUser(h.db, int64(groupID), int64(userID))
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

func (h *AdminRoutes) GetUserGroups(w http.ResponseWriter, r *http.Request) {
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
	groups, err := acl.GetUserGroups(h.db, int64(userID), pg.Limit, pg.Offset)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "User not found",
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
	json.NewEncoder(w).Encode(groups)
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
	if permID < 1 {
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
	perm.ID = int64(permID)
	err = acl.UpdatePermission(h.db, perm)
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

func (h *AdminRoutes) GetGroupPermissions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	groupIDStr := chi.URLParam(r, "groupId")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil || groupID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid group ID",
		})
		return
	}
	pg := server.GetPagination(r)
	perms, err := acl.GetGroupPermissions(h.db, int64(groupID), pg.Limit, pg.Offset)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Group not found",
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
	json.NewEncoder(w).Encode(perms)
}

func (h *AdminRoutes) AssignPermission(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	groupIDStr := chi.URLParam(r, "groupId")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil || groupID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid group ID",
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
	err = acl.AssignPermissionToGroup(h.db, int64(groupID), bind.PermID)
	if err != nil {
		if err.Error() == "group or permission does not exists" {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Group or permission does not exists",
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
	groupIDStr := chi.URLParam(r, "groupId")
	permIDStr := chi.URLParam(r, "permId")
	groupID, err1 := strconv.Atoi(groupIDStr)
	permID, err2 := strconv.Atoi(permIDStr)
	if err1 != nil || err2 != nil || groupID < 1 || permID < 1 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "Invalid group or permission ID",
		})
		return
	}
	err := acl.DeAssignPermissionToGroup(h.db, int64(groupID), int64(permID))
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

func (h *AdminRoutes) GetMyGroups(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := r.Context().Value(auth.CONTEXT_USER_ID_KEY).(int)
	pg := server.GetPagination(r)
	groups, err := acl.GetUserGroups(h.db, int64(userID), pg.Limit, pg.Offset)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "User not found",
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
	json.NewEncoder(w).Encode(groups)
}

func (h *AdminRoutes) CheckUserPermissions(w http.ResponseWriter, r *http.Request) {
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
	h.nextCheckUserPermissions(userID, w, r)
}

func (h *AdminRoutes) CheckMyPermissions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID := r.Context().Value(auth.CONTEXT_USER_ID_KEY).(int)
	h.nextCheckUserPermissions(userID, w, r)
}

func (h *AdminRoutes) nextCheckUserPermissions(userID int, w http.ResponseWriter, r *http.Request) {
	permIdStr := r.URL.Query().Get("permission")
	if permIdStr != "" {
		permID, err := strconv.Atoi(permIdStr)
		if err != nil || permID < 1 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Invalid permission ID",
			})
			return
		}
		userPermission, err := acl.CheckUserPermission(h.db, int64(userID), int64(permID))
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "Internal server error",
			})
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(userPermission)
		return
	}

	pg := server.GetPagination(r)
	perms, err := acl.GetUserPermissions(h.db, int64(userID), pg.Limit, pg.Offset)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{
				Stat: "error",
				Message: "User not found",
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
	json.NewEncoder(w).Encode(perms)
}