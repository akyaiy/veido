// package trie_router

// import "net/http"

// // HandlerFunc — функция обработчика маршрута, возвращает ошибку
// type HandlerFunc func(http.ResponseWriter, *http.Request) error

// // MiddlewareFunc — функция промежуточной обработки (middleware)
// type MiddlewareFunc func(HandlerFunc) HandlerFunc

package trie_router

import "net/http"

// HandlerFunc — функция обработчика маршрута, возвращает ошибку
type HandlerFunc func(http.ResponseWriter, *http.Request) error

// ErrorHandlerFunc — обработка ошибок
type ErrorHandlerFunc func(http.ResponseWriter, *http.Request, error)
