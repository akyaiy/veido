package trie_router

import "net/http"

// Group — группа маршрутов
type Group struct {
	prefix       string
	router       *Router
	ErrorHandler ErrorHandlerFunc
	middleware   []MiddlewareFunc
	parent       *Group
}

// Group — вложенная группа
func (g *Group) Group(path string) *Group {
	return &Group{
		prefix:       g.prefix + path,
		router:       g.router,
		ErrorHandler: g.ErrorHandler,
		middleware:   []MiddlewareFunc{},
		parent:       g,
	}
}

// Use — добавляет middleware только для этой группы
func (g *Group) Use(mw MiddlewareFunc) {
	g.middleware = append(g.middleware, mw)
}

// Handle — регистрация маршрута в группе с наследованием middleware
func (g *Group) Handle(method, path string, handler HandlerFunc) {
	full := g.prefix + path

	allMW := g.getAllMiddleware()
	handler = applyMiddleware(handler, allMW)

	wrapped := func(w http.ResponseWriter, r *http.Request) error {
		if err := handler(w, r); err != nil {
			g.ErrorHandler(w, r, err)
			return nil
		}
		return nil
	}

	g.router.Handle(method, full, wrapped)
}

func (g *Group) GET(path string, handler HandlerFunc)    { g.Handle("GET", path, handler) }
func (g *Group) POST(path string, handler HandlerFunc)   { g.Handle("POST", path, handler) }
func (g *Group) PUT(path string, handler HandlerFunc)    { g.Handle("PUT", path, handler) }
func (g *Group) DELETE(path string, handler HandlerFunc) { g.Handle("DELETE", path, handler) }

// getAllMiddleware — собирает middleware всех родителей + глобальный роутер
func (g *Group) getAllMiddleware() []MiddlewareFunc {
	var mws []MiddlewareFunc

	if g.router != nil {
		mws = append(mws, g.router.middleware...)
	}

	var parents []*Group
	curr := g
	for curr != nil {
		parents = append([]*Group{curr}, parents...)
		curr = curr.parent
	}
	for _, p := range parents {
		mws = append(mws, p.middleware...)
	}

	return mws
}
