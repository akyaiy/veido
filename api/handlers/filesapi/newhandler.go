package filesapi

import (
	"MyServer/internal/auth"
	"MyServer/internal/vfs"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// Структура ответа
type RequestInfo struct {
	Method    string     `json:"method"`
	URL       string     `json:"url"`
	RemoteIP  string     `json:"remote_ip"`
	UserAgent string     `json:"user_agent"`
	User      *auth.User `json:"user"`
}

type VirtualFileInfo struct {
	name  string
	isDir bool
	size  int64
}

/*********************************************************************
 * NewFilesHandler функция создаёт HTTP-обработчик (handler), который:
 * - Принимает подключение к БД (db) и объект аутентификации (aut)
 * - Возвращает http.HandlerFunc — функцию, которую можно
 *   зарегистрировать в HTTP-сервере
 * При каждом HTTP-запросе:
 * - проверяет пользователя (аутентификация)
 * - извлекает IP, метод, URL, User-Agent
 * - возвращает всё это в формате JSON
 *********************************************************************/
// func NewFilesHandler(db *sql.DB, aut *auth.Auth) http.HandlerFunc {
// 	return func(w http.ResponseWriter, r *http.Request) {
// 		// Аутентификация пользователя
// 		//
// 		// Возвращает:
// 		// - user — структура пользователя (любой тип)
// 		// - err — ошибка, если пользователь не найден или токен невалиден
// 		user, err := aut.GetUserFromRequest(r)
// 		if err != nil {
// 			// Реальная ошибка (БД, токен, внутренняя проблема)
// 			http.Error(w, "authentication error", http.StatusInternalServerError)
// 			//http.Error(w, "unauthorized", http.StatusUnauthorized)
// 			//user = &auth.User{ID: 0, Username: "Guest"}
// 			return
// 		}

// 		vfsRoot := vfs.BuildVFS(db, user)

// 		path := chi.URLParam(r, "*")
// 		if path == "" {
// 			path = "/"
// 		}

// 		node, err := vfs.FindNode(vfsRoot, path)
// 		if err != nil {
// 			http.Error(w, "path not found", http.StatusNotFound)
// 			return
// 		}

// 		items := vfs.ListDir(node)
// 		// Установка заголовка ответа
// 		w.Header().Set("Content-Type", "application/json")
// 		// Отправка JSON-ответа
// 		json.NewEncoder(w).Encode(items)
// 	}
// }

func NewFilesHandler(db *sql.DB, aut *auth.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// 1️⃣ Пользователь (Guest или Auth)
		user, err := aut.GetUserFromRequest(r)
		if err != nil {
			http.Error(w, "authentication error", http.StatusInternalServerError)
			return
		}

		// 2️⃣ VFS
		vfsRoot := vfs.BuildVFS(db, user)

		// 3️⃣ Путь
		path := chi.URLParam(r, "*")
		if path == "" {
			path = "/"
		} else if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}

		// 4️⃣ Универсальный switch (как раньше)
		switch r.Method {

		case http.MethodGet:
			handleVFSGet(w, r, vfsRoot, path)

		case http.MethodHead:
			handleVFSHead(w, r, vfsRoot, path)

		case http.MethodPost:
			if strings.HasSuffix(r.URL.Path, "/copy") {
				handleVFSCopy(w, r, vfsRoot, path)
			} else if strings.HasSuffix(r.URL.Path, "/move") {
				handleVFSMove(w, r, vfsRoot, path)
			} else {
				handleVFSPost(w, r, vfsRoot, path)
			}

		case http.MethodPut:
			handleVFSPut(w, r, vfsRoot, path)

		case http.MethodPatch:
			handleVFSPatch(w, r, vfsRoot, path)

		case http.MethodDelete:
			handleVFSDelete(w, r, vfsRoot, path)

		case http.MethodOptions:
			w.Header().Set("Allow", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS")
			w.WriteHeader(http.StatusOK)

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

/***************************************************************************
 * handleVFSGet
 ***************************************************************************/
func handleVFSGet(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	node, err := vfs.FindNode(root, path)
	if err != nil {
		http.Error(w, "path not found", http.StatusNotFound)
		return
	}

	// Каталог → JSON список
	if node.IsDir {
		items := vfs.ListDir(node)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
		return
	}

	// Файл → отдаём содержимое
	f, err := vfs.OpenFile(node.Parent, node.Name)
	if err != nil {
		http.Error(w, "cannot open file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	http.ServeContent(w, r, node.Name, time.Now(), f)
}

/***************************************************************************
 * handleVFSHead
 ***************************************************************************/
func handleVFSHead(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	node, err := vfs.FindNode(root, path)
	if err != nil {
		http.Error(w, "path not found", http.StatusNotFound)
		return
	}

	if node.IsDir {
		w.WriteHeader(http.StatusOK)
		return
	}

	f, err := vfs.OpenFile(node.Parent, node.Name)
	if err != nil {
		http.Error(w, "cannot open file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	stat, _ := f.Stat()
	w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
	w.WriteHeader(http.StatusOK)
}

/***************************************************************************
 * handleVFSPost
 ***************************************************************************/
func handleVFSPost(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	node, err := vfs.FindNode(root, path)
	if err != nil {
		http.Error(w, "path not found", http.StatusNotFound)
		return
	}

	if !node.IsDir {
		http.Error(w, "not a directory", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file not provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if err := vfs.UploadFile(node, header.Filename, file); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

/***************************************************************************
 * handleVFSPut
 ***************************************************************************/
func handleVFSPut(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	dirPath, fileName := filepath.Split(path)

	if dirPath == "" {
		dirPath = "/"
	}

	parent, err := vfs.FindNode(root, dirPath)
	if err != nil {
		http.Error(w, "parent not found", http.StatusNotFound)
		return
	}

	if !parent.IsDir {
		http.Error(w, "not a directory", http.StatusBadRequest)
		return
	}

	if err := vfs.UploadFile(parent, fileName, r.Body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

/***************************************************************************
 * handleVFSPatch
 ***************************************************************************/
func handleVFSPatch(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	http.Error(w, "PATCH not implemented", http.StatusNotImplemented)
}

/***************************************************************************
 * handleVFSDelete
 ***************************************************************************/
func handleVFSDelete(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	dir, name := filepath.Split(path)
	if dir == "" {
		dir = "/"
	}

	parent, err := vfs.FindNode(root, dir)
	if err != nil {
		http.Error(w, "path not found", http.StatusNotFound)
		return
	}

	if err := vfs.Delete(parent, name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

/***************************************************************************
 * handleVFSCopy
 ***************************************************************************/
func handleVFSCopy(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	dst := r.URL.Query().Get("to")
	if dst == "" {
		http.Error(w, "missing destination", http.StatusBadRequest)
		return
	}

	// source
	srcDirPath, srcName := filepath.Split(path)
	if srcDirPath == "" {
		srcDirPath = "/"
	}

	srcParent, err := vfs.FindNode(root, srcDirPath)
	if err != nil {
		http.Error(w, "source not found", http.StatusNotFound)
		return
	}

	// destination
	dstDirPath, dstName := filepath.Split(dst)
	if dstDirPath == "" {
		dstDirPath = "/"
	}

	dstParent, err := vfs.FindNode(root, dstDirPath)
	if err != nil {
		http.Error(w, "destination not found", http.StatusNotFound)
		return
	}

	if err := vfs.CopyFile(srcParent, srcName, dstParent, dstName); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

/***************************************************************************
 * handleVFSMove
 ***************************************************************************/
func handleVFSMove(w http.ResponseWriter, r *http.Request, root *vfs.VFSNode, path string) {
	dst := r.URL.Query().Get("to")
	if dst == "" {
		http.Error(w, "missing destination", http.StatusBadRequest)
		return
	}

	// Разделяем исходный и целевой путь
	srcDir, srcName := filepath.Split(path)
	dstDir, dstName := filepath.Split(dst)

	// Находим исходный каталог
	srcParent, err := vfs.FindNode(root, srcDir)
	if err != nil {
		http.Error(w, "source not found", http.StatusNotFound)
		return
	}

	// Находим целевой каталог
	dstParent, err := vfs.FindNode(root, dstDir)
	if err != nil {
		http.Error(w, "destination not found", http.StatusNotFound)
		return
	}

	// Попытка переименования внутри одного каталога
	if srcParent == dstParent {
		if err := vfs.Rename(srcParent, srcName, dstName); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	// Перемещение между каталогами (разные parent)
	if err := vfs.CopyFile(srcParent, srcName, dstParent, dstName); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := vfs.Delete(srcParent, srcName); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

/***************************************************************************
 * handleVFSDelete
 ***************************************************************************/
