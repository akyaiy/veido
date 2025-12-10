package acl

import (
	"database/sql"
)

// PUBLIC — CreateRole
func CreateRole(db *sql.DB, name string) error {
	_, err := db.Exec("INSERT INTO roles(name) VALUES (?)", name)
	return err
}

// PUBLIC — CreatePermission
func CreatePermission(db *sql.DB, key string) error {
	_, err := db.Exec("INSERT INTO permissions(key) VALUES (?)", key)
	return err
}

// PUBLIC — AssignPermissionToRole
func AssignPermissionToRole(db *sql.DB, roleID, permID int64) error {
	_, err := db.Exec("INSERT OR IGNORE INTO role_permissions(role_id, permission_id) VALUES (?, ?)", roleID, permID)
	return err
}

// PUBLIC — AssignRoleToUser
func AssignRoleToUser(db *sql.DB, roleID, userID int64) error {
	_, err := db.Exec("INSERT OR IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)", userID, roleID)
	return err
}
