package files

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var baseDir string

func safePath(p string) (string, error) {
	p = strings.TrimPrefix(p, "/")
	clean := filepath.Clean(p)
	full := filepath.Join(baseDir, clean)
	rel, err := filepath.Rel(baseDir, full)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(rel, "..") {
		return "", os.ErrPermission
	}
	return full, nil
}

type FileInfo struct {
	Name    string `json:"name"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
}

func listHandler(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("path")
	full, err := safePath(p)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	f, err := os.Open(full)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer f.Close()
	infos, err := f.Readdir(-1)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out := []FileInfo{}
	for _, fi := range infos {
		out = append(out, FileInfo{
			Name:    fi.Name(),
			IsDir:   fi.IsDir(),
			Size:    fi.Size(),
			ModTime: fi.ModTime().Format(time.RFC3339),
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("path")
	full, err := safePath(p)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	i, err := os.Stat(full)
	if err != nil || i.IsDir() {
		http.Error(w, "not a file", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Disposition", "attachment; filename=\""+i.Name()+"\"")
	ctype := mime.TypeByExtension(filepath.Ext(i.Name()))
	if ctype == "" {
		ctype = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ctype)
	http.ServeFile(w, r, full)
}

func viewHandler(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("path")
	full, err := safePath(p)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	b, err := os.ReadFile(full)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(b)
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(32 << 20)
	p := r.FormValue("path")
	fullDir, err := safePath(p)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	file, fh, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()
	dstPath := filepath.Join(fullDir, fh.Filename)
	out, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer out.Close()
	io.Copy(out, file)
	w.WriteHeader(http.StatusCreated)
}

func mkdirHandler(w http.ResponseWriter, r *http.Request) {
	p := r.FormValue("path")
	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "name empty", http.StatusBadRequest)
		return
	}
	full, err := safePath(filepath.Join(p, name))
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	err = os.Mkdir(full, 0755)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func deleteHandler(w http.ResponseWriter, r *http.Request) {
	p := r.FormValue("path")
	full, err := safePath(p)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	err = os.RemoveAll(full)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
