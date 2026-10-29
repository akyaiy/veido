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
	// "github.com/akyaiy/veido/internal/auth"
	// "github.com/akyaiy/veido/internal/config"
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

func writeSourceHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FunctionName string `json:"functionName"`
		Code         string `json:"code"`
	}

	body, _ := io.ReadAll(r.Body)
	json.Unmarshal(body, &req)

	dir := "data/functions"
	os.MkdirAll(dir, 0755)

	filePath, err := writeSourceFile(dir, req.FunctionName, req.Code)
	if err != nil {
		http.Error(w, "write error: "+err.Error(), 400)
		return
	}

	w.Write([]byte(fmt.Sprintf("saved: %s", filePath)))
}

/*********************************************************************************
 * writeSourceFiler Обработчик /save                                            *
 * сохраняет написанный файл                                                   *
 *********************************************************************************/
func writeSourceFile(baseDir, functionName, code string) (string, error) {
	// ---------- Безопасный путь ----------
	safePath := filepath.Clean(functionName)

	if strings.HasPrefix(safePath, "..") ||
		strings.Contains(safePath, "../") ||
		filepath.IsAbs(safePath) {
		return "", fmt.Errorf("invalid path")
	}

	// Добавляем .go при необходимости
	if !strings.HasSuffix(safePath, ".go") {
		safePath += ".go"
	}

	// Полный путь к файлу
	filePath := filepath.Join(baseDir, safePath)

	// Создаём каталог при необходимости
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return "", err
	}

	// Записываем Go-файл
	if err := os.WriteFile(filePath, []byte(code), 0644); err != nil {
		return "", err
	}

	return filePath, nil
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
	name := strings.TrimPrefix(r.URL.Path, "/api/functions/run/")
	name = filepath.Clean(name)

	fmt.Printf("run funktion: %v\n", name)

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

// listHandler Обработчик /function/list
// Этот роут возвращает список функций.
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

/**************************************************************/
// func listHandler(w http.ResponseWriter, r *http.Request) {
// 	root := "data/functions"

// 	type Entry struct {
// 		Source *time.Time `json:"source,omitempty"`
// 		Bin    *time.Time `json:"bin,omitempty"`
// 	}

// 	result := make(map[string]*Entry)

// 	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
// 		if err != nil || info.IsDir() {
// 			return nil
// 		}

// 		rel, _ := filepath.Rel(root, path)
// 		base := strings.TrimSuffix(rel, filepath.Ext(rel))
// 		ext := filepath.Ext(rel)

// 		if _, ok := result[base]; !ok {
// 			result[base] = &Entry{}
// 		}

// 		mod := info.ModTime()

// 		if ext == ".go" {
// 			result[base].Source = &mod
// 		} else {
// 			result[base].Bin = &mod
// 		}

// 		return nil
// 	})

// 	w.Header().Set("Content-Type", "application/json")
// 	json.NewEncoder(w).Encode(result)
// }
