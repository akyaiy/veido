package acl

import (
	"database/sql"
	"log"
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
	_, err := db.Exec(`PRAGMA foreign_keys = ON`)
	if err != nil {
		return err
	}
	_, err = db.Exec(stmt)
	if err != nil {
		return err
	}

	// Ensure there is a guest role (applies to unauthenticated users)
	//_, _ = db.Exec("INSERT OR IGNORE INTO roles(name) VALUES (?)", "guest")//"admin", "*"

	_, err = db.Exec(`INSERT OR IGNORE INTO roles(name) VALUES ('guest'), ('admin'), ('*')`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`INSERT OR IGNORE INTO permissions(key) VALUES ('*'), ('html.view.*')`)
	if err != nil {
		log.Fatal(err)
	}

	queries := []string{
		`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = 'admin' AND p.key = '*'
    `,
		`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r, permissions p
    WHERE r.name = '*' AND p.key = 'html.view.*'
    `,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			log.Fatal(err)
		}
	}

	return nil
}
