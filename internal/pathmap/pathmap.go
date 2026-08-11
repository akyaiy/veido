// Package pathmap provides a tiny path-dispatch helper for mapping clean
// slash-separated paths to handlers.
//
// It is intentionally independent from VFS, HTTP, or any other framework.
// The caller chooses the result type through generics, while handlers always
// return the normal Go pair: (T, error).
//
// Typical usage:
//
//	nodes, err := pathmap.Map[[]*vfs.Node](rawPath).
//		Handle("/", handleRoot).
//		AndHandle("/scopes", handleScopes).
//		AndHandle("/scopes/{scopeKey}", handleScope).
//		AndHandle("/other/*", handleOther).
//		End()
//
// Patterns support:
//   - literal segments: /scopes
//   - named parameters: /scopes/{scopeKey}
//   - parameters with prefixes/suffixes: /files/{name}.json
//   - wildcard tail: /other/*
//
// The first matching handler wins. If that handler returns an error, the
// error is returned as-is and no later handlers are tried. If no route matches,
// End returns os.ErrNotExist; ElseErr can be used to provide a custom fallback.
package pathmap

import (
	"os"
	"path"
	"strings"
)

// Handler handles a matched path and returns the caller-defined result type.
type Handler[T any] func(Match) (T, error)

// Match contains route parameters extracted from a matched pattern.
type Match struct {
	params   map[string]string
	wildcard string
}

// Param returns the named route parameter.
func (m Match) Param(name string) string {
	return m.params[name]
}

// Params returns a copy of all route parameters.
func (m Match) Params() map[string]string {
	params := make(map[string]string, len(m.params))
	for key, value := range m.params {
		params[key] = value
	}
	return params
}

// Wildcard returns the path suffix matched by a "*" route segment.
func (m Match) Wildcard() string {
	return m.wildcard
}

// Mapper maps a single path to the first matching handler.
type Mapper[T any] struct {
	path    string
	matched bool
	value   T
	err     error
}

// Map starts a path mapping chain.
func Map[T any](rawPath string) *Mapper[T] {
	return &Mapper[T]{path: cleanPath(rawPath)}
}

// Handle runs h if pattern matches the mapped path and no earlier handler matched.
func (m *Mapper[T]) Handle(pattern string, h Handler[T]) *Mapper[T] {
	if m == nil || m.matched || m.err != nil || h == nil {
		return m
	}

	match, ok := MatchPath(pattern, m.path)
	if !ok {
		return m
	}

	m.matched = true
	m.value, m.err = h(match)
	return m
}

// AndHandle is an alias for Handle for fluent call sites that read better with it.
func (m *Mapper[T]) AndHandle(pattern string, h Handler[T]) *Mapper[T] {
	return m.Handle(pattern, h)
}

// End returns the matched handler result or os.ErrNotExist when nothing matched.
func (m *Mapper[T]) End() (T, error) {
	return m.ElseErr(os.ErrNotExist)
}

// ElseErr returns the matched handler result or fallback when nothing matched.
func (m *Mapper[T]) ElseErr(fallback error) (T, error) {
	var zero T
	if m == nil {
		return zero, fallback
	}
	if m.matched {
		return m.value, m.err
	}
	return zero, fallback
}

// MatchPath matches rawPath against pattern and extracts route params.
//
// Supported pattern segments:
//   - literal: /scopes
//   - param: /scopes/{scopeName}
//   - param with literal suffix/prefix: /files/{name}.json
//   - wildcard rest: /other/*
func MatchPath(pattern string, rawPath string) (Match, bool) {
	pattern = cleanPath(pattern)
	rawPath = cleanPath(rawPath)

	if pattern == "/" && rawPath == "/" {
		return Match{params: map[string]string{}}, true
	}

	patternParts := split(pattern)
	pathParts := split(rawPath)
	params := make(map[string]string)

	for i, patternPart := range patternParts {
		if patternPart == "*" {
			return Match{
				params:   params,
				wildcard: strings.Join(pathParts[i:], "/"),
			}, true
		}
		if i >= len(pathParts) {
			return Match{}, false
		}
		if !matchSegment(patternPart, pathParts[i], params) {
			return Match{}, false
		}
	}

	if len(patternParts) != len(pathParts) {
		return Match{}, false
	}

	return Match{params: params}, true
}

func cleanPath(rawPath string) string {
	return path.Clean("/" + rawPath)
}

func split(cleanedPath string) []string {
	if cleanedPath == "/" {
		return nil
	}
	return strings.Split(strings.TrimPrefix(cleanedPath, "/"), "/")
}

func matchSegment(patternSegment string, pathSegment string, params map[string]string) bool {
	start := strings.Index(patternSegment, "{")
	end := strings.Index(patternSegment, "}")
	if start == -1 || end == -1 || end < start {
		return patternSegment == pathSegment
	}

	name := patternSegment[start+1 : end]
	if name == "" || strings.ContainsAny(name, "/{}") {
		return false
	}

	prefix := patternSegment[:start]
	suffix := patternSegment[end+1:]
	if !strings.HasPrefix(pathSegment, prefix) || !strings.HasSuffix(pathSegment, suffix) {
		return false
	}

	value := strings.TrimSuffix(strings.TrimPrefix(pathSegment, prefix), suffix)
	if value == "" {
		return false
	}

	params[name] = value
	return true
}
