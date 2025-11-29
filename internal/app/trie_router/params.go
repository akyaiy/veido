package trie_router

import (
	"context"
	"net/http"
)

type paramsKeyType int

const paramsKey paramsKeyType = 0

func withParam(r *http.Request, key, value string) *http.Request {
	params := Params(r)
	params[key] = value
	return r.WithContext(context.WithValue(r.Context(), paramsKey, params))
}

func Params(r *http.Request) map[string]string {
	val := r.Context().Value(paramsKey)
	if val == nil {
		return map[string]string{}
	}
	return val.(map[string]string)
}

func Param(r *http.Request, key string) string {
	return Params(r)[key]
}
