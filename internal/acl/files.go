package acl

import (
	"net/http"
	"strings"
)

func FilesPermissionFromRequest(r *http.Request) string {
	action := filesActionFromMethod(r.Method)
	path := filesPathFromRequest(r)

	if path == "" {
		return "files." + action
	}

	return "files." + action + "." + path
}

func filesActionFromMethod(method string) string {
	switch method {
	case "GET", "HEAD", "PROPFIND":
		return "read"
	case "PUT", "POST":
		return "write"
	case "DELETE":
		return "delete"
	case "MKCOL":
		return "mkdir"
	case "MOVE", "COPY":
		return "move"
	case "LOCK", "UNLOCK":
		return "lock"
	default:
		return "unknown"
	}
}

func filesPathFromRequest(r *http.Request) string {
	path := r.URL.Path

	switch {
	case strings.HasPrefix(path, "/dav/"):
		path = strings.TrimPrefix(path, "/dav/")
	case strings.HasPrefix(path, "/api/files/"):
		path = strings.TrimPrefix(path, "/api/files/")
	default:
		return ""
	}

	path = strings.Trim(path, "/")
	if path == "" {
		return ""
	}

	parts := strings.Split(path, "/")

	// если файл — берём директорию
	if strings.Contains(parts[len(parts)-1], ".") {
		parts = parts[:len(parts)-1]
	}

	return strings.Join(parts, ".")
}
