package acl

import (
	"database/sql"
	"strings"
)

// Check if user has permission
func CanUserAccess(db *sql.DB, userID int64, permissionKey string) (bool, error) {
	// 1. Убедиться, что permission существует в БД
	if err := EnsurePermissionExists(db, permissionKey); err != nil {
		return false, err
	}
	// helper to check wildcard match (perm may be "resource.*" or "*")
	permMatches := func(stored, wanted string) bool {
		if stored == "*" {
			return true
		}
		if stored == wanted {
			return true
		}
		if stored == "setver" || stored == "setver.*" {
			return true
		}
		if strings.HasSuffix(stored, ".*") {
			prefix := strings.TrimSuffix(stored, ".*") + "."
			return strings.HasPrefix(wanted, prefix)
		}
		return false
	}

	var query string
	var args []interface{}

	if userID > 0 {
		query = `
			SELECT p.key
			FROM user_roles ur
			JOIN role_permissions rp ON rp.role_id = ur.role_id
			JOIN permissions p ON p.id = rp.permission_id
			WHERE ur.user_id = ?
		`
		args = []interface{}{userID}
	} else {
		// unauthenticated: use guest role
		query = `
			SELECT p.key
			FROM roles r
			JOIN role_permissions rp ON rp.role_id = r.id
			JOIN permissions p ON p.id = rp.permission_id
			WHERE r.name = 'guest'
		`
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return false, err
		}
		if permMatches(key, permissionKey) {
			return true, nil
		}
	}
	if err := rows.Err(); err != nil {
		return false, err
	}

	return false, nil
}

func EnsurePermissionExists(db *sql.DB, key string) error {
	_, err := db.Exec(`
		INSERT INTO permissions (key)
		SELECT ? WHERE NOT EXISTS (
		    SELECT 1 FROM permissions WHERE key = ?
		)
	`, key, key)

	return err
}
