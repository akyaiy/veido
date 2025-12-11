package acl

import (
	"database/sql"
	"fmt"
	"strings"
)

// // CanUserAccess проверяет, имеет ли пользователь право (permission) с ключом permissionKey
// func CanUserAccess(db *sql.DB, userID int64, permissionKey string) (bool, error) {
// 	//fmt.Print("?\n")
// 	// 1. Убедиться, что permission существует в БД
// 	if err := EnsurePermissionExists(db, permissionKey); err != nil {
// 		//fmt.Print("?\n")
// 		return false, err
// 	}
// 	fmt.Print("!?\n")
// 	fmt.Printf("permission: %v\n", permissionKey)

// 	// Эта функция сравнивает право из БД (stored) с требуемым правом (wanted) с учётом:
// 	// ✔ Полного совпадения
// 	// "users.read" == "users.read"
// 	// ✔ Глобального wildcard
// 	// stored == "*" даёт доступ ко всему
// 	// helper to check wildcard match (perm may be "resource.*" or "*")
// 	permMatches := func(stored, wanted string) bool {
// 		//fmt.Printf("Право из BD: %v; требуемое право: v\n", stored) //, wanted
// 		//
// 		if stored == "*" {
// 			return true
// 		}
// 		//
// 		if stored == wanted {
// 			return true
// 		}
// 		// if stored == "setver" || stored == "setver.*" {
// 		// 	return true
// 		// }
// 		if strings.HasSuffix(stored, ".*") {
// 			prefix := strings.TrimSuffix(stored, ".*") + "."
// 			return strings.HasPrefix(wanted, prefix)
// 		}
// 		return false
// 	}

// 	var query string
// 	var args []interface{}

// 	if userID > 0 {
// 		query = `
// 			SELECT p.key
// 			FROM user_roles ur
// 			JOIN role_permissions rp ON rp.role_id = ur.role_id
// 			JOIN permissions p ON p.id = rp.permission_id
// 			WHERE ur.user_id = ?
// 		`
// 		args = []interface{}{userID}
// 	} else {
// 		// unauthenticated: use guest role
// 		query = `
// 			SELECT p.key
// 			FROM roles r
// 			JOIN role_permissions rp ON rp.role_id = r.id
// 			JOIN permissions p ON p.id = rp.permission_id
// 			WHERE r.name = 'guest'
// 		`
// 	}

// 	rows, err := db.Query(query, args...)
// 	if err != nil {
// 		return false, err
// 	}
// 	defer rows.Close()

// 	for rows.Next() {
// 		var key string
// 		if err := rows.Scan(&key); err != nil {
// 			return false, err
// 		}
// 		if permMatches(key, permissionKey) {
// 			return true, nil
// 		}
// 	}
// 	if err := rows.Err(); err != nil {
// 		return false, err
// 	}

// 	return false, nil
// }

func CanUserAccess(db *sql.DB, userID int64, permissionKey string) (bool, error) {
	// Убедиться, что permission существует
	if err := EnsurePermissionExists(db, permissionKey); err != nil {
		return false, err
	}

	// helper: сопоставление permissions (stored здесь БЕЗ '!' префикса)
	matches := func(stored, wanted string) bool {
		//fmt.Printf("stored: %v;wanted: %v\n", stored, wanted)
		if stored == "*" {
			return true
		}
		if stored == wanted {
			return true
		}
		//fmt.Printf("HasSuffix: %v\n", strings.HasSuffix(stored, ".*"))
		if strings.HasSuffix(stored, ".*") {
			//fmt.Printf("prefix: %v\n", strings.TrimSuffix(stored, ".*")+".")
			prefix := strings.TrimSuffix(stored, ".*")
			return strings.HasPrefix(wanted, prefix)
		}
		return false
	}

	// Сбор прав пользователя + прав роли '*' (которая предназначена для "всех")
	var query string
	var args []interface{}

	// var dbPath string
	// db.QueryRow("PRAGMA database_list").Scan(nil, &dbPath)
	// fmt.Println("DB USED:", dbPath)
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
	// fmt.Printf("rows: %v\n", rows)
	// for rows.Next() {
	// 	var key string
	// 	if err := rows.Scan(&key); err != nil {
	// 		log.Fatal(err)
	// 	}
	// 	fmt.Println("permission key:", key)
	// }
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
	fmt.Printf("allow: %v\n", allow)
	fmt.Printf("deny: %v\n", deny)

	if err := rows.Err(); err != nil {
		return false, err
	}

	// 1️⃣ Проверяем запреты — приоритет №1
	for _, d := range deny {
		rule := strings.TrimPrefix(d, "!")
		fmt.Printf("rule: %v; permission: %v\n", strings.TrimPrefix(d, "!"), permissionKey)
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
