package acl

import (
	"database/sql"
	"log"
)

// PUBLIC API — добавлены заглавные (экспортируемые) функции
// Init ACL tables
func InitACL(db *sql.DB) error {
	stmt := `
CREATE TABLE IF NOT EXISTS groups (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT UNIQUE NOT NULL
);


CREATE TABLE IF NOT EXISTS permissions (
id INTEGER PRIMARY KEY AUTOINCREMENT,
key TEXT UNIQUE NOT NULL
);


CREATE TABLE IF NOT EXISTS group_permissions (
group_id INTEGER NOT NULL,
permission_id INTEGER NOT NULL,
UNIQUE(group_id, permission_id),
FOREIGN KEY(group_id) REFERENCES groups(id),
FOREIGN KEY(permission_id) REFERENCES permissions(id)
);


CREATE TABLE IF NOT EXISTS user_groups (
user_id INTEGER NOT NULL,
group_id INTEGER NOT NULL,
UNIQUE(user_id, group_id),
FOREIGN KEY(user_id) REFERENCES users(id),
FOREIGN KEY(group_id) REFERENCES groups(id)
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

	if err := migrateLegacyGroups(db); err != nil {
		return err
	}

	// Ensure there is a guest group (applies to unauthenticated users)
	//_, _ = db.Exec("INSERT OR IGNORE INTO groups(name) VALUES (?)", "guest")//"admin", "*"

	_, err = db.Exec(`INSERT OR IGNORE INTO groups(name) VALUES ('guest'), ('admin'), ('*')`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`INSERT OR IGNORE INTO permissions(key) VALUES ('*'), ('html.view.*'), ('auth.login')`)
	if err != nil {
		log.Fatal(err)
	}

	queries := []string{
		`
    INSERT OR IGNORE INTO group_permissions (group_id, permission_id)
    SELECT r.id, p.id
    FROM groups r, permissions p
    WHERE r.name = 'admin' AND p.key = '*'
    `,
		`
    INSERT OR IGNORE INTO group_permissions (group_id, permission_id)
    SELECT r.id, p.id
		FROM groups r, permissions p
		WHERE r.name = '*' AND p.key = 'html.view.*'
    `,
		`
    INSERT OR IGNORE INTO group_permissions (group_id, permission_id)
    SELECT r.id, p.id
    FROM groups r, permissions p
    WHERE r.name = 'guest' AND p.key = 'auth.login'
    `,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			log.Fatal(err)
		}
	}

	return nil
}

func migrateLegacyGroups(db *sql.DB) error {
	if ok, err := tableExists(db, "roles"); err != nil {
		return err
	} else if ok {
		if _, err := db.Exec(`
			INSERT OR IGNORE INTO groups(id, name)
			SELECT id, name FROM roles
		`); err != nil {
			return err
		}
	}

	if ok, err := tableExists(db, "role_permissions"); err != nil {
		return err
	} else if ok {
		if _, err := db.Exec(`
			INSERT OR IGNORE INTO group_permissions(group_id, permission_id)
			SELECT role_id, permission_id FROM role_permissions
		`); err != nil {
			return err
		}
	}

	if ok, err := tableExists(db, "user_roles"); err != nil {
		return err
	} else if ok {
		if _, err := db.Exec(`
			INSERT OR IGNORE INTO user_groups(user_id, group_id)
			SELECT user_id, role_id FROM user_roles
		`); err != nil {
			return err
		}
	}

	return nil
}

func tableExists(db *sql.DB, name string) (bool, error) {
	var exists bool
	err := db.QueryRow(`
		SELECT EXISTS(
			SELECT 1
			FROM sqlite_master
			WHERE type = 'table' AND name = ?
		)
	`, name).Scan(&exists)
	return exists, err
}
