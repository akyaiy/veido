package httpapi

import (
	"MyServer/internal/vfs/v2"
	"encoding/json"
	"net/http"
	"time"
)

type nodeResponse struct {
	Name      string    `json:"name"`
	Kind      string    `json:"kind"`
	IsDir     bool      `json:"is_dir"`
	Size      int64     `json:"size"`
	UpdatedAt time.Time `json:"updated_at"`
}

type listResponse struct {
	Items []nodeResponse `json:"items"`
}

type problemResponse struct {
	Error problemBody `json:"error"`
}

type problemBody struct {
	Code      string         `json:"code"`
	Message   string         `json:"message"`
	Operation v2.Operation   `json:"operation,omitempty"`
	RequestID string         `json:"request_id,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
}

func nodeToResponse(node *v2.Node) nodeResponse {
	if node == nil {
		return nodeResponse{}
	}
	return nodeResponse{
		Name:      node.Name,
		Kind:      node.Kind,
		IsDir:     node.IsDir,
		Size:      node.Size,
		UpdatedAt: node.UpdatedAt,
	}
}

func nodesToResponse(nodes []*v2.Node) listResponse {
	items := make([]nodeResponse, 0, len(nodes))
	for _, node := range nodes {
		items = append(items, nodeToResponse(node))
	}
	return listResponse{Items: items}
}

func writeJSON(w http.ResponseWriter, status int, value any) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(value)
}

func writeNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
