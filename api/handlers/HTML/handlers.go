package HTML

import (
	//"database/sql"
	"encoding/json"
	"fmt"
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
		//authHeader := r.Header.Get("Authorization")
		//fmt.Println("Полученный Authorization:", authHeader)

		//token := strings.TrimPrefix(authHeader, "Bearer ")
		//fmt.Println("Полученный access_token:", token)

		fmt.Println("Подключился пользователь с ID:", id)
	}

}
