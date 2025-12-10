package acl

import (
	"database/sql"
)

// PUBLIC API — добавлены заглавные (экспортируемые) функции
// Init ACL tables
func InitACL(db *sql.DB) error {
	stmt := `
CREATE TABLE IF NOT EXISTS roles (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT UNIQUE NOT NULL
);


CREATE TABLE IF NOT EXISTS permissions (
id INTEGER PRIMARY KEY AUTOINCREMENT,
key TEXT UNIQUE NOT NULL
);


CREATE TABLE IF NOT EXISTS role_permissions (
role_id INTEGER NOT NULL,
permission_id INTEGER NOT NULL,
UNIQUE(role_id, permission_id),
FOREIGN KEY(role_id) REFERENCES roles(id),
FOREIGN KEY(permission_id) REFERENCES permissions(id)
);


CREATE TABLE IF NOT EXISTS user_roles (
user_id INTEGER NOT NULL,
role_id INTEGER NOT NULL,
UNIQUE(user_id, role_id),
FOREIGN KEY(user_id) REFERENCES users(id),
FOREIGN KEY(role_id) REFERENCES roles(id)
);
`
	_, err := db.Exec(stmt)
	if err != nil {
		return err
	}

	// Ensure there is a guest role (applies to unauthenticated users)
	_, _ = db.Exec("INSERT OR IGNORE INTO roles(name) VALUES (?)", "guest")

	return nil
}
