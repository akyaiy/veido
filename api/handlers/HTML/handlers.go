package HTML

import (
	//"database/sql"
	"encoding/json"
	"net/http"

	//"time"

	"MyServer/internal/auth"
)

func LoadProtected(aut *auth.Auth) http.HandlerFunc {
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
