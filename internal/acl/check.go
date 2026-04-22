package acl

import (
	"database/sql"
	"strings"
)

// DEVMODE — если true, то при проверке прав будет разрешать доступ, даже если юзер не имеет нужного разрешения.
// Это может быть полезно для разработки, чтобы не заморачиваться с правами на начальном этапе.
// В продакшене должно быть false.
var DEVMODE = false

func CanUserAccess(db *sql.DB, userID int64, permissionKey string) (bool, error) {
	if DEVMODE {
		return true, nil
	}
	// Убедиться, что permission существует
	if err := EnsurePermissionExists(db, permissionKey); err != nil {
		return false, err
	}
	// helper: сопоставление permissions (stored здесь БЕЗ '!' префикса)
	matches := func(stored, wanted string) bool {
		if stored == "*" {
			return true
		}
		if stored == wanted {
			return true
		}
		if strings.HasSuffix(stored, ".*") {
			prefix := strings.TrimSuffix(stored, ".*")
			return strings.HasPrefix(wanted, prefix)
		}
		return false
	}
	// Сбор прав пользователя + прав роли '*' (которая предназначена для "всех")
	var query string
	var args []interface{}
	if userID > 0 {
		// Для зарегистрированного пользователя:
		// берем права тех ролей, что назначены юзеру (user_roles),
		// а также права роли с именем '*' (глобальные для всех).
		query = `
			SELECT DISTINCT p.key
			FROM role_permissions rp
			JOIN permissions p ON p.id = rp.permission_id
			JOIN roles r ON r.id = rp.role_id
			LEFT JOIN user_roles ur ON ur.role_id = r.id
			WHERE (ur.user_id = ? OR r.name = '*')
		`
		args = []interface{}{userID}
	} else {
		// Для гостя: права роли 'guest' + права роли '*'
		query = `
			SELECT DISTINCT p.key
			FROM role_permissions rp
			JOIN permissions p ON p.id = rp.permission_id
			JOIN roles r ON r.id = rp.role_id
			WHERE r.name IN ('guest','*')
		`
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	allow := make([]string, 0)
	deny := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return false, err
		}
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if strings.HasPrefix(key, "!") {
			deny = append(deny, key) // сохраняем с '!' — ниже будем trim
		} else {
			allow = append(allow, key)
		}
	}
	if err := rows.Err(); err != nil {
		return false, err
	}
	// 1️⃣ Проверяем запреты — приоритет №1
	for _, d := range deny {
		rule := strings.TrimPrefix(d, "!")

		if matches(rule, permissionKey) {
			return false, nil // запрещено
		}
	}
	// 2️⃣ Проверяем разрешения
	for _, a := range allow {
		if matches(a, permissionKey) {
			return true, nil
		}
	}
	return false, nil
}

// EnsurePermissionExists просто гарантирует, что в таблице permissions
// существует запись с таким ключом.
//
// Если записи нет — она её создаёт.
// Если есть — ничего не делает.
func EnsurePermissionExists(db *sql.DB, key string) error {
	_, err := db.Exec(`
		INSERT INTO permissions (key)
		SELECT ? WHERE NOT EXISTS (
		    SELECT 1 FROM permissions WHERE key = ?
		)
	`, key, key)

	return err
}
