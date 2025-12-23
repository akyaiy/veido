// package filesApi

// import (
// 	"encoding/json"
// 	"fmt"
// 	"io"
// 	"net/http"
// 	"os"
// 	"path/filepath"
// 	"strings"
// 	"time"

// 	"fServer/internal/files"

// 	"github.com/go-chi/chi/v5"
// )

// type FileInfo struct {
// 	Name    string `json:"name"`
// 	IsDir   bool   `json:"isDir"`
// 	Size    int64  `json:"size"`
// 	ModTime string `json:"modTime"`
// }

// func filesHandler(w http.ResponseWriter, r *http.Request) {
// 	path := chi.URLParam(r, "*") // захватывает путь после /api/files/

// 	// Если путь заканчивается на /copy или /move
// 	if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/copy") {
// 		copyHandler(w, r, path)
// 		return
// 	}
// 	if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/move") {
// 		moveHandler(w, r, path)
// 		return
// 	}

// 	switch r.Method {
// 	case http.MethodGet:
// 		rangeHeader := r.Header.Get("Range")
// 		if rangeHeader != "" {
// 			rangeHandler(w, r, path, rangeHeader)
// 		} else {
// 			getHandler(w, r, path)
// 		}
// 	case http.MethodHead:
// 		headHandler(w, r, path)
// 	case http.MethodPost:
// 		// если multipart/form-data → загрузка файла, иначе → создание папки
// 		if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
// 			uploadHandler(w, r, path)
// 		} else {
// 			mkdirHandler(w, r, path)
// 		}
// 	case http.MethodPut:
// 		putHandler(w, r, path)
// 	case http.MethodPatch:
// 		patchHandler(w, r, path)
// 	case http.MethodDelete:
// 		deleteHandler(w, r, path)
// 	case http.MethodOptions:
// 		w.Header().Set("Allow", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS")
// 		w.WriteHeader(http.StatusOK)
// 	default:
// 		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
// 	}
// }

// // -------------------- HANDLERS --------------------
// func getHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	full, err := files.SafePath(path)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	info, err := os.Stat(full)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	if info.IsDir() {
// 		list, err := files.ListDir(path)
// 		if err != nil {
// 			http.Error(w, err.Error(), http.StatusInternalServerError)
// 			return
// 		}
// 		out := make([]FileInfo, 0, len(list))
// 		for _, fi := range list {
// 			out = append(out, FileInfo{
// 				Name:    fi.Name(),
// 				IsDir:   fi.IsDir(),
// 				Size:    fi.Size(),
// 				ModTime: fi.ModTime().Format(time.RFC3339),
// 			})
// 		}
// 		w.Header().Set("Content-Type", "application/json")
// 		_ = json.NewEncoder(w).Encode(out)
// 		return
// 	}

// 	data, err := os.ReadFile(full)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}

// 	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
// 	_, _ = w.Write(data)
// }

// func headHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	full, err := files.SafePath(path)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	info, err := os.Stat(full)
// 	if err != nil || info.IsDir() {
// 		http.Error(w, "not a file", http.StatusBadRequest)
// 		return
// 	}

// 	w.Header().Set("Content-Length", string(info.Size()))
// 	w.Header().Set("Last-Modified", info.ModTime().Format(time.RFC1123))
// 	w.Header().Set("Content-Type", "application/octet-stream")
// }

// func uploadHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	err := r.ParseMultipartForm(32 << 20)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	file, fh, err := r.FormFile("file")
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	defer file.Close()

// 	dst := filepath.Join(path, fh.Filename)
// 	if err := files.UploadFile(dst, file); err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}

// 	w.WriteHeader(http.StatusCreated)
// }

// func mkdirHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	if err := files.MkdirPath(path); err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	w.WriteHeader(http.StatusCreated)
// }

// func putHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	full, err := files.SafePath(path)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	info, err := os.Stat(full)
// 	if err != nil || info.IsDir() {
// 		http.Error(w, "not a file", http.StatusBadRequest)
// 		return
// 	}

// 	data, err := io.ReadAll(r.Body)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}

// 	err = files.UploadFile(path, strings.NewReader(string(data)))
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}
// 	w.WriteHeader(http.StatusOK)
// }

// func patchHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	full, err := files.SafePath(path)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	f, err := os.OpenFile(full, os.O_APPEND|os.O_WRONLY, 0644)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	defer f.Close()

// 	data, err := io.ReadAll(r.Body)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}

// 	_, err = f.Write(data)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}
// 	w.WriteHeader(http.StatusOK)
// }

// func deleteHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	if err := files.DeletePath(path); err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	w.WriteHeader(http.StatusOK)
// }

// func copyHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	var req struct {
// 		Target string `json:"target"`
// 	}
// 	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	src, err := files.SafePath(path)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	dst, err := files.SafePath(req.Target)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	srcFile, err := os.Open(src)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}
// 	defer srcFile.Close()

// 	dstFile, err := os.Create(dst)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}
// 	defer dstFile.Close()

// 	if _, err := io.Copy(dstFile, srcFile); err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}

// 	w.WriteHeader(http.StatusOK)
// }

// func moveHandler(w http.ResponseWriter, r *http.Request, path string) {
// 	var req struct {
// 		Target string `json:"target"`
// 	}
// 	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	src, err := files.SafePath(path)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}
// 	dst, err := files.SafePath(req.Target)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	if err := os.Rename(src, dst); err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}

// 	w.WriteHeader(http.StatusOK)
// }

// // -------------------- RANGE --------------------
// func rangeHandler(w http.ResponseWriter, r *http.Request, path, rangeHeader string) {
// 	full, err := files.SafePath(path)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusBadRequest)
// 		return
// 	}

// 	f, err := os.Open(full)
// 	if err != nil {
// 		http.Error(w, err.Error(), http.StatusInternalServerError)
// 		return
// 	}
// 	defer f.Close()

// 	info, _ := f.Stat()
// 	size := info.Size()

// 	var start, end int64
// 	// Простейшая поддержка Range: bytes=start-end
// 	if _, err := fmt.Sscanf(rangeHeader, "bytes=%d-%d", &start, &end); err != nil || end >= size {
// 		end = size - 1
// 	}

// 	w.Header().Set("Content-Length", fmt.Sprintf("%d", end-start+1))
// 	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
// 	w.WriteHeader(http.StatusPartialContent)

// 	f.Seek(start, io.SeekStart)
// 	io.CopyN(w, f, end-start+1)
// }

package filesapi

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"MyServer/internal/files"

	"github.com/go-chi/chi/v5"
)

type FileInfo struct {
	Name    string `json:"name"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
}

// --- Универсальный обработчик ---
func FilesHandler(w http.ResponseWriter, r *http.Request) {
	// Получаем путь после /api/files
	path := chi.URLParam(r, "*")
	if path == "" {
		path = "/" // корень
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	full, err := files.SafePath(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		handleGet(w, r, full, path)
	case http.MethodHead:
		handleHead(w, r, full)
	case http.MethodPost:
		if strings.HasSuffix(r.URL.Path, "/copy") {
			handleCopy(w, r, path)
		} else if strings.HasSuffix(r.URL.Path, "/move") {
			handleMove(w, r, path)
		} else {
			handlePost(w, r, path)
		}
	case http.MethodPut:
		handlePut(w, r, full, path)
	case http.MethodPatch:
		handlePatch(w, r, full)
	case http.MethodDelete:
		handleDelete(w, r, path)
	case http.MethodOptions:
		w.Header().Set("Allow", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS")
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// -------------------- GET --------------------
func handleGet(w http.ResponseWriter, r *http.Request, full, path string) {
	info, err := os.Stat(full)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if info.IsDir() {
		list, err := files.ListDir(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := make([]FileInfo, 0, len(list))
		for _, fi := range list {
			out = append(out, FileInfo{
				Name:    fi.Name(),
				IsDir:   fi.IsDir(),
				Size:    fi.Size(),
				ModTime: fi.ModTime().Format(time.RFC3339),
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
		return
	}

	data, err := os.ReadFile(full)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(data)
}

// -------------------- HEAD --------------------
func handleHead(w http.ResponseWriter, r *http.Request, full string) {
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		http.Error(w, "not a file", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Length", string(info.Size()))
	w.Header().Set("Last-Modified", info.ModTime().Format(time.RFC1123))
	w.Header().Set("Content-Type", "application/octet-stream")
}

// -------------------- POST --------------------
func handlePost(w http.ResponseWriter, r *http.Request, path string) {
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		// Загрузка файла
		err := r.ParseMultipartForm(32 << 20)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		file, fh, err := r.FormFile("file")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer file.Close()

		dst := filepath.Join(path, fh.Filename)
		if err := files.UploadFile(dst, file); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		return
	}

	// Создание папки
	if err := files.MkdirPath(path); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// -------------------- PUT --------------------
func handlePut(w http.ResponseWriter, r *http.Request, full, path string) {
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		http.Error(w, "not a file", http.StatusBadRequest)
		return
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := files.UploadFile(path, strings.NewReader(string(data))); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// -------------------- PATCH --------------------
func handlePatch(w http.ResponseWriter, r *http.Request, full string) {
	f, err := os.OpenFile(full, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer f.Close()
	data, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_, err = f.Write(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// -------------------- DELETE --------------------
func handleDelete(w http.ResponseWriter, r *http.Request, path string) {
	if err := files.DeletePath(path); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// -------------------- COPY --------------------
func handleCopy(w http.ResponseWriter, r *http.Request, path string) {
	var req struct {
		Target string `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	src, err := files.SafePath(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	dst, err := files.SafePath(req.Target)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	srcFile, err := os.Open(src)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer srcFile.Close()
	dstFile, err := os.Create(dst)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer dstFile.Close()
	if _, err := io.Copy(dstFile, srcFile); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// -------------------- MOVE --------------------
func handleMove(w http.ResponseWriter, r *http.Request, path string) {
	var req struct {
		Target string `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	src, err := files.SafePath(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	dst, err := files.SafePath(req.Target)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := os.Rename(src, dst); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
