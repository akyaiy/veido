package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

func setRefreshCookie(w http.ResponseWriter, token string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(ttl.Seconds()),
	})
}

func DeleteUserHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Username string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", 400)
			return
		}
		res, err := db.Exec("DELETE FROM users WHERE username = ?", in.Username)
		if err != nil {
			http.Error(w, "db error", 500)
			return
		}
		rows, _ := res.RowsAffected()
		if rows == 0 {
			http.Error(w, "not found", 404)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func UpdateUserPasswordHandler(db *sql.DB, auth *Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", 400)
			return
		}
		newHash, err := auth.HashPassword(in.Password)
		if err != nil {
			http.Error(w, "hash error", 500)
			return
		}
		db.Exec("UPDATE users SET password_hash = ? WHERE username = ?", newHash, in.Username)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func GetUserDataHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username := r.URL.Query().Get("username")
		var out struct {
			ID       int64
			Username string
		}
		row := db.QueryRow("SELECT id, username FROM users WHERE username=?", username)
		if err := row.Scan(&out.ID, &out.Username); err != nil {
			http.Error(w, "not found", 404)
			return
		}
		json.NewEncoder(w).Encode(out)
	}
}

func GetUsersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, _ := db.Query("SELECT username FROM users")
		defer rows.Close()
		var arr []string
		for rows.Next() {
			var u string
			rows.Scan(&u)
			arr = append(arr, u)
		}
		json.NewEncoder(w).Encode(arr)
	}
}

func RegisterHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Username, Password string }
		json.NewDecoder(r.Body).Decode(&in)
		auth := NewAuth(db, []byte("replace-with-secure-secret"))
		hash, _ := auth.HashPassword(in.Password)
		res, err := db.Exec("INSERT INTO users(username, password_hash) VALUES(?, ?)", in.Username, hash)
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
		setRefreshCookie(w, refresh, 7*24*time.Hour)

		json.NewEncoder(w).Encode(map[string]string{"access_token": access})
	}
}

func RefreshHandler(db *sql.DB, auth *Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		c, err := r.Cookie("refresh_token")
		if err != nil {
			http.Error(w, "no refresh", 401)
			return
		}

		userID, err := auth.VerifyRefreshToken(c.Value)
		if err != nil {
			http.Error(w, "invalid", 401)
			return
		}

		auth.DeleteRefreshToken(c.Value)

		newR, _ := auth.GenerateRefreshToken()
		auth.StoreRefreshToken(newR, userID, 7*24*time.Hour)
		setRefreshCookie(w, newR, 7*24*time.Hour)

		newA, _ := auth.CreateAccessToken(userID)

		json.NewEncoder(w).Encode(map[string]string{"access_token": newA})
	}
}

func LogoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := r.Cookie("refresh_token")
		if c != nil {
			db.Exec("DELETE FROM refresh_tokens WHERE token = ?", c.Value)
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "refresh_token",
			Value:    "",
			MaxAge:   -1,
			Path:     "/",
			HttpOnly: true,
		})

		w.WriteHeader(204)
	}
}

func LoadProtected(auth *Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := auth.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Hello from protected endpoint",
			"user_id": id,
		})
	}
}
