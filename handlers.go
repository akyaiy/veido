package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

func DeleteUserHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		var in struct {
			Username string `json:"username"`
		}

		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		if in.Username == "" {
			http.Error(w, "username required", http.StatusBadRequest)
			return
		}

		res, err := db.Exec("DELETE FROM users WHERE username = ?", in.Username)
		if err != nil {
			http.Error(w, "db error", 500)
			return
		}

		rows, _ := res.RowsAffected()
		if rows == 0 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

// GetUserData(db, user)).Methods("GET")

func UpdateUserPasswordHandler(db *sql.DB, auth *Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if in.Username == "" || in.Password == "" {
			http.Error(w, "missing fields", http.StatusBadRequest)
			return
		}
		// генерируем новый хэш
		newHash, err := auth.HashPassword(in.Password)
		if err != nil {
			http.Error(w, "hash error", 500)
			return
		}
		// обновляем пароль
		_, err = db.Exec("UPDATE users SET password_hash = ? WHERE username = ?", newHash, in.Username)
		if err != nil {
			http.Error(w, "db error", 500)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}
}

func GetUserDataHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username := r.URL.Query().Get("username")
		if username == "" {
			http.Error(w, "username required", http.StatusBadRequest)
			return
		}
		var out struct {
			ID       int64  `json:"id"`
			Username string `json:"username"`
		}
		row := db.QueryRow("SELECT id, username FROM users WHERE username = ?", username)
		if err := row.Scan(&out.ID, &out.Username); err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	}
}

func GetUsersHandler(db *sql.DB) http.HandlerFunc {
	//func GetAllUsernamesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT username FROM users")
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		defer rows.Close()
		var usernames []string
		for rows.Next() {
			var username string
			if err := rows.Scan(&username); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			usernames = append(usernames, username)
		}
		// Проверка на ошибки итерации
		if err := rows.Err(); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(usernames)
	}
}

func RegisterHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Username, Password string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", 400)
			return
		}
		auth := NewAuth(db, []byte("replace-with-secure-secret"))
		hash, _ := auth.HashPassword(in.Password)
		res, err := db.Exec("INSERT INTO users(username, password_hash) VALUES(?,?)", in.Username, hash)
		if err != nil {
			http.Error(w, "cannot create", 400)
			return
		}
		id, _ := res.LastInsertId()
		json.NewEncoder(w).Encode(map[string]any{"id": id, "username": in.Username})
	}
}

func LoginHandler(db *sql.DB, auth *Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Username, Password string }
		json.NewDecoder(r.Body).Decode(&in)
		row := db.QueryRow("SELECT id, password_hash FROM users WHERE username = ?", in.Username)
		var id int64
		var hash string
		if err := row.Scan(&id, &hash); err != nil {
			http.Error(w, "invalid", 401)
			return
		}
		if auth.CheckPassword(hash, in.Password) != nil {
			http.Error(w, "invalid", 401)
			return
		}
		access, _ := auth.CreateAccessToken(id)
		refresh, _ := auth.GenerateRefreshToken()
		auth.StoreRefreshToken(refresh, id, 7*24*time.Hour)
		json.NewEncoder(w).Encode(map[string]string{"access_token": access, "refresh_token": refresh})
	}
}

func RefreshHandler(db *sql.DB, auth *Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			RefreshToken string `json:"refresh_token"`
		}
		json.NewDecoder(r.Body).Decode(&in)
		userID, err := auth.VerifyRefreshToken(in.RefreshToken)
		if err != nil {
			http.Error(w, "invalid", 401)
			return
		}
		auth.DeleteRefreshToken(in.RefreshToken)
		newR, _ := auth.GenerateRefreshToken()
		auth.StoreRefreshToken(newR, userID, 7*24*time.Hour)
		newA, _ := auth.CreateAccessToken(userID)
		json.NewEncoder(w).Encode(map[string]string{"access_token": newA, "refresh_token": newR})
	}
}

func LogoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ RefreshToken string }
		json.NewDecoder(r.Body).Decode(&in)
		db.Exec("DELETE FROM refresh_tokens WHERE token = ?", in.RefreshToken)
		w.WriteHeader(204)
	}
}

func LoadProtected(auth *Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(fmt.Sprintf(`{"message":"Hello from protected endpoint","user_id":%d}`, userID)))
	}
}
