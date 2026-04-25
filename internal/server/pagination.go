package server

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
)

type contextKey string

const paginationKey contextKey = "pagination"

type Pagination struct {
	Limit  int
	Offset int
}

func ParsePagination(r *http.Request) (Pagination, error) {
	q := r.URL.Query()

	limit := 10
	offset := 0

	if v := q.Get("limit"); v != "" {
		l, err := strconv.Atoi(v)
		if err != nil {
			return Pagination{}, fmt.Errorf("invalid limit")
		}
		limit = l
	}

	if v := q.Get("offset"); v != "" {
		o, err := strconv.Atoi(v)
		if err != nil {
			return Pagination{}, fmt.Errorf("invalid offset")
		}
		offset = o
	}

	// clamp
	if limit > 100 {
		limit = 100
	}
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	return Pagination{
		Limit:  limit,
		Offset: offset,
	}, nil
}

func PaginationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pg, err := ParsePagination(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		ctx := context.WithValue(r.Context(), paginationKey, pg)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetPagination(r *http.Request) Pagination {
	if pg, ok := r.Context().Value(paginationKey).(Pagination); ok {
		return pg
	}
	return Pagination{Limit: 10, Offset: 0}
}