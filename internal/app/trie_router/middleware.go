package trie_router

// MiddlewareFunc — функция промежуточной обработки
type MiddlewareFunc func(HandlerFunc) HandlerFunc

// applyMiddleware — применяет цепочку middleware к обработчику
func applyMiddleware(handler HandlerFunc, mws []MiddlewareFunc) HandlerFunc {
	for i := len(mws) - 1; i >= 0; i-- { // обратный порядок
		handler = mws[i](handler)
	}
	return handler
}
