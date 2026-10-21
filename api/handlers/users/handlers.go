package users

import (
	"MyServer/internal/auth"
	"MyServer/internal/server"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type Status struct {
	Stat string `json:"status"`
	Data any    `json:"data,omitempty"`
}

// AuthRegister регистрирует нового пользователя
func (h *AuthRoutes) AuthRegister(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var newUser auth.User
	json.NewDecoder(r.Body).Decode(&newUser)
	if newUser.Name == "" || newUser.Password == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Username and password are required"})
		return
	}
	id, err := h.auth.CreateUser(&auth.User{
		Name:     newUser.Name,
		Password: newUser.Password,
		Status:   "unactive",
	})
	if err != nil {
		if errors.Is(err, auth.ErrUserExists) {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User already exists"})
		} else if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Invalid credentials"})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: map[string]any{"id": id, "message": "User registered successfully", "userStatus": "unactive"}})
}

// AuthLogin аутентифицирует пользователя
func (h *AuthRoutes) AuthLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var loginReq auth.LoginRequest
	json.NewDecoder(r.Body).Decode(&loginReq)
	resp, err := h.auth.Login(&loginReq)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: err.Error()})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	setRefreshCookie(w, resp.RefreshToken, h.auth.RefreshTTL())
	resp.RefreshToken = "" // не отправляем refresh token в теле ответа, он уже в HttpOnly cookie
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: resp.AccessToken})
}

// AuthRefresh обновляет токены
func (h *AuthRoutes) AuthRefresh(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Refresh token is required"})
		return
	}
	refreshReq := &auth.RefreshRequest{RefreshToken: cookie.Value}
	resp, err := h.auth.Refresh(refreshReq)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: err.Error()})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	setRefreshCookie(w, resp.RefreshToken, h.auth.RefreshTTL())
	resp.RefreshToken = "" // не отправляем refresh token в теле ответа, он уже в HttpOnly cookie
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: resp.AccessToken})
}

// AuthLogout выходит из системы
func (h *AuthRoutes) AuthLogout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	err := h.auth.Logout(r.Context())
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: err.Error()})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	// Удаляем cookie
	setRefreshCookie(w, "", -1)
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: "Logged out successfully"})
}

// MeGet получает данные текущего пользователя
func (h *AuthRoutes) MeGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userId := r.Context().Value(auth.CONTEXT_USER_ID_KEY).(int)
	user, err := h.auth.GetUserByID(int64(userId))
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User not found"})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: user})
}

// MeUpdate обновляет данные текущего пользователя
func (h *AuthRoutes) MeUpdate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userId := r.Context().Value(auth.CONTEXT_USER_ID_KEY).(int)
	var updateData struct {
		Name string `json:"name,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&updateData)
	if updateData.Name == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Name is required"})
		return
	}
	err := h.auth.UpdateUser(int64(userId), &auth.User{Name: updateData.Name})
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User not found"})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: "User updated successfully"})
}

// MeUpdatePassword обновляет пароль текущего пользователя
func (h *AuthRoutes) MeUpdatePassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userId := r.Context().Value(auth.CONTEXT_USER_ID_KEY).(int)
	var updateData struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	json.NewDecoder(r.Body).Decode(&updateData)
	if updateData.OldPassword == "" || updateData.NewPassword == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Old and new passwords are required"})
		return
	}

	err := h.auth.ChangePassword(int64(userId), updateData.OldPassword, updateData.NewPassword)
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User not found"})
		} else if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: err.Error()})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: "Password updated successfully"})
}

// UsersAdminCreate создает нового пользователя (admin)
func (h *AuthRoutes) UsersAdminCreate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var newUser auth.User
	json.NewDecoder(r.Body).Decode(&newUser)
	id, err := h.auth.CreateUser(&auth.User{
		Name:     newUser.Name,
		Password: newUser.Password,
		Status:   newUser.Status,
	})
	if err != nil {
		if errors.Is(err, auth.ErrUserExists) {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User already exists"})
		} else if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Invalid credentials"})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: map[string]any{"id": id, "message": "User registered successfully", "userStatus": newUser.Status}})
}

// UsersAdminList получает список всех пользователей (admin)
func (h *AuthRoutes) UsersAdminList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	pg := server.GetPagination(r)
	users, err := h.auth.GetUsers(pg.Limit, pg.Offset)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: users})
}

// UsersAdminRead получает данные пользователя по ID (admin)
func (h *AuthRoutes) UsersAdminRead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Invalid user ID"})
		return
	}
	user, err := h.auth.GetUserByID(int64(id))
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User not found"})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: user})
}

// UsersAdminUpdate обновляет данные пользователя (admin)
func (h *AuthRoutes) UsersAdminUpdate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Invalid user ID"})
		return
	}
	var updateData struct {
		Name   string `json:"name,omitempty"`
		Status string `json:"status,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&updateData)
	if updateData.Name == "" && updateData.Status == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "At least one field (name or status) is required for update"})
		return
	}
	err = h.auth.UpdateUser(int64(id), &auth.User{Name: updateData.Name, Status: updateData.Status})
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User not found"})
		} else if errors.Is(err, auth.ErrUserExists) {
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User already exists"})
		} else if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: err.Error()})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: "User updated successfully"})
}

// UsersAdminUpdatePassword обновляет пароль пользователя (admin)
func (h *AuthRoutes) UsersAdminUpdatePassword(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Invalid user ID"})
		return
	}
	var updateData struct {
		NewPassword string `json:"newPassword"`
	}
	json.NewDecoder(r.Body).Decode(&updateData)
	if updateData.NewPassword == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "New password is required"})
		return
	}
	err = h.auth.UpdatePassword(int64(id), updateData.NewPassword)
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User not found"})
		} else if errors.Is(err, auth.ErrInvalidCredentials) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: err.Error()})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: "Password updated successfully"})
}

// UsersAdminDelete удаляет пользователя (admin)
func (h *AuthRoutes) UsersAdminDelete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Invalid user ID"})
		return
	}
	err = h.auth.DeleteUser(int64(id))
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "User not found"})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Internal server error"})
		}
		return
	}
	json.NewEncoder(w).Encode(Status{Stat: "ok", Data: "User deleted successfully"})
}

// UsersList получает список пользователей
func (h *AuthRoutes) UsersList(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotImplemented)
}

// UsersRead получает данные пользователя по ID
func (h *AuthRoutes) UsersRead(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotImplemented)
}
