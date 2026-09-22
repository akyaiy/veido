package shared

import (
	"MyServer/internal/common"
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var ErrLinkNotFound = errors.New("shared link not found")

const createLinksTableSQL = `
CREATE TABLE IF NOT EXISTS vfs_shared_links (
	recipient_user_id INTEGER NOT NULL,
	recipient_name TEXT NOT NULL,
	granted_by_user_id INTEGER NOT NULL,
	granted_by_name TEXT NOT NULL,
	target_uri TEXT NOT NULL,
	alias TEXT NOT NULL,
	access_mode TEXT NOT NULL CHECK (access_mode IN ('viewer', 'editor')),
	status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'revoking', 'broken')),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

	PRIMARY KEY (recipient_user_id, target_uri),
	UNIQUE (recipient_user_id, granted_by_user_id, alias)
);`

const createLinksIndexesSQL = `
CREATE INDEX IF NOT EXISTS idx_vfs_shared_links_outgoing
	ON vfs_shared_links(granted_by_user_id, status);`

const SchemaSQL = createLinksTableSQL + createLinksIndexesSQL

// InitDB creates storage owned by the Shared Provider. The schema deliberately
// has no foreign keys or joins to Auth tables. User names are local display
// snapshots; a future identity projection may refresh them through a public
// VFS contract or events.
func InitDB(db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("shared store: nil database")
	}
	exists, columns, foreignKeys, err := inspectLinksTable(db)
	if err != nil {
		return err
	}
	if !exists {
		_, err := db.Exec(SchemaSQL)
		return err
	}
	if columns["recipient_name"] && columns["granted_by_name"] && !foreignKeys {
		_, err := db.Exec(createLinksIndexesSQL)
		return err
	}
	return migrateLegacyLinksTable(db, columns)
}

func inspectLinksTable(db *sql.DB) (exists bool, columns map[string]bool, foreignKeys bool, err error) {
	columns = make(map[string]bool)
	if err = db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM sqlite_master
			WHERE type = 'table' AND name = 'vfs_shared_links'
		)`).Scan(&exists); err != nil || !exists {
		return exists, columns, false, err
	}

	rows, err := db.Query(`PRAGMA table_info(vfs_shared_links)`)
	if err != nil {
		return false, nil, false, err
	}
	for rows.Next() {
		var cid, notNull, primaryKey int
		var name, columnType string
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			_ = rows.Close()
			return false, nil, false, err
		}
		columns[name] = true
	}
	if err := rows.Close(); err != nil {
		return false, nil, false, err
	}
	if err := rows.Err(); err != nil {
		return false, nil, false, err
	}

	fkRows, err := db.Query(`PRAGMA foreign_key_list(vfs_shared_links)`)
	if err != nil {
		return false, nil, false, err
	}
	foreignKeys = fkRows.Next()
	if err := fkRows.Close(); err != nil {
		return false, nil, false, err
	}
	return true, columns, foreignKeys, nil
}

func migrateLegacyLinksTable(db *sql.DB, columns map[string]bool) error {
	recipientName := `printf('user-%d', recipient_user_id)`
	if columns["recipient_name"] {
		recipientName = "recipient_name"
	}
	grantorName := `printf('user-%d', granted_by_user_id)`
	if columns["granted_by_name"] {
		grantorName = "granted_by_name"
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	statements := []string{
		`DROP INDEX IF EXISTS idx_vfs_shared_links_outgoing`,
		`ALTER TABLE vfs_shared_links RENAME TO vfs_shared_links_legacy`,
		createLinksTableSQL,
		`INSERT INTO vfs_shared_links (
			recipient_user_id,
			recipient_name,
			granted_by_user_id,
			granted_by_name,
			target_uri,
			alias,
			access_mode,
			status,
			created_at,
			updated_at
		) SELECT
			recipient_user_id,
			` + recipientName + `,
			granted_by_user_id,
			` + grantorName + `,
			target_uri,
			alias,
			access_mode,
			status,
			created_at,
			updated_at
		FROM vfs_shared_links_legacy`,
		`DROP TABLE vfs_shared_links_legacy`,
		createLinksIndexesSQL,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(statement); err != nil {
			return fmt.Errorf("migrate shared links: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	return nil
}

// LinkReader is the read-only projection contract required by Provider. A row
// is only a link index and never grants access to TargetURI.
type LinkReader interface {
	ListIncomingActive(ctx context.Context, recipientUserID int64) ([]Link, error)
	ListOutgoingActive(ctx context.Context, grantedByUserID int64) ([]Link, error)
	FindIncomingActive(ctx context.Context, recipientUserID int64, grantedByName, alias string) (*Link, error)
	FindOutgoingActive(ctx context.Context, grantedByUserID int64, recipientName, alias string) (*Link, error)
}

// LinkStore owns Shared link records. These methods only mutate the projection
// table; they do not create, change, or revoke ACL permissions.
type LinkStore interface {
	LinkReader
	Create(ctx context.Context, link Link) error
	Update(ctx context.Context, link Link) error
	Delete(ctx context.Context, recipientUserID int64, targetURI common.CanonURI) error
}

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(db *sql.DB) (*SQLiteStore, error) {
	if db == nil {
		return nil, fmt.Errorf("shared store: nil database")
	}
	return &SQLiteStore{db: db}, nil
}

const linkColumns = `
	l.recipient_user_id,
	l.recipient_name,
	l.granted_by_user_id,
	l.granted_by_name,
	l.target_uri,
	l.alias,
	l.access_mode,
	l.status,
	l.created_at,
	l.updated_at`

func (s *SQLiteStore) ListIncomingActive(ctx context.Context, recipientUserID int64) ([]Link, error) {
	return s.list(ctx, `
		SELECT `+linkColumns+`
		FROM vfs_shared_links l
		WHERE l.recipient_user_id = ? AND l.status = 'active'
		ORDER BY l.granted_by_name, l.alias`, recipientUserID)
}

func (s *SQLiteStore) ListOutgoingActive(ctx context.Context, grantedByUserID int64) ([]Link, error) {
	return s.list(ctx, `
		SELECT `+linkColumns+`
		FROM vfs_shared_links l
		WHERE l.granted_by_user_id = ? AND l.status = 'active'
		ORDER BY l.recipient_name, l.alias`, grantedByUserID)
}

func (s *SQLiteStore) FindIncomingActive(ctx context.Context, recipientUserID int64, grantedByName, alias string) (*Link, error) {
	return s.find(ctx, `
		SELECT `+linkColumns+`
		FROM vfs_shared_links l
		WHERE l.recipient_user_id = ? AND l.granted_by_name = ? AND l.alias = ? AND l.status = 'active'`,
		recipientUserID, grantedByName, alias)
}

func (s *SQLiteStore) FindOutgoingActive(ctx context.Context, grantedByUserID int64, recipientName, alias string) (*Link, error) {
	return s.find(ctx, `
		SELECT `+linkColumns+`
		FROM vfs_shared_links l
		WHERE l.granted_by_user_id = ? AND l.recipient_name = ? AND l.alias = ? AND l.status = 'active'`,
		grantedByUserID, recipientName, alias)
}

func (s *SQLiteStore) Create(ctx context.Context, link Link) error {
	if err := validateStoredLink(link); err != nil {
		return err
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO vfs_shared_links (
			recipient_user_id,
			recipient_name,
			granted_by_user_id,
			granted_by_name,
			target_uri,
			alias,
			access_mode,
			status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		link.RecipientUserID,
		link.RecipientName,
		link.GrantedByUserID,
		link.GrantedByName,
		string(link.TargetURI),
		link.Alias,
		string(link.AccessMode),
		string(link.Status),
	)
	return err
}

func (s *SQLiteStore) Update(ctx context.Context, link Link) error {
	if err := validateStoredLink(link); err != nil {
		return err
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE vfs_shared_links
		SET recipient_name = ?,
			granted_by_user_id = ?,
			granted_by_name = ?,
			alias = ?,
			access_mode = ?,
			status = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE recipient_user_id = ? AND target_uri = ?`,
		link.RecipientName,
		link.GrantedByUserID,
		link.GrantedByName,
		link.Alias,
		string(link.AccessMode),
		string(link.Status),
		link.RecipientUserID,
		string(link.TargetURI),
	)
	if err != nil {
		return err
	}
	return requireAffectedLink(result)
}

func (s *SQLiteStore) Delete(ctx context.Context, recipientUserID int64, targetURI common.CanonURI) error {
	if recipientUserID <= 0 || common.ParseResourceAddress(targetURI) == nil {
		return vfsError("invalid shared link key")
	}
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM vfs_shared_links
		WHERE recipient_user_id = ? AND target_uri = ?`, recipientUserID, string(targetURI))
	if err != nil {
		return err
	}
	return requireAffectedLink(result)
}

func validateStoredLink(link Link) error {
	if link.RecipientUserID <= 0 || link.GrantedByUserID <= 0 {
		return vfsError("shared link requires positive user IDs")
	}
	if err := validateChildName(link.RecipientName); err != nil {
		return err
	}
	if err := validateChildName(link.GrantedByName); err != nil {
		return err
	}
	if err := validateChildName(link.Alias); err != nil {
		return err
	}
	if common.ParseResourceAddress(link.TargetURI) == nil || link.TargetURI.Provider() == "shared" {
		return vfsError("shared link requires a canonical non-shared target URI")
	}
	if link.AccessMode != AccessViewer && link.AccessMode != AccessEditor {
		return vfsError("invalid shared access mode")
	}
	switch link.Status {
	case StatusPending, StatusActive, StatusRevoking, StatusBroken:
		return nil
	default:
		return vfsError("invalid shared link status")
	}
}

func requireAffectedLink(result sql.Result) error {
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrLinkNotFound
	}
	return nil
}

func vfsError(message string) error {
	return fmt.Errorf("shared store: %s", message)
}

func (s *SQLiteStore) list(ctx context.Context, query string, args ...any) ([]Link, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	links := make([]Link, 0)
	for rows.Next() {
		link, err := scanLink(rows)
		if err != nil {
			return nil, err
		}
		links = append(links, *link)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return links, nil
}

func (s *SQLiteStore) find(ctx context.Context, query string, args ...any) (*Link, error) {
	link, err := scanLink(s.db.QueryRowContext(ctx, query, args...))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrLinkNotFound
	}
	return link, err
}

type scanner interface {
	Scan(dest ...any) error
}

func scanLink(row scanner) (*Link, error) {
	var (
		link      Link
		targetURI string
		mode      string
		status    string
	)
	if err := row.Scan(
		&link.RecipientUserID,
		&link.RecipientName,
		&link.GrantedByUserID,
		&link.GrantedByName,
		&targetURI,
		&link.Alias,
		&mode,
		&status,
		&link.CreatedAt,
		&link.UpdatedAt,
	); err != nil {
		return nil, err
	}
	uri, err := common.CastURI(targetURI)
	if err != nil {
		return nil, fmt.Errorf("shared link contains invalid target URI: %w", err)
	}
	link.TargetURI = uri
	link.AccessMode = AccessMode(mode)
	link.Status = LinkStatus(status)
	return &link, nil
}

var _ LinkStore = (*SQLiteStore)(nil)
