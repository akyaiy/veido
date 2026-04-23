package acl

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"

	"MyServer/internal/auth"
)

/***************************************************************************************************************
 * RequirePermission это middleware (промежуточный обработчик HTTP-запросов).
 *
 * Его задача:
 * 		Перед выполнением обработчика next проверить,
 *		имеет ли пользователь право (permission) выполнить этот запрос.
 * Если:
 *		права есть → запрос проходит дальше
 *		прав нет → возвращается 401 или 403
 ***************************************************************************************************************/
func RequirePermission(db *sql.DB, aut *auth.Auth, permOrFunc interface{}, next http.Handler) http.HandlerFunc {
	// Возврат middleware
	return func(w http.ResponseWriter, r *http.Request) {
		//fmt.Printf("user metod:%v\n", r.Method)
		// Разрешаем все стандартные и WebDAV методы
		switch r.Method {
		case "OPTIONS", "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE",
			"PROPFIND", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK":
			// Разрешаем продолжить
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		// Определение permission
		var perm string
		switch v := permOrFunc.(type) {
		// Вариант 1: permission — строка
		case string:
			perm = v
			//fmt.Printf("permisionS:%v = %v\n", perm, v)
			// Поддержка wildcard '.*'
			if strings.HasSuffix(perm, ".*") {
				base := strings.TrimSuffix(perm, ".*")
				path := strings.TrimPrefix(r.URL.Path, "/api/HTML/")
				path = strings.ReplaceAll(path, "/", ".")
				perm = base + "." + path
			}
		// Вариант 2: permission — функция
		case func(*http.Request) string:
			perm = v(r)
			//fmt.Printf("permisionF:%v\n", perm)
		default:
			fmt.Printf("invalid perm type\n")
			// Неверный тип 500
			log.Println("RequirePermission: invalid perm type")
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		// Регистрация permission в БД если такого ещё нет
		_, err := db.Exec(`INSERT OR IGNORE INTO permissions(key) VALUES(?)`, perm)
		if err != nil {
			log.Println("RequirePermission: cannot insert permission:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		// Определение пользователя, извлекается пользователь из JWT,
		// если не авторизован → user == nil
		user, err := aut.GetUserFromRequest(r)
		// Получение user ID
		var uid int64
		if err != nil || user == nil {
			uid = 0
		} else {
			uid = user.ID
		}
		// uid == 0 — анонимный пользователь
		//fmt.Printf("pesm user id: %v\n", uid)
		// Проверка прав доступа (ACL)
		ok, err := CanUserAccess(db, uid, perm)
		if err != nil {
			log.Println("ACL error:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		// Пользователь НЕ авторизован (uid == 0)
		if !ok {
			if uid == 0 {
				// Для WebDAV — говорим клиенту, что нужен BasicAuth
				if strings.HasPrefix(r.URL.Path, "/dav") {
					w.Header().Set("WWW-Authenticate", `Basic realm="WebDAV"`)
				}
				// Пользователь НЕ авторизован (uid == 0)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				//http.Error(w, "Forbidden", http.StatusForbidden)
			} else {
				// http.Error(w, "Forbidden", http.StatusForbidden)
				http.Error(w, "Forbidden", http.StatusForbidden)
				//http.Error(w, "Unauthorized", http.StatusUnauthorized)
			}
			return
		}
		// Если всё хорошо — передаём запрос дальше
		next.ServeHTTP(w, r)
	}
}

func RequirePermissionMW(db *sql.DB, aut *auth.Auth, permOrFunc interface{}) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return RequirePermission(db, aut, permOrFunc, next)
	}
}
