package httpapi

import (
	"MyServer/internal/common"
	"MyServer/internal/vfs/v2"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

type moveRequest struct {
	TargetURI string `json:"target_uri"`
}

func (h *Handler) requestTarget(r *http.Request) (v2.Actor, common.CanonURI, error) {
	actor, err := h.resolveActor(r)
	if err != nil {
		return v2.Actor{}, common.EmptyURI, requestProblem(http.StatusUnauthorized, "unauthenticated", "authentication is required", err)
	}
	if actor.Kind == "" || actor.ID == "" {
		return v2.Actor{}, common.EmptyURI, requestProblem(http.StatusUnauthorized, "unauthenticated", "authentication is required", ErrUnauthenticated)
	}
	uri, err := queryURI(r, "uri")
	return actor, uri, err
}

func queryURI(r *http.Request, name string) (common.CanonURI, error) {
	values, ok := r.URL.Query()[name]
	if !ok || len(values) != 1 || values[0] == "" {
		return common.EmptyURI, requestProblem(http.StatusBadRequest, "invalid_argument", fmt.Sprintf("exactly one non-empty %s parameter is required", name), nil)
	}
	uri, err := common.CastURI(values[0])
	if err != nil {
		return common.EmptyURI, requestProblem(http.StatusBadRequest, "invalid_argument", fmt.Sprintf("%s is not a canonical VFS URI", name), err)
	}
	return uri, nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, limit int64, destination any) error {
	if r.ContentLength > limit {
		return requestProblem(http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large", nil)
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return decodeBodyError(err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return requestProblem(http.StatusBadRequest, "invalid_argument", "request body must contain one JSON value", nil)
		}
		return decodeBodyError(err)
	}
	return nil
}

func readLimitedBody(w http.ResponseWriter, r *http.Request, limit int64) ([]byte, error) {
	if r.ContentLength > limit {
		return nil, requestProblem(http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large", nil)
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, decodeBodyError(err)
	}
	return body, nil
}

func decodeBodyError(err error) error {
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		return requestProblem(http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large", err)
	}
	return requestProblem(http.StatusBadRequest, "invalid_argument", "invalid request body", err)
}
