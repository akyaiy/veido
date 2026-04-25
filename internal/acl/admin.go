package acl

import (
	"database/sql"
	"errors"
	"log/slog"

	"github.com/mattn/go-sqlite3"
)

// Roles

func GetRoles(db *sql.DB, limit, offset int) []Role {
	rows, err := db.Query("SELECT id, name FROM roles LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return []Role{}
	}
	defer rows.Close()

	var roles []Role
	for rows.Next() {
		var role Role
		if err := rows.Scan(&role.ID, &role.Name); err != nil {
			slog.Warn("GetRoles - failed to read role", "err", err.Error())
			continue
		}
		roles = append(roles, role)
	}
	return roles
}

func CreateRole(db *sql.DB, name string) int64 {
	result, err := db.Exec("INSERT INTO roles name VALUES ?", name)
	if err != nil {
		var sqliteErr sqlite3.Error

		if errors.As(err, &sqliteErr) {
			if sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
				slog.Error("CreateRole db ErrConstraintUnique", "err", err.Error())
				return 0
			}
		}
		slog.Error("CreateRole db error", "err", err.Error())
		return 0
	}
	id, err := result.LastInsertId()
	if err != nil {
		slog.Error("CreateRole db error", "err", err.Error())
		return 0
	}
	return id
}

func UpdateRole(db *sql.DB, fields Role) error {
	result, err := db.Exec(
		"UPDATE roles SET name = ? WHERE id = ?",
		fields.Name, fields.ID,
	)
	if err != nil {
		slog.Error("UpdateRole db error", "err", err.Error())
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("UpdateRole db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("UpdateRole db error: role does not exists")
		return errors.New("role does not exists")
	}
	return nil
}

func DeleteRole(db *sql.DB, name string) error {
	result, err := db.Exec("DELETE FROM roles WHERE name = ?", name)
	if err != nil {
		slog.Error("DeleteRole db error", "err", err.Error())
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("DeleteRole db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("DeleteRole db error: role does not exists")
		return errors.New("role does not exists")
	}
	return nil
}

func AssignRoleToUser(db *sql.DB, roleID, userID int64) error {
	_, err := db.Exec("INSERT OR IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)", userID, roleID)
	return err
}

func DeAssignRoleToUser(db *sql.DB, roleID, userID int64) error {
	res, err := db.Exec(
		"DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
		userID,
		roleID,
	)
	if err != nil {
		slog.Error("DeAssignRoleToUser db error", "err", err.Error())
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		slog.Error("DeAssignRoleToUser db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("DeAssignRoleToUser db error: relation does not exist")
		return errors.New("relation does not exist")
	}

	return nil
}

// Permissions

func GetPermissions(db *sql.DB, limit, offset int) []Permission {
	rows, err := db.Query("SELECT id, name FROM permissions LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return []Permission{}
	}
	defer rows.Close()

	var permissions []Permission
	for rows.Next() {
		var permission Permission
		if err := rows.Scan(&permission.ID, &permission.Key); err != nil {
			slog.Warn("GetPermissions - failed to read permission", "err", err.Error())
			continue
		}
		permissions = append(permissions, permission)
	}
	return permissions
}

// Если функция возвращает значение [id] < 1, то произошла ошибка (смотреть в логах)
func CreatePermission(db *sql.DB, name string) int64 {
	result, err := db.Exec("INSERT INTO permissions key VALUES ?", name)
	if err != nil {
		var sqliteErr sqlite3.Error

		if errors.As(err, &sqliteErr) {
			if sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
				slog.Error("CreatePermission db ErrConstraintUnique", "err", err.Error())
				return 0
			}
		}
		slog.Error("CreatePermission db error", "err", err.Error())
		return 0
	}
	id, err := result.LastInsertId()
	if err != nil {
		slog.Error("CreatePermission db error", "err", err.Error())
		return 0
	}
	return id
}

func UpdatePermission(db *sql.DB, fields Permission) error {
	result, err := db.Exec(
		"UPDATE permissions SET key = ? WHERE id = ?",
		fields.Key, fields.ID,
	)
	if err != nil {
		slog.Error("UpdatePermission db error", "err", err.Error())
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("UpdatePermission db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("UpdatePermission db error: permission does not exists")
		return errors.New("permission does not exists")
	}
	return nil
}

func DeletePermission(db *sql.DB, name string) error {
	result, err := db.Exec("DELETE FROM permissions WHERE key = ?", name)
	if err != nil {
		slog.Error("DeletePermission db error", "err", err.Error())
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("DeletePermission db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("DeletePermission db error: permission does not exists")
		return errors.New("permission does not exists")
	}
	return nil
}

func AssignPermissionToRole(db *sql.DB, roleID, permID int64) error {
	_, err := db.Exec("INSERT OR IGNORE INTO role_permissions(role_id, permission_id) VALUES (?, ?)", roleID, permID)
	return err
}

func DeAssignPermissionToRole(db *sql.DB, roleID, permID int64) error {
	res, err := db.Exec(
		"DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?",
		roleID,
		permID,
	)
	if err != nil {
		slog.Error("DeAssignPermissionToRole db error", "err", err.Error())
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		slog.Error("DeAssignPermissionToRole db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("DeAssignPermissionToRole db error: relation does not exist")
		return errors.New("relation does not exist")
	}

	return nil
}