package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"MyServer/packages/auch"
)

// setRefreshCookie sets HttpOnly cookie for refresh token.
// SameSite=None is used so cookie is sent with cross-site requests (fetch with credentials).
// For production over HTTPS set Secure: true.
func setRefreshCookie(w http.ResponseWriter, token string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		Path:     "/api/refresh",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode, // ensures sent with fetch and after reload
		MaxAge:   int(ttl.Seconds()),
		Secure:   false, // set to true in prod when using HTTPS
	})
}

/* ------------------- Protected ------------------- */

func DeleteUserHandler(db *sql.DB, aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := aut.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var in struct{ Username string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		res, err := db.Exec("DELETE FROM users WHERE username=?", in.Username)
		if err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}

		rows, _ := res.RowsAffected()
		if rows == 0 {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func UpdateUserPasswordHandler(db *sql.DB, aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := aut.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}

		var in struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		hash, err := aut.HashPassword(in.Password)
		if err != nil {
			http.Error(w, "hash error", http.StatusInternalServerError)
			return
		}
		_, err = db.Exec("UPDATE users SET password_hash=? WHERE username=?", hash, in.Username)
		if err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func GetUserDataHandler(db *sql.DB, aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := aut.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}

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
		//		fmt.Printf("out: %v", out)
		json.NewEncoder(w).Encode(out)
	}
}

func GetUsersHandler(db *sql.DB, aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := aut.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", 401)
			return
		}

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

func LoadProtected(aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := aut.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{
			"message": "Hello from protected endpoint",
			"user_id": id,
		})
	}
}

/* ------------------- Public: Register ------------------- */

func RegisterHandler(db *sql.DB, aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Username, Password string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		hash, err := aut.HashPassword(in.Password)
		if err != nil {
			http.Error(w, "hash error", http.StatusInternalServerError)
			return
		}

		res, err := db.Exec("INSERT INTO users(username, password_hash) VALUES(?,?)",
			in.Username, hash)
		if err != nil {
			http.Error(w, "cannot create", http.StatusBadRequest)
			return
		}

		id, _ := res.LastInsertId()
		json.NewEncoder(w).Encode(map[string]any{"id": id, "username": in.Username})
	}
}

/* ------------------- Public: Login + Refresh ------------------- */

func LoginHandler(db *sql.DB, aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Username, Password string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		row := db.QueryRow(
			"SELECT id, password_hash FROM users WHERE username=?",
			in.Username,
		)

		var id int64
		var hash string
		if err := row.Scan(&id, &hash); err != nil {
			http.Error(w, "invalid", http.StatusUnauthorized)
			return
		}

		if aut.CheckPassword(hash, in.Password) != nil {
			http.Error(w, "invalid", http.StatusUnauthorized)
			return
		}

		access, err := aut.CreateAccessToken(id)
		if err != nil {
			http.Error(w, "token error", http.StatusInternalServerError)
			return
		}

		refresh, err := aut.GenerateRefreshToken(id)
		if err != nil {
			http.Error(w, "token error", http.StatusInternalServerError)
			return
		}

		if err := aut.StoreRefreshToken(refresh, id, 7*24*time.Hour); err != nil {
			http.Error(w, "store error", http.StatusInternalServerError)
			return
		}

		setRefreshCookie(w, refresh, 7*24*time.Hour)

		json.NewEncoder(w).Encode(map[string]string{"access_token": access})
	}
}

/* ------------------- Refresh (public) ------------------- */

func RefreshHandler(db *sql.DB, aut *auch.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("refresh_token")
		if err != nil {
			http.Error(w, "no refresh", http.StatusUnauthorized)
			return
		}

		userID, err := aut.VerifyRefreshToken(c.Value)
		if err != nil {
			// remove cookie on invalid/expired token
			http.SetCookie(w, &http.Cookie{
				Name:     "refresh_token",
				Value:    "",
				Path:     "/api/refresh",
				HttpOnly: true,
				MaxAge:   -1,
			})
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		aut.DeleteRefreshToken(c.Value)

		newR, err := aut.GenerateRefreshToken(userID)
		if err != nil {
			http.Error(w, "token error", http.StatusInternalServerError)
			return
		}
		if err := aut.StoreRefreshToken(newR, userID, 7*24*time.Hour); err != nil {
			http.Error(w, "store error", http.StatusInternalServerError)
			return
		}

		setRefreshCookie(w, newR, 7*24*time.Hour)

		newA, err := aut.CreateAccessToken(userID)
		if err != nil {
			http.Error(w, "token error", http.StatusInternalServerError)
			return
		}

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

		w.WriteHeader(http.StatusNoContent)
	}
}
