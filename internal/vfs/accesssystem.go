package vfs

import (
	"github.com/akyaiy/veido/internal/acl"
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type AccessSystem interface {
	CanRead(ctx context.Context, userId int, targetId string) (bool, error)
	CanWrite(ctx context.Context, userId int, targetId string) (bool, error)
	CanDelete(ctx context.Context, userId int, targetId string) (bool, error)
	IsOwner(ctx context.Context, userId int, targetId string) (bool, error)

	GetUserHomeNodeID(ctx context.Context, userID int) (string, error)
}

type ACLAccessSystem struct {
	db *sql.DB
}

func NewACLAccessSystem(db *sql.DB) AccessSystem {
	return &ACLAccessSystem{db: db}
}

// Получить ID домашней папки пользователя на основе его разрешений
func (a *ACLAccessSystem) GetUserHomeNodeID(ctx context.Context, userID int) (string, error) {
	// 1. Выгребаем все пермишены пользователя через твой API
	permissions, err := acl.GetUserPermissions(a.db, int64(userID), 1000, 0)
	if err != nil {
		return "", err
	}

	// 2. Ищем пермишен, отвечающий за хоум-директорию
	for _, p := range permissions {
		// Например, ключ пермишена имеет формат "vfs.home:105", где 105 - ID ноды в metadata
		if strings.HasPrefix(p.Name, "vfs.home:") {
			if p.Access == "allow" {
				return strings.TrimPrefix(p.Name, "vfs.home:"), nil
			}
		}
	}

	return "", fmt.Errorf("user %d has no home directory assigned in ACL", userID)
}

// Проверка: является ли targetID частью разрешенного хоума (или самим хоумом)
func (a *ACLAccessSystem) isInsideHome(ctx context.Context, userID int, targetID string) (bool, error) {
	// homeID, err := a.GetUserHomeNodeID(ctx, userID)
	// if err != nil {
	// 	return false, err
	// }

	// // Если целевой ID и есть хоум — доступ разрешен
	// if targetID == homeID {
	// 	return true, nil
	// }

	// // Если запрашивается вложенный файл/папка, нам нужно убедиться, 
	// // что вверх по дереву метаданных мы упираемся в наш homeID.
	// // Делаем рекурсивный (или итеративный) запрос в metadata для проверки parent_id.
	// currentID := targetID
	// for {
	// 	var parentID sql.NullString
	// 	err := a.db.QueryRowContext(ctx, "SELECT parent_id FROM metadata WHERE id = ?", currentID).Scan(&parentID)
	// 	if err == sql.ErrNoRows {
	// 		return false, nil
	// 	} else if err != nil {
	// 		return false, err
	// 	}

	// 	if !parentID.Valid || parentID.String == "0" || parentID.String == "" {
	// 		// Дошли до корня системы, но хоум юзера так и не встретили
	// 		return false, nil
	// 	}

	// 	if parentID.String == homeID {
	// 		return true, nil // Нашли хоум предка! Доступ легитимен.
	// 	}

	// 	currentID = parentID.String
	// }
	return true, nil // Временно разрешаем всё, пока не реализуем логику проверки
}

func (a *ACLAccessSystem) CanRead(ctx context.Context, userID int, targetID string) (bool, error) {
	return a.isInsideHome(ctx, userID, targetID)
}

func (a *ACLAccessSystem) CanWrite(ctx context.Context, userID int, targetID string) (bool, error) {
	return a.isInsideHome(ctx, userID, targetID)
}

func (a *ACLAccessSystem) CanDelete(ctx context.Context, userID int, targetID string) (bool, error) {
	return a.isInsideHome(ctx, userID, targetID)
}

func (a *ACLAccessSystem) CanList(ctx context.Context, userID int, targetID string) (bool, error) {
	return a.isInsideHome(ctx, userID, targetID)
}

func (a *ACLAccessSystem) IsOwner(ctx context.Context, userID int, targetID string) (bool, error) {
	return a.isInsideHome(ctx, userID, targetID)
}
