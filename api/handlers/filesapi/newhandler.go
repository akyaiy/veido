package filesapi

import (
	"MyServer/internal/auth"
	"MyServer/internal/vfs"
	"database/sql"
	"encoding/json"
	"net/http"

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
func NewFilesHandler(db *sql.DB, aut *auth.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Аутентификация пользователя
		//
		// Возвращает:
		// - user — структура пользователя (любой тип)
		// - err — ошибка, если пользователь не найден или токен невалиден
		user, err := aut.GetUserFromRequest(r)
		//fmt.Printf("User name:%v\n", user.Username)
		if err != nil {
			//http.Error(w, "unauthorized", http.StatusUnauthorized)
			user = &auth.User{ID: 0, Username: "Guest"}
			//return
		}

		vfsRoot := vfs.BuildVFS(db, user)

		path := chi.URLParam(r, "*")
		if path == "" {
			path = "/"
		}

		node, err := vfs.FindNode(vfsRoot, path)
		if err != nil {
			http.Error(w, "path not found", http.StatusNotFound)
			return
		}

		items := vfs.ListDir(node)

		// // Получение IP-адреса клиента
		// ip := r.RemoteAddr
		// if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		// 	ip = host
		// }
		// // Формирование структуры ответа
		// resp := RequestInfo{
		// 	Method:    r.Method,
		// 	URL:       r.URL.String(),
		// 	RemoteIP:  ip,
		// 	UserAgent: r.UserAgent(),
		// 	User:      user,
		// }
		// Установка заголовка ответа
		w.Header().Set("Content-Type", "application/json")
		// Отправка JSON-ответа
		json.NewEncoder(w).Encode(items)
	}
}
