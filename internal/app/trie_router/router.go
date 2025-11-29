package trie_router

import (
	"context"
	"net/http"
)

// Router — основной роутер
type Router struct {
	root         *node
	middleware   []MiddlewareFunc
	ErrorHandler ErrorHandlerFunc
}

// New — создаёт новый роутер
func New() *Router {
	return &Router{
		root:         &node{children: make(map[string]*node)},
		middleware:   []MiddlewareFunc{},
		ErrorHandler: defaultErrorHandler,
	}
}

// Use — добавляет глобальный middleware
func (r *Router) Use(mws ...MiddlewareFunc) {
	r.middleware = append(r.middleware, mws...)
}

// Handle — регистрирует маршрут с любым методом
func (r *Router) Handle(method, path string, handler HandlerFunc) {
	switch method {
	case "GET":
		r.GET(path, handler)
	case "POST":
		r.POST(path, handler)
	case "PUT":
		r.PUT(path, handler)
	case "DELETE":
		r.DELETE(path, handler)
	default:
		panic("unsupported method: " + method)
	}
}

// GET/POST/PUT/DELETE
func (r *Router) GET(path string, handler HandlerFunc)    { r.register("GET", path, handler) }
func (r *Router) POST(path string, handler HandlerFunc)   { r.register("POST", path, handler) }
func (r *Router) PUT(path string, handler HandlerFunc)    { r.register("PUT", path, handler) }
func (r *Router) DELETE(path string, handler HandlerFunc) { r.register("DELETE", path, handler) }

// register — регистрирует обработчик с глобальными middleware
func (r *Router) register(method, path string, handler HandlerFunc) {
	handler = applyMiddleware(handler, r.middleware)
	r.root.addRoute(method, path, handler)
}

// ServeHTTP — имплементирует http.Handler
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	handler, params := r.root.getHandler(req.Method, req.URL.Path)
	if handler == nil {
		http.NotFound(w, req)
		return
	}

	ctx := req.Context()
	for k, v := range params {
		ctx = context.WithValue(ctx, k, v)
	}
	req = req.WithContext(ctx)

	if err := handler(w, req); err != nil {
		r.ErrorHandler(w, req, err)
	}
}

// defaultErrorHandler — обработка ошибок по умолчанию
func defaultErrorHandler(w http.ResponseWriter, r *http.Request, err error) {
	http.Error(w, err.Error(), http.StatusInternalServerError)
}
