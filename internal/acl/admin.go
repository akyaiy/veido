package acl

import (
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/mattn/go-sqlite3"
)

// Groups

func GetGroups(db *sql.DB, limit, offset int) []Group {
	rows, err := db.Query("SELECT id, name FROM groups LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		slog.Error("GetGroups db error", "err", err.Error())
		return []Group{}
	}
	defer rows.Close()

	var groups []Group
	for rows.Next() {
		var group Group
		if err := rows.Scan(&group.ID, &group.Name); err != nil {
			slog.Warn("GetGroups - failed to read group", "err", err.Error())
			continue
		}
		groups = append(groups, group)
	}
	return groups
}

// Если функция возвращает значение [id] < 1, то произошла ошибка (смотреть в логах)
func CreateGroup(db *sql.DB, name string) int64 {
	result, err := db.Exec("INSERT INTO groups (name) VALUES (?)", name)
	if err != nil {
		var sqliteErr sqlite3.Error

		if errors.As(err, &sqliteErr) {
			if sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
				slog.Error("CreateGroup db ErrConstraintUnique", "err", err.Error())
				return 0
			}
		}
		slog.Error("CreateGroup db error", "err", err.Error())
		return 0
	}
	id, err := result.LastInsertId() 

	if err != nil {
		slog.Error("CreateGroup db error", "err", err.Error())
		return 0
	}
	return id
}

func UpdateGroup(db *sql.DB, fields Group) error {
	result, err := db.Exec(
		"UPDATE groups SET name = ? WHERE id = ?",
		fields.Name, fields.ID,
	)
	if err != nil {
		slog.Error("UpdateGroup db error", "err", err.Error())
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("UpdateGroup db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("UpdateGroup db error: group does not exists")
		return errors.New("group does not exists")
	}
	return nil
}

func DeleteGroup(db *sql.DB, id int64) error {
	result, err := db.Exec("DELETE FROM groups WHERE id = ?", id)
	if err != nil {
		slog.Error("DeleteGroup db error", "err", err.Error())
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("DeleteGroup db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("DeleteGroup db error: group does not exists")
		return errors.New("group does not exists")
	}
	return nil
}

func AssignGroupToUser(db *sql.DB, groupID, userID int64) error {
	_, err := db.Exec(
		"INSERT INTO user_groups(user_id, group_id) VALUES (?, ?)",
		userID, groupID,
	)

	if err != nil {
		if strings.Contains(err.Error(), "FOREIGN KEY constraint failed") {
			return fmt.Errorf("user or group does not exist")
		}
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return fmt.Errorf("group already assigned")
		}

		slog.Error("AssignGroupToUser db error", "err", err.Error())
		return err
	}
	return nil
}

func GetUserGroups(db *sql.DB, userID int64, limit, offset int) ([]Group, error) {
	groups := []Group{}
	rows, err := db.Query(
		`SELECT u.id, r.id, r.name 
		FROM users u
		LEFT JOIN user_groups ur ON u.id = ur.user_id
		LEFT JOIN groups r ON ur.group_id = r.id
		WHERE u.id = ? LIMIT ? OFFSET ?`, userID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userFound := false

	for rows.Next() {
		userFound = true
		var uID int64
		var rID sql.NullInt64
		var rName sql.NullString

		if err := rows.Scan(&uID, &rID, &rName); err != nil {
			slog.Warn("Scan error", "err", err)
			continue
		}

		if rID.Valid {
			groups = append(groups, Group{
				ID:   rID.Int64,
				Name: rName.String,
			})
		}
	}

	if !userFound {
		return nil, fmt.Errorf("user with id %d not found", userID)
	}

	return groups, nil
}

func DeAssignGroupToUser(db *sql.DB, groupID, userID int64) error {
	res, err := db.Exec(
		"DELETE FROM user_groups WHERE user_id = ? AND group_id = ?",
		userID,
		groupID,
	)
	if err != nil {
		slog.Error("DeAssignGroupToUser db error", "err", err.Error())
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		slog.Error("DeAssignGroupToUser db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("DeAssignGroupToUser db error: relation does not exist")
		return errors.New("relation does not exist")
	}

	return nil
}

// Permissions

func GetPermissions(db *sql.DB, limit, offset int) []Permission {
	rows, err := db.Query("SELECT id, key FROM permissions LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		slog.Error("GetPermissions db error", "err", err.Error())
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
	result, err := db.Exec("INSERT INTO permissions (key) VALUES (?)", name)
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

func DeletePermission(db *sql.DB, id int64) error {
	result, err := db.Exec("DELETE FROM permissions WHERE id = ?", id)
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

func AssignPermissionToGroup(db *sql.DB, groupID, permID int64) error {
	_, err := db.Exec(
		"INSERT INTO group_permissions(group_id, permission_id) VALUES (?, ?)",
		groupID, permID,
	)

	if err != nil {
		if strings.Contains(err.Error(), "FOREIGN KEY constraint failed") {
			return fmt.Errorf("group or permission does not exist")
		}
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return fmt.Errorf("permission already assigned to group")
		}

		slog.Error("AssignPermissionToGroup db error", "err", err.Error())
		return err
	}

	return nil
}

func GetGroupPermissions(db *sql.DB, groupID int64, limit, offset int) ([]Permission, error) {
	permissions := []Permission{}

	rows, err := db.Query(
		`SELECT r.id, p.id, p.key 
		FROM groups r
		LEFT JOIN group_permissions rp ON r.id = rp.group_id
		LEFT JOIN permissions p ON rp.permission_id = p.id
		WHERE r.id = ? LIMIT ? OFFSET ?`, groupID, limit, offset,
	)
	if err != nil {
		slog.Error("GetGroupPermissions db error", "err", err.Error())
		return nil, err
	}
	defer rows.Close()

	groupFound := false
	for rows.Next() {
		groupFound = true
		var rID int64
		var pID sql.NullInt64
		var pKey sql.NullString

		if err := rows.Scan(&rID, &pID, &pKey); err != nil {
			slog.Warn("GetGroupPermissions - scan error", "err", err.Error())
			continue
		}

		if pID.Valid {
			permissions = append(permissions, Permission{
				ID:  pID.Int64,
				Key: pKey.String,
			})
		}
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	if !groupFound {
		return nil, fmt.Errorf("group with id %d not found", groupID)
	}

	return permissions, nil
}

func DeAssignPermissionToGroup(db *sql.DB, groupID, permID int64) error {
	res, err := db.Exec(
		"DELETE FROM group_permissions WHERE group_id = ? AND permission_id = ?",
		groupID,
		permID,
	)
	if err != nil {
		slog.Error("DeAssignPermissionToGroup db error", "err", err.Error())
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		slog.Error("DeAssignPermissionToGroup db error", "err", err.Error())
		return err
	}

	if rows == 0 {
		slog.Error("DeAssignPermissionToGroup db error: relation does not exist")
		return errors.New("relation does not exist")
	}

	return nil
}

type UserPermission struct {
	ID  int64 `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
	ProvidingGroups []string `json:"providingGroups,omitempty"`
	Access string `json:"access"` // "deny" or "allow"
}

func GetUserPermissions(db *sql.DB, userID int64, limit, offset int) ([]UserPermission, error) {
	permissions := []UserPermission{}

	rows, err := db.Query(
		`SELECT p.id, p.key, r.name
		FROM users u
		LEFT JOIN user_groups ur ON u.id = ur.user_id
		LEFT JOIN groups r ON ur.group_id = r.id
		LEFT JOIN group_permissions rp ON r.id = rp.group_id
		LEFT JOIN permissions p ON rp.permission_id = p.id
		WHERE u.id = ?
		LIMIT ? OFFSET ?`, userID, limit, offset,
	)
	if err != nil {
		slog.Error("GetUserPermissions db error", "err", err.Error())
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pID sql.NullInt64
		var pKey sql.NullString
		var rName sql.NullString

		if err := rows.Scan(&pID, &pKey, &rName); err != nil {
			slog.Warn("GetUserPermissions - scan error", "err", err.Error())
			continue
		}

		if pID.Valid {
			providingGroup := ""
			if rName.Valid {
				providingGroup = rName.String
			}

			found := false
			for i := range permissions {
				if permissions[i].ID == pID.Int64 {
					if providingGroup != "" {
						already := false
						for _, existing := range permissions[i].ProvidingGroups {
							if existing == providingGroup {
								already = true
								break
							}
						}
						if !already {
							permissions[i].ProvidingGroups = append(permissions[i].ProvidingGroups, providingGroup)
						}
					}
					found = true
					break
				}
			}

			if !found {
				perm := UserPermission{
					ID:    pID.Int64,
					Name:  pKey.String,
					Access: "allow",
				}
				if providingGroup != "" {
					perm.ProvidingGroups = []string{providingGroup}
				}
				permissions = append(permissions, perm)
			}
		}
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return evaluatePermissions(permissions), nil
}

func evaluatePermissions(raw []UserPermission) []UserPermission {
	var denies []string
	var allows []UserPermission

	// 1. Разделяем на разрешающие и запрещающие
	for _, p := range raw {
		if strings.HasPrefix(p.Name, "!") {
			// Убираем '!' и сохраняем в список запретов
			denies = append(denies, strings.TrimPrefix(p.Name, "!"))
		} else {
			allows = append(allows, p)
		}
	}

	finalPermissions := []UserPermission{}

	// 2. Проверяем каждое разрешение на конфликт с запретами
	for _, p := range allows {
		isDenied := false
		for _, denyPattern := range denies {
			if matchACL(p.Name, denyPattern) {
				isDenied = true
				break
			}
		}

		if !isDenied {
			p.Access = "allow"
			finalPermissions = append(finalPermissions, p)
		}
	}

	return finalPermissions
}

// matchACL проверяет, подходит ли право под маску (например, "acl.view" под "acl.*")
func matchACL(permission, pattern string) bool {
	if pattern == "*" {
		return true
	}
	if strings.HasSuffix(pattern, ".*") {
		prefix := strings.TrimSuffix(pattern, ".*")
		return strings.HasPrefix(permission, prefix)
	}
	return permission == pattern
}

func CheckUserPermission(db *sql.DB, userID, permID int64) (UserPermission, error) {
	permissions, err := GetUserPermissions(db, userID, 1000, 0) // Получаем все права пользователя; TODO реализовать работу с пагинацией, пока что не ожидается большого количества прав на одного пользователя
	if err != nil {
		return UserPermission{}, err
	}

	for _, p := range permissions {
		if p.ID == permID {
			return p, nil
		}
	}

	return UserPermission{
		ID: permID,
		Access: "deny",
	}, nil
}