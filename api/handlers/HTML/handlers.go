package HTML

import (
	//"database/sql"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	//"time"

	"MyServer/internal/auth"
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

		fmt.Println("Подключился пользователь с ID:", id)
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
	///////////////////////////////////////////////////////////////
	// if config.Data.User != "" {
	path = filepath.Join("data/HTML", name)
	// } else {
	// 	path = filepath.Join("data/pages/login")
	// }
	///////////////////////////////////////////////////////////////
	myHTML = loadFiles(path)
	if segments[0] == "block" {
		//fmt.Printf("name: %v\n", segments)
		myHTML.TIPE = "block"
		//
	} else {
		myHTML.TIPE = "page"
	}
	//}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(myHTML)
}

func loadFiles(dirPath string) *HTMLblock {
	fmt.Printf("Клиент запросил файл по адресу: '%s'\n", dirPath)

	var hBlock HTMLblock

	// Загружаем Content в переменную hBlock
	if pContent, err := os.ReadFile(dirPath + "/content.md"); err != nil {
		fmt.Printf("Файл content.md не найден: %v\n", err)
		hBlock.Content = "<h2>Запрашиваемая страница не найдена</h2>"
	} else {
		//		hBlock.Content = string(markdown.ToHTML(pContent, nil, nil))
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

		fmt.Printf("Клиент запросил страницу: '%s'\n", r.URL.Path)
		filePath = "./data/HTML/frontend/index.html"
		fmt.Printf("Отдаём: '%s'\n", filePath)
	}

	http.ServeFile(w, r, filePath)
}
