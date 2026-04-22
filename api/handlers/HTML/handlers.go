package HTML

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"MyServer/internal/auth"
	"MyServer/internal/config"
)

type HTMLblock struct {
	Content string `json:"content"`
	JS      string `json:"js"`
	CSS     string `json:"css"`
	TIPE    string `json:"tipe"`
}

func LoadProtected(aut *auth.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := aut.AuthenticateRequest(r)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{
			"message": "Hello from protected endpoint",
			"user_id": id,
		})
	}

}

func LoadHTML(w http.ResponseWriter, r *http.Request) {
	var path string
	var myHTML *HTMLblock
	name := strings.TrimPrefix(r.URL.Path, "/api/HTML/")
	segments := strings.Split(name, "/")
	if name == "" {
		name = "home"
	}
	path = filepath.Join(config.Data.HTTPBlockDir, name)
	myHTML = loadFiles(path)

	if segments[0] == "block" {
		myHTML.TIPE = "block"
	} else {
		myHTML.TIPE = "page"
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(myHTML)
}

func LoadHTMLBlock(aut *auth.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var path string
		var myHTML *HTMLblock
		name := strings.TrimPrefix(r.URL.Path, "/api/HTML/")
		segments := strings.Split(name, "/")
		if name == "" {
			name = "home"
		}
		path = filepath.Join(config.Data.HTTPBlockDir, name)
		myHTML = loadFiles(path)
		if segments[0] == "block" {
			myHTML.TIPE = "block"
		} else {
			myHTML.TIPE = "page"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(myHTML)
	}
}

func loadFiles(dirPath string) *HTMLblock {
	var hBlock HTMLblock
	// Загружаем Content в переменную hBlock
	if pContent, err := os.ReadFile(dirPath + "/content.md"); err != nil {
		fmt.Printf("Файл content.md не найден: %v\n", err)
		hBlock.Content = "<h2>Запрашиваемая страница не найдена</h2>"
	} else {
		hBlock.Content = string(pContent)
	}
	// Загружаем JS в переменную hBlock
	if pJS, err := os.ReadFile(dirPath + "/script.js"); err != nil {
		fmt.Printf("Файл script.js не найден: %v\n", err)
		hBlock.JS = ""
	} else {
		hBlock.JS = string(pJS)
	}
	// Загружаем CSS в переменную hBlock
	if pCSS, err := os.ReadFile(dirPath + "/style.css"); err != nil {
		fmt.Printf("Файл style.css не найден: %v\n", err)
		hBlock.CSS = ""
	} else {
		hBlock.CSS = string(pCSS)
	}
	return &hBlock
}

func LoadTemplatePage(w http.ResponseWriter, r *http.Request) {
	// читаем тело (если нужно)
	body, err := io.ReadAll(r.Body)
	if err == nil {
		r.Body = io.NopCloser(bytes.NewBuffer(body))
	}
	filePath := "./data/HTML/frontend" + r.URL.Path
	// SPA: если директория, .html или нет расширения → index.html
	if strings.HasSuffix(r.URL.Path, "/") ||
		strings.HasSuffix(r.URL.Path, ".html") ||
		path.Ext(r.URL.Path) == "" {
		filePath = config.Data.StaticDir + config.Data.TemplateFile
	}
	http.ServeFile(w, r, filePath)
}

type Status struct {
	Stat string `json:"status"`
	Message string `json:"message,omitempty"`
}

func CreateContainer(w http.ResponseWriter, r *http.Request) {
	var body HTMLblock
	json.NewDecoder(r.Body).Decode(&body)
	if body.CSS == "" || body.JS == "" || body.Content == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "wrong payload",
		})
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/api/HTML/")
	path := filepath.Join(config.Data.HTTPBlockDir, name)
	if info, err := os.Stat(path); err == nil && info.IsDir() {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotAcceptable)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "контейнер по такому пути уже существует",
		})
		return
	}
	err := os.MkdirAll(path, 0755)
	if err != nil {
		slog.Error("ошибка при создании контейнера", "err", err.Error())
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "server error",
		})
		return
	}
	files := make(map[string]string)
	files["content.md"] = body.Content
	files["script.js"] = body.JS
	files["style.css"] = body.CSS
	for part, value := range files {
		func(){
			file, err := os.Create(filepath.Join(path, part))
			if err != nil {
				slog.Error("ошибка при создании контейнера", "err", err.Error())
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(Status{
					Stat: "error",
					Message: "server error",
				})
				return
			}
			defer file.Close()

			_, err = file.WriteString(value)
			if err != nil {
				slog.Error("ошибка при создании контейнера", "err", err.Error())
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(Status{
					Stat: "error",
					Message: "server error",
				})
				return
			}
		}()
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func UpdateContainer(w http.ResponseWriter, r *http.Request) {
	var body HTMLblock
	json.NewDecoder(r.Body).Decode(&body)
	if body.CSS == "" && body.JS == "" && body.Content == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "wrong payload",
		})
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/api/HTML/")
	path := filepath.Join(config.Data.HTTPBlockDir, name)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotAcceptable)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "контейнер по такому пути не существует",
		})
		return
	}
	files := make(map[string]string)
	files["content.md"] = body.Content
	files["script.js"] = body.JS
	files["style.css"] = body.CSS
	for part, value := range files {
		// return при ошибках просто заканчивает интерацию, но не завершает функцию хендлера
		func(){
			if value == "" {
				return
			}
			file, err := os.Create(filepath.Join(path, part))
			if err != nil {
				slog.Error("ошибка при обновления контейнера", "err", err.Error())
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(Status{
					Stat: "error",
					Message: "server error",
				})
				return
			}
			defer file.Close()

			_, err = file.WriteString(value)
			if err != nil {
				slog.Error("ошибка при обновления контейнера", "err", err.Error())
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(Status{
					Stat: "error",
					Message: "server error",
				})
				return
			}
		}()
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}

func DeleteContainer(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/HTML/")
	path := filepath.Join(config.Data.HTTPBlockDir, name)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotAcceptable)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "контейнер по такому пути не существует",
		})
		return
	}
	err := os.RemoveAll(path)
	if err != nil {
		slog.Error("ошибка при удалении контейнера", "err", err.Error())
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Status{
			Stat: "error",
			Message: "server error",
		})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Status{
		Stat: "ok",
	})
}
