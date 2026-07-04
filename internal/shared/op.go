package shared

import (
	"MyServer/internal/vfs"
	"context"
	"database/sql"
	"fmt"
)

type SharedOPs struct {
	Db            *sql.DB
	AccessControl vfs.AccessSystem
}

func (s *SharedOPs) availableNodes(ctx context.Context, id int) ([]string, error) {
	rows, err := s.Db.QueryContext(ctx, "SELECT resource_id FROM shares WHERE to_id = $1", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}


func (s *SharedOPs) AvaibleFromMe(ctx context.Context, id int) ([]string, error) {
	rows, err := s.Db.QueryContext(ctx, "SELECT resource_id FROM shares WHERE from_id = ?", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resourceIDs []string
	for rows.Next() {
		var resourceID string
		if err := rows.Scan(&resourceID); err != nil {
			return nil, err
		}
		resourceIDs = append(resourceIDs, resourceID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	return resourceIDs, nil
}

func (s *SharedOPs) AccesibleToMe(ctx context.Context, id int) ([]string, error) {
	nodes, err := s.availableNodes(ctx, id)
	if err != nil {
		return nil, err
	}
	return nodes, nil
}

func (s *SharedOPs) CreateShare(ctx context.Context, fromID, toID int, resourceID string, rights int) error {
	isOwner, err := s.AccessControl.IsOwner(ctx, fromID, resourceID)
	if err != nil {
		return err
	}
	if !isOwner {
		return fmt.Errorf("user %d is not the owner of resource %s", fromID, resourceID)
	}
	_, err = s.Db.ExecContext(ctx, "INSERT INTO shares (from_id, to_id, resource_id) VALUES ($1, $2, $3)", fromID, toID, resourceID)
	return err
}

func (s *SharedOPs) DeleteShare(ctx context.Context, fromID, toID int, resourceID string) error {
	isOwner, err := s.AccessControl.IsOwner(ctx, fromID, resourceID)
	if err != nil {
		return err
	}
	if !isOwner {
		return fmt.Errorf("user %d is not the owner of resource %s", fromID, resourceID)
	}
	_, err = s.Db.ExecContext(ctx, "DELETE FROM shares WHERE from_id = $1 AND to_id = $2 AND resource_id = $3", fromID, toID, resourceID)
	return err
}