package acl

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"

	"MyServer/internal/auth"
)

/**********************************************************************************************
 * RequirePermission — это middleware для проверки прав доступа:
 *
 * 1. Определяет нужное разрешение (perm) на основе строки или функции.
 * 2. Получает пользователя из запроса.
 * 3. Проверяет права пользователя через CanUserAccess.
 * 4. Возвращает:
 *		- 401 для гостей,
 * 		- 403 для пользователей без прав,
 * 		- или пропускает дальше к next.ServeHTTP.
 **********************************************************************************************/
func RequirePermission(db *sql.DB, aut *auth.Auth, permOrFunc interface{}, next http.HandlerFunc) http.HandlerFunc {
	// Это типичный Go-HTTP middleware: принимает ResponseWriter и Request.
	return func(w http.ResponseWriter, r *http.Request) {
		var perm string
		// Определяем тип perm: string или функция
		switch v := permOrFunc.(type) {
		case string:
			perm = v
			// Если строка оканчивается на .*, добавляем динамическую часть пути
			if strings.HasSuffix(perm, ".*") {
				base := strings.TrimSuffix(perm, ".*")
				path := strings.TrimPrefix(r.URL.Path, "/api/")
				path = strings.ReplaceAll(path, "/", ".")
				perm = base + "." + path
			}
		case func(*http.Request) string:
			perm = v(r)
		default:
			log.Println("RequirePermission: invalid perm type")
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		// Добавляем пермишен в базу, если его нет
		_, err := db.Exec(`INSERT OR IGNORE INTO permissions(key) VALUES(?)`, perm)
		if err != nil {
			fmt.Printf("permision:%v\n", perm)
			log.Println("RequirePermission: cannot insert permission:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		// Получаем пользователя
		user, err := aut.GetUserFromRequest(r)
		var uid int64
		if err != nil || user == nil {
			uid = 0 // guest
		} else {
			uid = user.ID
		}
		// Проверка прав
		ok, err := CanUserAccess(db, uid, perm)
		if err != nil {
			log.Println("ACL error:", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		// Обработка отсутствия доступа
		if !ok {
			if uid == 0 {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
			} else {
				http.Error(w, "Forbidden", http.StatusForbidden)
			}
			return
		}
		next.ServeHTTP(w, r)
	}
}
