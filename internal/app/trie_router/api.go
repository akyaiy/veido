package trie_router

import (
	"fmt"
	"net/http"
)

// RegisterAPI — подключение маршрутов API
func RegisterAPI(g *Group) {
	// Middleware только для этой группы
	g.Use(func(next HandlerFunc) HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) error {
			fmt.Println("API Group Middleware:", r.URL.Path)
			return next(w, r)
		}
	})

	g.GET("/users/:id", func(w http.ResponseWriter, r *http.Request) error {
		id := Param(r, "id")
		fmt.Fprintf(w, "User ID = %s\n", id)
		return nil
	})

	g.GET("/error", func(w http.ResponseWriter, r *http.Request) error {
		return &HTTPError{Code: 400, Message: "Ошибка API"}
	})
}
