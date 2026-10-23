package html

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type VisibilityService struct {
	store Store
}

func NewVisibilityService(store Store) (*VisibilityService, error) {
	if store == nil {
		return nil, ErrInvalidRecord
	}
	return &VisibilityService{store: store}, nil
}

func actorAudiences(actor vfs.Actor) []string {
	if actor.Kind == vfs.ActorGuest {
		return []string{AudienceAll, AudienceGuest}
	}
	return []string{AudienceAll, actor.String()}
}

func normalizeAudiences(values []string) ([]string, error) {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if !validAudience(value) {
			return nil, ErrInvalidAudience
		}
		set[value] = struct{}{}
	}
	if len(set) == 0 {
		return nil, ErrInvalidAudience
	}
	out := make([]string, 0, len(set))
	for value := range set {
		out = append(out, value)
	}
	sort.Strings(out)
	return out, nil
}

func validAudience(value string) bool {
	if value == AudienceAll || value == AudienceGuest {
		return true
	}
	prefix, id, ok := strings.Cut(value, ":")
	return ok && (prefix == string(vfs.ActorUser) || prefix == string(vfs.ActorService)) && id != "" && strings.TrimSpace(id) == id && !strings.ContainsAny(id, "\x00\r\n\t ")
}

func validNodeKind(kind string) bool {
	switch kind {
	case NodeKindSite, NodeKindPage, NodeKindBlock, NodeKindTheme, NodeKindPublisher, NodeKindPublication:
		return true
	default:
		return false
	}
}

func (s *VisibilityService) CanSeeSite(ctx context.Context, siteID int64, actor vfs.Actor) (bool, error) {
	return s.store.NodeVisible(ctx, siteID, NodeKindSite, SiteNodeKey, actorAudiences(actor))
}

func (s *VisibilityService) VisiblePages(ctx context.Context, siteID int64, actor vfs.Actor, pages []Page) ([]Page, error) {
	keys, err := s.store.VisibleNodeKeys(ctx, siteID, NodeKindPage, actorAudiences(actor))
	if err != nil {
		return nil, err
	}
	byID := make(map[int64]Page, len(pages))
	for _, page := range pages {
		byID[page.ID] = page
	}
	state := make(map[int64]uint8, len(pages))
	effective := make(map[int64]bool, len(pages))
	var visible func(int64) bool
	visible = func(id int64) bool {
		if state[id] == 2 {
			return effective[id]
		}
		if state[id] == 1 {
			return false
		}
		page, ok := byID[id]
		if !ok {
			return false
		}
		state[id] = 1
		_, direct := keys[page.PageKey]
		result := direct
		if result && page.ParentID != nil {
			result = visible(*page.ParentID)
		}
		state[id] = 2
		effective[id] = result
		return result
	}
	out := make([]Page, 0, len(pages))
	for _, page := range pages {
		if visible(page.ID) {
			out = append(out, page)
		}
	}
	return out, nil
}

func (s *VisibilityService) PageVisible(ctx context.Context, siteID, pageID int64, actor vfs.Actor, pages []Page) (bool, error) {
	visible, err := s.VisiblePages(ctx, siteID, actor, pages)
	if err != nil {
		return false, err
	}
	for _, page := range visible {
		if page.ID == pageID {
			return true, nil
		}
	}
	return false, nil
}

func (s *VisibilityService) VisibleBlocks(ctx context.Context, siteID int64, actor vfs.Actor, blocks []Block) ([]Block, error) {
	keys, err := s.store.VisibleNodeKeys(ctx, siteID, NodeKindBlock, actorAudiences(actor))
	if err != nil {
		return nil, err
	}
	out := make([]Block, 0, len(blocks))
	for _, b := range blocks {
		if _, ok := keys[b.BlockKey]; ok {
			out = append(out, b)
		}
	}
	return out, nil
}
func (s *VisibilityService) BlockVisible(ctx context.Context, siteID int64, actor vfs.Actor, block Block) (bool, error) {
	return s.store.NodeVisible(ctx, siteID, NodeKindBlock, block.BlockKey, actorAudiences(actor))
}

func (s *VisibilityService) VisiblePublisherRoots(ctx context.Context, siteID int64, actor vfs.Actor, roots []PublisherRoot) ([]PublisherRoot, error) {
	keys, err := s.store.VisibleNodeKeys(ctx, siteID, NodeKindPublisher, actorAudiences(actor))
	if err != nil {
		return nil, err
	}
	out := make([]PublisherRoot, 0, len(roots))
	for _, root := range roots {
		if _, ok := keys[strconv.FormatInt(root.ID, 10)]; ok {
			out = append(out, root)
		}
	}
	return out, nil
}

func (s *SQLiteStore) NodeVisible(ctx context.Context, siteID int64, nodeKind, nodeKey string, audiences []string) (bool, error) {
	keys, err := s.VisibleNodeKeys(ctx, siteID, nodeKind, audiences)
	if err != nil {
		return false, err
	}
	_, ok := keys[nodeKey]
	return ok, nil
}

func (s *SQLiteStore) NodeAudiences(ctx context.Context, siteID int64, nodeKind, nodeKey string) ([]string, error) {
	return nodeAudiences(ctx, s.db, siteID, nodeKind, nodeKey)
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func nodeAudiences(ctx context.Context, db queryer, siteID int64, nodeKind, nodeKey string) ([]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT audience_key FROM html_node_visibility
		WHERE site_id = ? AND node_kind = ? AND node_key = ? ORDER BY audience_key`, siteID, nodeKind, nodeKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		out = append(out, value)
	}
	return out, rows.Err()
}

func (s *SQLiteStore) VisibleNodeKeys(ctx context.Context, siteID int64, nodeKind string, audiences []string) (map[string]struct{}, error) {
	if siteID <= 0 || !validNodeKind(nodeKind) || len(audiences) == 0 {
		return nil, ErrInvalidRecord
	}
	args := make([]any, 0, len(audiences)+2)
	args = append(args, siteID, nodeKind)
	marks := make([]string, 0, len(audiences))
	for _, audience := range audiences {
		marks = append(marks, "?")
		args = append(args, audience)
	}
	rows, err := s.db.QueryContext(ctx, `SELECT DISTINCT node_key FROM html_node_visibility
		WHERE site_id = ? AND node_kind = ? AND audience_key IN (`+strings.Join(marks, ",")+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]struct{})
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		out[key] = struct{}{}
	}
	return out, rows.Err()
}

func replaceNodeVisibilityTx(ctx context.Context, tx *sql.Tx, siteID int64, nodeKind, nodeKey string, audiences []string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM html_node_visibility WHERE site_id = ? AND node_kind = ? AND node_key = ?`, siteID, nodeKind, nodeKey); err != nil {
		return err
	}
	for _, audience := range audiences {
		if _, err := tx.ExecContext(ctx, `INSERT INTO html_node_visibility(site_id, node_kind, node_key, audience_key) VALUES (?, ?, ?, ?)`, siteID, nodeKind, nodeKey, audience); err != nil {
			return err
		}
	}
	return nil
}

func bumpVisibilityRevisionTx(ctx context.Context, tx *sql.Tx, siteID int64) (int64, error) {
	if _, err := tx.ExecContext(ctx, `UPDATE html_sites SET visibility_revision = visibility_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, siteID); err != nil {
		return 0, err
	}
	var revision int64
	if err := tx.QueryRowContext(ctx, `SELECT visibility_revision FROM html_sites WHERE id = ?`, siteID).Scan(&revision); err != nil {
		return 0, err
	}
	return revision, nil
}

func claimVisibilityRevisionTx(ctx context.Context, tx *sql.Tx, siteID, expected int64) (int64, error) {
	result, err := tx.ExecContext(ctx, `UPDATE html_sites SET visibility_revision = visibility_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND visibility_revision = ?`, siteID, expected)
	if err != nil {
		return 0, err
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	if changed == 0 {
		var current int64
		if err := tx.QueryRowContext(ctx, `SELECT visibility_revision FROM html_sites WHERE id = ?`, siteID).Scan(&current); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return 0, ErrSiteNotFound
			}
			return 0, err
		}
		return 0, &RevisionConflict{Kind: ErrVisibilityConflict, Current: current}
	}
	return expected + 1, nil
}

func (s *SQLiteStore) ReplaceNodeVisibility(ctx context.Context, siteID int64, nodeKind, nodeKey string, expectedRevision int64, values []string) (int64, error) {
	audiences, err := normalizeAudiences(values)
	if err != nil || siteID <= 0 || expectedRevision <= 0 || !validNodeKind(nodeKind) || strings.TrimSpace(nodeKey) == "" {
		return 0, ErrInvalidAudience
	}
	var revision int64
	err = s.withTx(ctx, func(tx *sql.Tx) error {
		if err := requireNodeTx(ctx, tx, siteID, nodeKind, nodeKey); err != nil {
			return err
		}
		revision, err = claimVisibilityRevisionTx(ctx, tx, siteID, expectedRevision)
		if err != nil {
			var conflict *RevisionConflict
			if errors.As(err, &conflict) {
				current, readErr := nodeAudiences(ctx, tx, siteID, nodeKind, nodeKey)
				if readErr != nil {
					return readErr
				}
				if strings.Join(current, "\x00") == strings.Join(audiences, "\x00") {
					revision = conflict.Current
					return nil
				}
			}
			return err
		}
		return replaceNodeVisibilityTx(ctx, tx, siteID, nodeKind, nodeKey, audiences)
	})
	if err != nil {
		return 0, classifyPageServiceError(err)
	}
	return revision, nil
}

func requireNodeTx(ctx context.Context, tx *sql.Tx, siteID int64, nodeKind, nodeKey string) error {
	var exists int
	var err error
	switch nodeKind {
	case NodeKindSite:
		if nodeKey != SiteNodeKey {
			return ErrInvalidRecord
		}
		err = tx.QueryRowContext(ctx, `SELECT 1 FROM html_sites WHERE id = ?`, siteID).Scan(&exists)
	case NodeKindPage:
		err = tx.QueryRowContext(ctx, `SELECT 1 FROM html_pages WHERE site_id = ? AND page_key = ?`, siteID, nodeKey).Scan(&exists)
	case NodeKindPublisher:
		id, parseErr := strconv.ParseInt(nodeKey, 10, 64)
		if parseErr != nil || id <= 0 {
			return ErrInvalidRecord
		}
		err = tx.QueryRowContext(ctx, `SELECT 1 FROM html_publisher_roots WHERE site_id = ? AND id = ?`, siteID, id).Scan(&exists)
	default:
		return fmt.Errorf("%w: unsupported node kind %s", ErrInvalidRecord, nodeKind)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return ErrPageNotFound
	}
	return err
}
