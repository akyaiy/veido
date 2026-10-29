package httpapi

import (
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"strconv"
)

func (h *Handler) handleStat(w http.ResponseWriter, r *http.Request) {
	actor, uri, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	node, err := h.frontend.Stat(r.Context(), actor, uri)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if err := writeJSON(w, http.StatusOK, nodeToResponse(node)); err != nil {
		h.logResponseError(r, err)
	}
}

func (h *Handler) handleList(w http.ResponseWriter, r *http.Request) {
	actor, uri, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	nodes, err := h.frontend.ReadDir(r.Context(), actor, uri)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if err := writeJSON(w, http.StatusOK, nodesToResponse(nodes)); err != nil {
		h.logResponseError(r, err)
	}
}

func (h *Handler) handleRead(w http.ResponseWriter, r *http.Request) {
	actor, uri, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	file, err := h.frontend.OpenFile(r.Context(), actor, uri, os.O_RDONLY)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		h.writeError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	if info.Size() >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	}
	if disposition := mime.FormatMediaType("attachment", map[string]string{"filename": info.Name()}); disposition != "" {
		w.Header().Set("Content-Disposition", disposition)
	}
	w.WriteHeader(http.StatusOK)
	_, copyErr := io.Copy(w, file)
	closeErr := file.Close()
	if copyErr != nil {
		h.logResponseError(r, copyErr)
	}
	if closeErr != nil {
		h.logResponseError(r, closeErr)
	}
}

func (h *Handler) handleCreateFile(w http.ResponseWriter, r *http.Request) {
	h.writeFile(w, r, os.O_CREATE|os.O_WRONLY|os.O_EXCL, http.StatusCreated)
}

func (h *Handler) handleReplaceFile(w http.ResponseWriter, r *http.Request) {
	h.writeFile(w, r, os.O_WRONLY|os.O_TRUNC, http.StatusNoContent)
}

func (h *Handler) writeFile(w http.ResponseWriter, r *http.Request, flags, successStatus int) {
	actor, uri, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if r.ContentLength > h.limits.MaxFileWriteBytes {
		h.writeError(w, r, requestProblem(http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large", nil))
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, h.limits.MaxFileWriteBytes)
	file, err := h.frontend.OpenFile(r.Context(), actor, uri, flags)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	written, copyErr := io.Copy(file, r.Body)
	if copyErr == nil && r.ContentLength >= 0 && written != r.ContentLength {
		copyErr = io.ErrUnexpectedEOF
	}
	closeErr := vfs.FinishWrite(file, copyErr)
	if copyErr != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(copyErr, &maxBytesErr) {
			copyErr = requestProblem(http.StatusRequestEntityTooLarge, "payload_too_large", "request body is too large", copyErr)
		}
		h.writeError(w, r, copyErr)
		return
	}
	if closeErr != nil {
		h.writeError(w, r, closeErr)
		return
	}
	if successStatus == http.StatusNoContent {
		writeNoContent(w)
		return
	}
	w.WriteHeader(successStatus)
}

func (h *Handler) handleCreateDirectory(w http.ResponseWriter, r *http.Request) {
	actor, uri, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	node, err := h.frontend.Mkdir(r.Context(), actor, uri)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if err := writeJSON(w, http.StatusCreated, nodeToResponse(node)); err != nil {
		h.logResponseError(r, err)
	}
}

func (h *Handler) handleMove(w http.ResponseWriter, r *http.Request) {
	actor, source, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	var input moveRequest
	if err := decodeJSON(w, r, h.limits.MaxJSONBytes, &input); err != nil {
		h.writeError(w, r, err)
		return
	}
	if input.TargetURI == "" {
		h.writeError(w, r, requestProblem(http.StatusBadRequest, "invalid_argument", "target_uri is required", nil))
		return
	}
	target, err := common.CastURI(input.TargetURI)
	if err != nil {
		h.writeError(w, r, requestProblem(http.StatusBadRequest, "invalid_argument", "target_uri is not a canonical VFS URI", err))
		return
	}
	if err := h.frontend.Move(r.Context(), actor, source, target); err != nil {
		h.writeError(w, r, err)
		return
	}
	writeNoContent(w)
}

func (h *Handler) handleDelete(w http.ResponseWriter, r *http.Request) {
	actor, uri, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if err := h.frontend.Delete(r.Context(), actor, uri); err != nil {
		h.writeError(w, r, err)
		return
	}
	writeNoContent(w)
}

func (h *Handler) handleControl(w http.ResponseWriter, r *http.Request) {
	actor, uri, err := h.requestTarget(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	commands := r.URL.Query()["command"]
	if len(commands) != 1 || commands[0] == "" {
		h.writeError(w, r, requestProblem(http.StatusBadRequest, "invalid_argument", "exactly one non-empty command parameter is required", nil))
		return
	}
	input, err := readLimitedBody(w, r, h.limits.MaxControlBytes)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	output, err := h.frontend.Control(r.Context(), actor, uri, commands[0], input)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(output); err != nil {
		h.logResponseError(r, err)
	}
}

func (h *Handler) logResponseError(r *http.Request, err error) {
	h.logger.ErrorContext(r.Context(), "VFS HTTP response failed", slog.Any("error", err))
}
