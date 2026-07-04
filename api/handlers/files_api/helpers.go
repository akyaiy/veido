package files_api

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type Status struct {
	Stat string `json:"status"`
	Data any `json:"data"`
}

func (h *FileHandler) authenticateRequest(r *http.Request, w http.ResponseWriter) (int, error) {
	claims, err := h.auth.AuthenticateRequest(r)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: err.Error()})
		return 0, err
	}
	userId, err := strconv.Atoi(claims.Subject)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(Status{Stat: "error", Data: "Invalid token claims"})
		return 0, err
	}
	return userId, nil
}