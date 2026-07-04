package files_api

import (
	"MyServer/internal/vfs"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

type File struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"is_dir"`
}

func unpackFile(file os.FileInfo) *File {
	return &File{
		Name:  file.Name(),
		Size:  file.Size(),
		IsDir: file.IsDir(),
	}
}

func writeError(w http.ResponseWriter, error string) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Status{Stat: "error", Data: error})
	w.WriteHeader(http.StatusInternalServerError) // FIXME: This should be more specific based on the error type
}

func (h *FileHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	op := r.URL.Query().Get("op")
	ctx := r.Context()
	switch op {
	case "stat":
		stat, err := h.Manager.Stat(ctx, r.URL.Path)
		if err != nil {
			writeError(w, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(unpackFile(stat))
		if err != nil {
			writeError(w, err.Error())
			return
		}
	case "full-read":
		stat, err := h.Manager.Stat(ctx, r.URL.Path)
		if err != nil {
			writeError(w, err.Error())
			return
		}
		if stat.IsDir() {
			files, err := h.Manager.ReadDir(ctx, r.URL.Path)
			if err != nil {
				writeError(w, err.Error())
				return
			}
			var unpackedFiles []*File
			for _, file := range files {
				unpackedFiles = append(unpackedFiles, unpackFile(file))
			}
			w.Header().Set("Content-Type", "application/json")
			err = json.NewEncoder(w).Encode(unpackedFiles)
			if err != nil {
				writeError(w, err.Error())
				return
			}
		} else {
			file, err := h.Manager.OpenFile(ctx, r.URL.Path, os.O_RDONLY)
			if err != nil {
				writeError(w, err.Error())
				return
			}
			defer file.Close()
			w.Header().Set("Content-Type", "application/octet-stream")
			w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(r.URL.Path))
			_, err = io.Copy(w, file)
			if err != nil {
				writeError(w, err.Error())
				return
			}
		}
	default:
		http.Error(w, "Invalid operation", http.StatusBadRequest)
		return
	}
}

// write file or mkdir
func (h *FileHandler) handlePost(w http.ResponseWriter, r *http.Request) {
	typ := r.URL.Query().Get("type")
	ctx := r.Context()
	_, err := h.Manager.Stat(ctx, r.URL.Path)
	if err == nil {
		writeError(w, os.ErrExist.Error())
		return
	}
	switch typ {
	case "file":
		file, err := h.Manager.OpenFile(ctx, r.URL.Path, os.O_CREATE|os.O_WRONLY)
		if err != nil {
			writeError(w, err.Error())
			return
		}
		defer file.Close()
		_, err = io.Copy(file, r.Body)
		if err != nil {
			writeError(w, err.Error())
			return
		}
	case "dir":
		_, err := h.Manager.Mkdir(ctx, r.URL.Path)
		if err != nil {
			writeError(w, err.Error())
			return
		}
	default:
		http.Error(w, "Invalid type", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *FileHandler) handlePatch(w http.ResponseWriter, r *http.Request) {
	op := r.URL.Query().Get("op")
	ctx := r.Context()
	switch op {
	case "write":
		file, err := h.Manager.OpenFile(ctx, r.URL.Path, os.O_WRONLY)
		if err != nil {
			writeError(w, err.Error())
			return
		}
		defer file.Close()
		_, err = io.Copy(file, r.Body)
		if err != nil {
			writeError(w, err.Error())
			return
		}
	case "move": // identical to coreutils move
		dest := r.URL.Query().Get("dest")
		err := h.Manager.Move(ctx, r.URL.Path, dest)
		if err != nil {
			writeError(w, err.Error())
			return
		}
	default:
		http.Error(w, "Invalid operation", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *FileHandler) handleDelete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	err := h.Manager.Delete(ctx, r.URL.Path)
	if err != nil {
		writeError(w, err.Error())
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *FileHandler) handleMountsGet(w http.ResponseWriter, r *http.Request) {
}

func (h *FileHandler) handleMountsPost(w http.ResponseWriter, r *http.Request) {
	driver := r.URL.Query().Get("driver")
	mountPath := r.URL.Query().Get("mount-dir")
	_, _ = driver, mountPath
}

func (h *FileHandler) handleMountsDelete(w http.ResponseWriter, r *http.Request) {
	rec := chi.URLParam(r, "r")
	_ = rec
}

func (h *FileHandler) handleSharedGet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userId := ctx.Value("user_id")
	if userId == nil {
		http.Error(w, "user_id not found", http.StatusUnauthorized)
		return
	}
	
	refersTo := r.URL.Query().Get("refers-to")
	switch refersTo {
	case "":
		http.Error(w, "refers-to query parameter is required", http.StatusBadRequest)
		return
	case "atm":
		ids, err := h.SharedManager.AccesibleToMe(ctx, userId.(int))
		if err != nil {
			writeError(w, err.Error())
			return
		}
		fileInfos := make([]File, 0, len(ids))
		for _, id := range ids {
			node, err := h.MountManager.Stat(ctx, id)
			if err != nil {
				log.Printf("failed to stat file: %v", err.Error())
				continue
			}
			fileInfos = append(fileInfos, *unpackFile(vfs.NewFileInfo(node)))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(fileInfos)
		return
	case "afm":
		// targetId := r.URL.Query().Get("target-id")
		// targetInt, err := strconv.Atoi(targetId)
		// if targetId == "" || err != nil {
		// 	http.Error(w, "target-id query parameter is required", http.StatusBadRequest)
		// 	return
		// }
		ids, err := h.SharedManager.AvaibleFromMe(ctx, userId.(int))
		if err != nil {
			writeError(w, err.Error())
			return
		}
		fileInfos := make([]File, 0, len(ids))
		for _, id := range ids {
			node, err := h.MountManager.Stat(ctx, id)
			if err != nil {
				log.Printf("failed to stat file: %v", err.Error())
				continue
			}
			fileInfos = append(fileInfos, *unpackFile(vfs.NewFileInfo(node)))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(fileInfos)
		return
	default:
		http.Error(w, "unknown refers-to parameter "+refersTo, http.StatusBadRequest)
		return
	}
}

func parseUsers(usersStr string) []string {
	parts := strings.Split(usersStr, ":")
	for i, part := range parts {
		parts[i] = strings.TrimSpace(part)
	}
	return parts
}

func (h *FileHandler) handleSharedPost(w http.ResponseWriter, r *http.Request) {
	users := parseUsers(r.URL.Query().Get("users"))
	rights := r.URL.Query().Get("rights")
	rightsInt, err := strconv.Atoi(rights)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid rights"})
		return
	}
	
	ctx := r.Context()
	ownerId := ctx.Value("user_id").(int)
	for _, user := range users {
		userId, err := strconv.Atoi(user)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid user id"})
			return
		}
		err = h.SharedManager.CreateShare(ctx, ownerId, userId, r.URL.Path, rightsInt)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
	}
}

func (h *FileHandler) handleSharedDelete(w http.ResponseWriter, r *http.Request) {
	users := parseUsers(r.URL.Query().Get("users"))	
	ctx := r.Context()
	ownerId := ctx.Value("user_id").(int)
	for _, user := range users {
		userId, err := strconv.Atoi(user)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid user id"})
			return
		}
		err = h.SharedManager.DeleteShare(ctx, ownerId, userId, r.URL.Path)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
	}
}