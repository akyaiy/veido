/***************************************************************************
* Веб-сервер на Go, который:                                               *
* Принимает Go-код от фронтенда (/compile)                                 *
* Сохраняет Go-файл                                                        *
* Компилирует его в бинарник                                               *
* Позволяет запускать этот бинарник с входными данными (/function/<имя>)   *
* Отдаёт фронтенд (index.html) по корню /                                  *
*                                                                          *
* Это полноценная система "компиляции и исполнения пользовательского кода".*
****************************************************************************/
package functions

import (
	// //"database/sql"
	// "bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"

	// "path"
	"path/filepath"
	"strings"
	// //"time"
	// "MyServer/internal/auth"
	// "MyServer/internal/config"
)

/*********************************************************************************
 * Структуры JSON-запросов                                                       *
 *                                                                               *
 * Когда фронтенд отправляет запрос на /compile, он шлёт JSON с:                 *
 * -именем функции (по сути — именем файла и бинарника)                          *
 * -Go-кодом                                                                     *
 *                                                                               *
 * А /function/<имя> принимает входную строку, которую подаёт на stdin бинарника.*
 *********************************************************************************/
type CompileRequest struct {
	FunctionName string `json:"functionName"`
	GoCode       string `json:"goCode"`
}

type RunRequest struct {
	Input string `json:"input"`
}

/********************************************************************************
 * sourceHandler Обработчик /function/source/                                   *
 * Этот роут возвращает исходник функции.                                       *
 ********************************************************************************/
func sourceHandler(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/functions/source/")
	name = filepath.Clean(name)

	if strings.HasPrefix(name, "..") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	// Автоматически добавляем .go, если пользователь не указал
	if !strings.HasSuffix(name, ".go") {
		name += ".go"
	}

	filePath := filepath.Join("data/functions", name)
	src, err := os.ReadFile(filePath)
	if err != nil {
		http.Error(w, "not found", 404)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(src)
}

/*********************************************************************************
 * compileHandler Обработчик /compile                                            *
 * компелирует написанный файл                                                   *
 *********************************************************************************/
func compileHandler(w http.ResponseWriter, r *http.Request) {
	var req CompileRequest
	body, _ := io.ReadAll(r.Body)
	json.Unmarshal(body, &req)

	dir := "data/functions"
	os.MkdirAll(dir, 0755)

	// ---------- Безопасный путь ----------
	safePath := filepath.Clean(req.FunctionName)

	if strings.HasPrefix(safePath, "..") ||
		strings.Contains(safePath, "../") ||
		filepath.IsAbs(safePath) {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	// Автоматически добавляем .go, если его нет
	if !strings.HasSuffix(safePath, ".go") {
		safePath += ".go"
	}

	// Полный путь к исходнику
	filePath := filepath.Join(dir, safePath)

	// Создаём директорию под ним (если многоуровневая)
	os.MkdirAll(filepath.Dir(filePath), 0755)

	// Путь к бинарнику — убираем расширение .go
	binaryPath := strings.TrimSuffix(filePath, ".go")

	if err := os.Remove(binaryPath); err != nil && !os.IsNotExist(err) {
		http.Error(w, "remove old binary: "+err.Error(), 500)
		return
	}

	// ---------- Записываем Go-файл ----------
	if err := os.WriteFile(filePath, []byte(req.GoCode), 0644); err != nil {
		http.Error(w, "write error: "+err.Error(), 500)
		return
	}

	// ---------- Компиляция ----------
	cmd := exec.Command("go", "build", "-o", binaryPath, filePath)
	out, err := cmd.CombinedOutput()
	//fmt.Printf()
	if err != nil {
		w.WriteHeader(500)
		w.Write([]byte(fmt.Sprintf("compile error:\n%s", string(out))))
		return
	}

	w.Write([]byte("compiled successfully"))
}

/********************************************************************************
 * runHandler Обработчик /function/<имя>                                        *
 * Этот роут запускает скомпилированный бинарник.                               *
 * Если вызываешь:                                                              *
 * POST /function/increment                                                     *
 * Сервер запускает файл:                                                       *
 * functions/increment                                                          *
 ********************************************************************************/
func runHandler(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/functions/")
	name = filepath.Clean(name)

	if strings.HasPrefix(name, "..") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	binary := filepath.Join("data/functions", name)

	var req RunRequest
	body, _ := io.ReadAll(r.Body)
	json.Unmarshal(body, &req)

	cmd := exec.Command(binary)
	cmd.Stdin = strings.NewReader(req.Input)

	out, err := cmd.CombinedOutput()
	if err != nil {
		w.WriteHeader(500)
		w.Write([]byte(fmt.Sprintf("run error:\n%s", string(out))))
		return
	}

	w.Write(out)
}

/********************************************************************************
 * listHandler Обработчик /function/list                                        *
 * Этот роут возвращает список функций.                                         *
 ********************************************************************************/
func listHandler(w http.ResponseWriter, r *http.Request) {
	root := "data/functions"
	var files []string

	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}

		// пропускаем исходники .go
		if strings.HasSuffix(path, ".go") {
			return nil
		}

		rel, _ := filepath.Rel(root, path)
		files = append(files, rel)
		return nil
	})

	json.NewEncoder(w).Encode(files)
}
