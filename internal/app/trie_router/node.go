package trie_router

import (
	"strings"
)

// node — элемент trie
type node struct {
	children map[string]*node
	handler  HandlerFunc
	param    string
}

// addRoute — добавляет маршрут в trie
func (n *node) addRoute(method, path string, handler HandlerFunc) {
	segments := splitPath(path)
	curr := n
	for _, seg := range segments {
		key := seg
		if strings.HasPrefix(seg, ":") {
			key = ":"
		}
		if curr.children == nil {
			curr.children = make(map[string]*node)
		}
		if curr.children[key] == nil {
			curr.children[key] = &node{
				children: make(map[string]*node),
			}
			if key == ":" {
				curr.children[key].param = seg[1:]
			}
		}
		curr = curr.children[key]
	}
	curr.handler = handler
}

// getHandler — возвращает обработчик и параметры из trie
func (n *node) getHandler(method, path string) (HandlerFunc, map[string]string) {
	segments := splitPath(path)
	curr := n
	params := make(map[string]string)
	for _, seg := range segments {
		if next, ok := curr.children[seg]; ok {
			curr = next
		} else if next, ok := curr.children[":"]; ok { // wildcard
			curr = next
			params[curr.param] = seg
		} else {
			return nil, nil
		}
	}
	return curr.handler, params
}

// splitPath — разбивает путь на сегменты
func splitPath(p string) []string {
	p = strings.Trim(p, "/")
	if p == "" {
		return []string{}
	}
	return strings.Split(p, "/")
}
