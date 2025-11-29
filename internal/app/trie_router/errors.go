package trie_router

import (
	"encoding/json"
	"net/http"
)

// HTTPError — ошибка с кодом
type HTTPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *HTTPError) Error() string { return e.Message }

// ErrorHandlerFunc — тип функции обработки ошибок
//type ErrorHandlerFunc func(http.ResponseWriter, *http.Request, error)

// DefaultErrorHandler — вывод JSON с кодом
func DefaultErrorHandler(w http.ResponseWriter, r *http.Request, err error) {
	httpErr, ok := err.(*HTTPError)
	if !ok {
		httpErr = &HTTPError{Code: http.StatusInternalServerError, Message: err.Error()}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpErr.Code)
	_ = json.NewEncoder(w).Encode(httpErr)
}
