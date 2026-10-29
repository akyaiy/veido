package html

import (
	"github.com/akyaiy/veido/internal/common"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path"
	"sort"
	"strconv"
	"strings"

	"github.com/akyaiy/veido/internal/database/migrate"

	"github.com/mattn/go-sqlite3"
)

const schemaVersion = 5

const migrationTableSQL = `
CREATE TABLE IF NOT EXISTS html_schema_migrations (
	version INTEGER PRIMARY KEY,
	applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`

const schemaV1SQL = `
CREATE TABLE html_sites (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	connection_id INTEGER NOT NULL UNIQUE,
	name TEXT NOT NULL CHECK (length(trim(name)) > 0),
	owner_subject_key TEXT NOT NULL CHECK (length(trim(owner_subject_key)) > 0),
	base_url TEXT NOT NULL DEFAULT '',
	application_template_key TEXT NOT NULL DEFAULT '',
	application_template_version TEXT NOT NULL DEFAULT '',
	tree_revision INTEGER NOT NULL DEFAULT 1 CHECK (tree_revision >= 1),
	model_revision INTEGER NOT NULL DEFAULT 1 CHECK (model_revision >= 1),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE html_publisher_roots (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	site_id INTEGER NOT NULL,
	publisher_subject_key TEXT NOT NULL CHECK (length(trim(publisher_subject_key)) > 0),
	root_uri TEXT NOT NULL CHECK (length(trim(root_uri)) > 0),
	purpose TEXT NOT NULL CHECK (purpose IN ('content', 'assets', 'publication')),
	status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'broken')),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (site_id) REFERENCES html_sites(id) ON DELETE CASCADE,
	UNIQUE (site_id, publisher_subject_key, root_uri, purpose)
);

CREATE INDEX idx_html_publisher_roots_site
	ON html_publisher_roots(site_id, status);

CREATE TABLE html_pages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	site_id INTEGER NOT NULL,
	parent_id INTEGER,
	page_key TEXT NOT NULL CHECK (length(trim(page_key)) > 0),
	slug TEXT NOT NULL CHECK (length(trim(slug)) > 0),
	title TEXT NOT NULL,
	note TEXT NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL CHECK (status IN ('draft', 'ready', 'hidden', 'archived')),
	position INTEGER NOT NULL CHECK (position >= 0),
	publisher_subject_key TEXT NOT NULL CHECK (length(trim(publisher_subject_key)) > 0),
	source_uri TEXT NOT NULL CHECK (length(trim(source_uri)) > 0),
	revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (site_id) REFERENCES html_sites(id) ON DELETE CASCADE,
	FOREIGN KEY (site_id, parent_id) REFERENCES html_pages(site_id, id) ON DELETE RESTRICT,
	UNIQUE (site_id, id),
	UNIQUE (site_id, page_key)
);

CREATE UNIQUE INDEX idx_html_pages_root_slug
	ON html_pages(site_id, slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_html_pages_child_slug
	ON html_pages(site_id, parent_id, slug) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX idx_html_pages_root_position
	ON html_pages(site_id, position) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_html_pages_child_position
	ON html_pages(site_id, parent_id, position) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_html_pages_site_parent
	ON html_pages(site_id, parent_id, position);

CREATE TRIGGER html_pages_validate_parent_insert
BEFORE INSERT ON html_pages
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM html_pages parent
	WHERE parent.id = NEW.parent_id AND parent.site_id = NEW.site_id
)
BEGIN
	SELECT RAISE(ABORT, 'html parent must belong to the same site');
END;

CREATE TRIGGER html_pages_validate_parent_update
BEFORE UPDATE OF site_id, parent_id ON html_pages
WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM html_pages parent
	WHERE parent.id = NEW.parent_id AND parent.site_id = NEW.site_id
)
BEGIN
	SELECT RAISE(ABORT, 'html parent must belong to the same site');
END;

CREATE TABLE html_page_types (
	page_id INTEGER NOT NULL,
	type TEXT NOT NULL CHECK (length(trim(type)) > 0),
	PRIMARY KEY (page_id, type),
	FOREIGN KEY (page_id) REFERENCES html_pages(id) ON DELETE CASCADE
);

CREATE TABLE html_page_search_tags (
	page_id INTEGER NOT NULL,
	tag TEXT NOT NULL CHECK (length(trim(tag)) > 0),
	PRIMARY KEY (page_id, tag),
	FOREIGN KEY (page_id) REFERENCES html_pages(id) ON DELETE CASCADE
);

CREATE TABLE html_editor_layouts (
	site_id INTEGER PRIMARY KEY,
	schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
	revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
	xml BLOB NOT NULL,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (site_id) REFERENCES html_sites(id) ON DELETE CASCADE
);

CREATE TABLE html_site_seo (
	site_id INTEGER PRIMARY KEY,
	robots_text TEXT NOT NULL DEFAULT '',
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (site_id) REFERENCES html_sites(id) ON DELETE CASCADE
);`

const schemaV2SQL = `ALTER TABLE html_pages
	ADD COLUMN bundle_root_uri TEXT NOT NULL DEFAULT '://'
	CHECK (length(trim(bundle_root_uri)) > 0);`

// SQLite requires a non-NULL default while adding this column to an existing
// table. The temporary value is replaced during the same migration; these
// triggers prevent it from being used by later raw inserts or updates.
const schemaV2ValidationSQL = `
CREATE TRIGGER IF NOT EXISTS html_pages_validate_bundle_root_insert
BEFORE INSERT ON html_pages
WHEN NEW.bundle_root_uri = '://' OR length(trim(NEW.bundle_root_uri)) = 0
BEGIN
	SELECT RAISE(ABORT, 'invalid bundle_root_uri');
END;

CREATE TRIGGER IF NOT EXISTS html_pages_validate_bundle_root_update
BEFORE UPDATE OF bundle_root_uri ON html_pages
WHEN NEW.bundle_root_uri = '://' OR length(trim(NEW.bundle_root_uri)) = 0
BEGIN
	SELECT RAISE(ABORT, 'invalid bundle_root_uri');
END;`

const schemaV3SQL = `
ALTER TABLE html_sites
	ADD COLUMN visibility_revision INTEGER NOT NULL DEFAULT 1
	CHECK (visibility_revision >= 1);

CREATE TABLE html_node_visibility (
	site_id INTEGER NOT NULL,
	node_kind TEXT NOT NULL CHECK (node_kind IN ('site', 'page', 'block', 'theme', 'publisher', 'publication')),
	node_key TEXT NOT NULL CHECK (length(trim(node_key)) > 0),
	audience_key TEXT NOT NULL CHECK (length(trim(audience_key)) > 0),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (site_id, node_kind, node_key, audience_key),
	FOREIGN KEY (site_id) REFERENCES html_sites(id) ON DELETE CASCADE
);

CREATE INDEX idx_html_node_visibility_lookup
	ON html_node_visibility(site_id, node_kind, audience_key, node_key);

CREATE TRIGGER html_pages_cleanup_visibility
AFTER DELETE ON html_pages
BEGIN
	DELETE FROM html_node_visibility
	WHERE site_id = OLD.site_id AND node_kind = 'page' AND node_key = OLD.page_key;
END;

CREATE TRIGGER html_publisher_roots_cleanup_visibility
AFTER DELETE ON html_publisher_roots
BEGIN
	DELETE FROM html_node_visibility
	WHERE site_id = OLD.site_id AND node_kind = 'publisher' AND node_key = CAST(OLD.id AS TEXT);
END;`

const schemaV4SQL = `
CREATE TABLE html_template_blobs (
	digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
	size INTEGER NOT NULL CHECK (size >= 0),
	data BLOB NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE html_template_packages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	site_id INTEGER NOT NULL,
	template_key TEXT NOT NULL CHECK (length(trim(template_key)) > 0),
	version TEXT NOT NULL CHECK (length(trim(version)) > 0),
	entrypoint TEXT NOT NULL CHECK (length(trim(entrypoint)) > 0),
	package_digest TEXT NOT NULL CHECK (length(package_digest) = 64),
	manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
	manifest_json BLOB NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (site_id) REFERENCES html_sites(id) ON DELETE CASCADE,
	UNIQUE (site_id, template_key, version)
);

CREATE INDEX idx_html_template_packages_site_key
	ON html_template_packages(site_id, template_key, version);

CREATE TABLE html_template_assets (
	package_id INTEGER NOT NULL,
	path TEXT NOT NULL CHECK (length(trim(path)) > 0),
	content_type TEXT NOT NULL CHECK (length(trim(content_type)) > 0),
	digest TEXT NOT NULL,
	size INTEGER NOT NULL CHECK (size >= 0),
	PRIMARY KEY (package_id, path),
	FOREIGN KEY (package_id) REFERENCES html_template_packages(id) ON DELETE CASCADE,
	FOREIGN KEY (digest) REFERENCES html_template_blobs(digest) ON DELETE RESTRICT
);

CREATE INDEX idx_html_template_assets_package_path
	ON html_template_assets(package_id, path);`

const schemaV5SQL = `
CREATE TABLE html_blocks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL, block_key TEXT NOT NULL CHECK(length(trim(block_key)) > 0),
 name TEXT NOT NULL CHECK(length(trim(name)) > 0), type TEXT NOT NULL CHECK(type IN ('ui-component','content')),
 publisher_subject_key TEXT NOT NULL CHECK(length(trim(publisher_subject_key)) > 0), bundle_root_uri TEXT NOT NULL CHECK(length(trim(bundle_root_uri)) > 0),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(site_id) REFERENCES html_sites(id) ON DELETE CASCADE, UNIQUE(site_id, block_key));
CREATE INDEX idx_html_blocks_site_key ON html_blocks(site_id, block_key);
CREATE TABLE html_block_trees (site_id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1), document_json BLOB NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(site_id) REFERENCES html_sites(id) ON DELETE CASCADE);
CREATE TRIGGER html_blocks_cleanup_visibility AFTER DELETE ON html_blocks BEGIN DELETE FROM html_node_visibility WHERE site_id=OLD.site_id AND node_kind='block' AND node_key=OLD.block_key; END;`

type SQLiteStore struct {
	db *sql.DB
}

var _ Store = (*SQLiteStore)(nil)

func MigrationGroup() migrate.Group {
	return migrate.Group{Name: "provider/html", Migrations: []migrate.Migration{
		{Version: 1, Name: "site_and_page_model", Up: migrateHTMLV1},
		{Version: 2, Name: "page_bundle_roots", Up: migrateHTMLV2},
		{Version: 3, Name: "node_visibility", Up: migrateHTMLV3},
		{Version: 4, Name: "application_templates", Up: migrateHTMLV4},
		{Version: 5, Name: "blocks", Up: migrateHTMLV5},
	}}
}

func InitDB(db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("html store: nil database")
	}
	return migrate.Run(context.Background(), db, MigrationGroup())
}

func prepareHTMLMigration(ctx context.Context, tx *sql.Tx) (int, error) {
	if _, err := tx.ExecContext(ctx, migrationTableSQL); err != nil {
		return 0, err
	}
	var current int
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(version), 0) FROM html_schema_migrations`).Scan(&current); err != nil {
		return 0, err
	}
	if current > schemaVersion {
		return 0, fmt.Errorf("html store: schema version %d is newer than supported version %d", current, schemaVersion)
	}
	return current, nil
}

func recordHTMLMigration(ctx context.Context, tx *sql.Tx, version int) error {
	_, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO html_schema_migrations(version) VALUES (?)`, version)
	return err
}

func migrateHTMLV1(ctx context.Context, tx *sql.Tx) error {
	current, err := prepareHTMLMigration(ctx, tx)
	if err != nil {
		return err
	}
	if current < 1 {
		var exists bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='html_sites')`).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			if _, err := tx.ExecContext(ctx, schemaV1SQL); err != nil {
				return err
			}
		}
	}
	return recordHTMLMigration(ctx, tx, 1)
}

func migrateHTMLV2(ctx context.Context, tx *sql.Tx) error {
	current, err := prepareHTMLMigration(ctx, tx)
	if err != nil {
		return err
	}
	if current < 2 {
		hasColumn, err := htmlColumnExists(ctx, tx, "html_pages", "bundle_root_uri")
		if err != nil {
			return err
		}
		if !hasColumn {
			if _, err := tx.ExecContext(ctx, schemaV2SQL); err != nil {
				return err
			}
			if err := backfillBundleRoots(tx); err != nil {
				return err
			}
		}
	}
	if _, err := tx.ExecContext(ctx, schemaV2ValidationSQL); err != nil {
		return err
	}
	return recordHTMLMigration(ctx, tx, 2)
}

func migrateHTMLV3(ctx context.Context, tx *sql.Tx) error {
	current, err := prepareHTMLMigration(ctx, tx)
	if err != nil {
		return err
	}
	if current < 3 {
		hasColumn, err := htmlColumnExists(ctx, tx, "html_sites", "visibility_revision")
		if err != nil {
			return err
		}
		if !hasColumn {
			if _, err := tx.ExecContext(ctx, schemaV3SQL); err != nil {
				return err
			}
		}
		if err := backfillNodeVisibility(tx); err != nil {
			return err
		}
	}
	return recordHTMLMigration(ctx, tx, 3)
}

func migrateHTMLV4(ctx context.Context, tx *sql.Tx) error {
	current, err := prepareHTMLMigration(ctx, tx)
	if err != nil {
		return err
	}
	if current < 4 {
		var exists bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='html_template_packages')`).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			if _, err := tx.ExecContext(ctx, schemaV4SQL); err != nil {
				return err
			}
		}
	}
	return recordHTMLMigration(ctx, tx, 4)
}

func migrateHTMLV5(ctx context.Context, tx *sql.Tx) error {
	current, err := prepareHTMLMigration(ctx, tx)
	if err != nil {
		return err
	}
	if current < 5 {
		if _, err := tx.ExecContext(ctx, schemaV5SQL); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO html_block_trees(site_id, document_json) SELECT id, '{"revision":1,"folders":[]}' FROM html_sites`); err != nil {
			return err
		}
	}
	return recordHTMLMigration(ctx, tx, 5)
}

func htmlColumnExists(ctx context.Context, tx *sql.Tx, table, column string) (bool, error) {
	rows, err := tx.QueryContext(ctx, `SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}

func backfillNodeVisibility(tx *sql.Tx) error {
	statements := []string{
		`INSERT OR IGNORE INTO html_node_visibility(site_id, node_kind, node_key, audience_key)
		 SELECT id, 'site', 'site', owner_subject_key FROM html_sites`,
		`INSERT OR IGNORE INTO html_node_visibility(site_id, node_kind, node_key, audience_key)
		 SELECT r.site_id, 'publisher', CAST(r.id AS TEXT), r.publisher_subject_key
		 FROM html_publisher_roots r`,
		`INSERT OR IGNORE INTO html_node_visibility(site_id, node_kind, node_key, audience_key)
		 SELECT r.site_id, 'publisher', CAST(r.id AS TEXT), s.owner_subject_key
		 FROM html_publisher_roots r JOIN html_sites s ON s.id = r.site_id`,
		`INSERT OR IGNORE INTO html_node_visibility(site_id, node_kind, node_key, audience_key)
		 SELECT p.site_id, 'page', p.page_key, p.publisher_subject_key FROM html_pages p`,
		`INSERT OR IGNORE INTO html_node_visibility(site_id, node_kind, node_key, audience_key)
		 SELECT p.site_id, 'page', p.page_key, s.owner_subject_key
		 FROM html_pages p JOIN html_sites s ON s.id = p.site_id`,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(statement); err != nil {
			return err
		}
	}
	return nil
}

func backfillBundleRoots(tx *sql.Tx) error {
	rows, err := tx.Query(`SELECT id, source_uri FROM html_pages ORDER BY id`)
	if err != nil {
		return err
	}
	type legacyPage struct {
		id     int64
		source string
	}
	pages := make([]legacyPage, 0)
	for rows.Next() {
		var page legacyPage
		if err := rows.Scan(&page.id, &page.source); err != nil {
			_ = rows.Close()
			return err
		}
		pages = append(pages, page)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, page := range pages {
		source, err := common.CastURI(page.source)
		if err != nil {
			return fmt.Errorf("page %d has invalid legacy source URI: %w", page.id, err)
		}
		root, err := migratedBundleRoot(source)
		if err != nil {
			return fmt.Errorf("page %d bundle root: %w", page.id, err)
		}
		if _, err := tx.Exec(`UPDATE html_pages SET bundle_root_uri = ? WHERE id = ?`, string(root), page.id); err != nil {
			return err
		}
	}
	return nil
}

func migratedBundleRoot(source common.CanonURI) (common.CanonURI, error) {
	address := common.ParseResourceAddress(source)
	if address == nil {
		return common.EmptyURI, ErrInvalidRecord
	}
	payload := address.Payload()
	if path.Base(payload.Path) == ContentMarkdownName {
		payload.Path = path.Dir(payload.Path)
		return payload.URI()
	}
	extension := path.Ext(payload.Path)
	if extension != "" {
		payload.Path = strings.TrimSuffix(payload.Path, extension)
	}
	return payload.URI()
}

func legacyContentURI(root common.CanonURI) string {
	uri, err := bundleFileURI(root, ContentMarkdownName)
	if err != nil {
		return string(common.EmptyURI)
	}
	return string(uri)
}

func NewSQLiteStore(db *sql.DB) (*SQLiteStore, error) {
	if db == nil {
		return nil, fmt.Errorf("html store: nil database")
	}
	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) CreateSite(ctx context.Context, input NewSite) (*Site, error) {
	if input.ConnectionID <= 0 || strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.OwnerSubjectKey) == "" {
		return nil, ErrInvalidRecord
	}
	audiences, err := normalizeAudiences(input.VisibleTo)
	if err != nil {
		return nil, err
	}
	layout, err := initialEditorLayout(input.InitialLayoutXML)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidRecord, err)
	}

	var siteID int64
	err = s.withTx(ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `
			INSERT INTO html_sites (
				connection_id, name, owner_subject_key, base_url,
				application_template_key, application_template_version
			) VALUES (?, ?, ?, ?, ?, ?)`,
			input.ConnectionID,
			strings.TrimSpace(input.Name),
			strings.TrimSpace(input.OwnerSubjectKey),
			strings.TrimSpace(input.BaseURL),
			strings.TrimSpace(input.ApplicationTemplateKey),
			strings.TrimSpace(input.ApplicationTemplateVersion),
		)
		if err != nil {
			return err
		}
		siteID, err = result.LastInsertId()
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO html_editor_layouts(site_id, schema_version, revision, xml)
			VALUES (?, 1, 1, ?)`, siteID, layout); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO html_block_trees(site_id, document_json) VALUES (?, '{"revision":1,"folders":[]}')`, siteID); err != nil {
			return err
		}
		if err := replaceNodeVisibilityTx(ctx, tx, siteID, NodeKindSite, SiteNodeKey, audiences); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO html_site_seo(site_id, robots_text) VALUES (?, '')`, siteID)
		return err
	})
	if err != nil {
		return nil, classifyStoreError(err)
	}
	return s.SiteByID(ctx, siteID)
}

func (s *SQLiteStore) SiteByID(ctx context.Context, siteID int64) (*Site, error) {
	return scanSite(s.db.QueryRowContext(ctx, siteSelect+` WHERE id = ?`, siteID))
}

func (s *SQLiteStore) SiteByConnection(ctx context.Context, connectionID int64) (*Site, error) {
	return scanSite(s.db.QueryRowContext(ctx, siteSelect+` WHERE connection_id = ?`, connectionID))
}

func (s *SQLiteStore) UpdateSite(ctx context.Context, siteID, expectedModelRevision int64, name, baseURL string) (*Site, error) {
	name = strings.TrimSpace(name)
	baseURL = strings.TrimSpace(baseURL)
	if siteID <= 0 || expectedModelRevision <= 0 || name == "" {
		return nil, ErrInvalidRecord
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE html_sites
		SET name = ?, base_url = ?, model_revision = model_revision + 1, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND model_revision = ?`, name, baseURL, siteID, expectedModelRevision)
	if err != nil {
		return nil, classifyStoreError(err)
	}
	if err := requireOneRow(result); err != nil {
		var current int64
		if scanErr := s.db.QueryRowContext(ctx, `SELECT model_revision FROM html_sites WHERE id = ?`, siteID).Scan(&current); errors.Is(scanErr, sql.ErrNoRows) {
			return nil, ErrSiteNotFound
		} else if scanErr != nil {
			return nil, classifyStoreError(scanErr)
		}
		return nil, &RevisionConflict{Kind: ErrSiteRevisionConflict, Current: current}
	}
	return s.SiteByID(ctx, siteID)
}

const siteSelect = `SELECT
	id, connection_id, name, owner_subject_key, base_url,
	application_template_key, application_template_version,
	tree_revision, model_revision, visibility_revision, created_at, updated_at
FROM html_sites`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSite(row rowScanner) (*Site, error) {
	var site Site
	err := row.Scan(
		&site.ID,
		&site.ConnectionID,
		&site.Name,
		&site.OwnerSubjectKey,
		&site.BaseURL,
		&site.ApplicationTemplateKey,
		&site.ApplicationTemplateVersion,
		&site.TreeRevision,
		&site.ModelRevision,
		&site.VisibilityRevision,
		&site.CreatedAt,
		&site.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrSiteNotFound
	}
	if err != nil {
		return nil, classifyStoreError(err)
	}
	return &site, nil
}

func (s *SQLiteStore) CreatePublisherRoot(ctx context.Context, input NewPublisherRoot) (*PublisherRoot, error) {
	if input.SiteID <= 0 || strings.TrimSpace(input.PublisherSubjectKey) == "" || !common.IsCanonURI(input.RootURI) {
		return nil, ErrInvalidRecord
	}
	audiences, err := normalizeAudiences(input.VisibleTo)
	if err != nil {
		return nil, err
	}
	var id int64
	err = s.withTx(ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `
			INSERT INTO html_publisher_roots (
				site_id, publisher_subject_key, root_uri, purpose, status
			) VALUES (?, ?, ?, ?, ?)`, input.SiteID, strings.TrimSpace(input.PublisherSubjectKey), string(input.RootURI), input.Purpose, input.Status)
		if err != nil {
			return err
		}
		id, err = result.LastInsertId()
		if err != nil {
			return err
		}
		if err := replaceNodeVisibilityTx(ctx, tx, input.SiteID, NodeKindPublisher, strconv.FormatInt(id, 10), audiences); err != nil {
			return err
		}
		_, err = bumpVisibilityRevisionTx(ctx, tx, input.SiteID)
		return err
	})
	if err != nil {
		return nil, classifyStoreError(err)
	}
	return s.publisherRootByID(ctx, input.SiteID, id)
}

func (s *SQLiteStore) publisherRootByID(ctx context.Context, siteID, rootID int64) (*PublisherRoot, error) {
	var root PublisherRoot
	var uri string
	err := s.db.QueryRowContext(ctx, `SELECT
		id, site_id, publisher_subject_key, root_uri, purpose, status, created_at, updated_at
		FROM html_publisher_roots WHERE site_id = ? AND id = ?`, siteID, rootID).Scan(
		&root.ID,
		&root.SiteID,
		&root.PublisherSubjectKey,
		&uri,
		&root.Purpose,
		&root.Status,
		&root.CreatedAt,
		&root.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPublisherRootNotFound
	}
	if err != nil {
		return nil, err
	}
	root.RootURI = common.CanonURI(uri)
	return &root, nil
}

func (s *SQLiteStore) ListPublisherRoots(ctx context.Context, siteID int64) ([]PublisherRoot, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT
		id, site_id, publisher_subject_key, root_uri, purpose, status, created_at, updated_at
		FROM html_publisher_roots WHERE site_id = ? ORDER BY id`, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roots := make([]PublisherRoot, 0)
	for rows.Next() {
		var root PublisherRoot
		var uri string
		if err := rows.Scan(
			&root.ID,
			&root.SiteID,
			&root.PublisherSubjectKey,
			&uri,
			&root.Purpose,
			&root.Status,
			&root.CreatedAt,
			&root.UpdatedAt,
		); err != nil {
			return nil, err
		}
		root.RootURI = common.CanonURI(uri)
		roots = append(roots, root)
	}
	return roots, rows.Err()
}

func (s *SQLiteStore) insertPage(ctx context.Context, input NewPage) (*Page, error) {
	if err := validateNewPage(input); err != nil {
		return nil, err
	}
	var pageID int64
	err := s.withTx(ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `
			INSERT INTO html_pages (
				site_id, parent_id, page_key, slug, title, note, description,
				status, position, publisher_subject_key, source_uri, bundle_root_uri
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			input.SiteID,
			input.ParentID,
			strings.TrimSpace(input.PageKey),
			strings.TrimSpace(input.Slug),
			input.Title,
			input.Note,
			input.Description,
			input.Status,
			input.Position,
			strings.TrimSpace(input.PublisherSubjectKey),
			legacyContentURI(input.BundleRootURI),
			string(input.BundleRootURI),
		)
		if err != nil {
			return err
		}
		pageID, err = result.LastInsertId()
		if err != nil {
			return err
		}
		if err := replaceStrings(ctx, tx, "html_page_types", "type", pageID, normalizeSet(input.Types, true)); err != nil {
			return err
		}
		if err := replaceStrings(ctx, tx, "html_page_search_tags", "tag", pageID, normalizeSet(input.SearchTags, false)); err != nil {
			return err
		}
		audiences, err := normalizeAudiences(input.VisibleTo)
		if err != nil {
			return err
		}
		if err := replaceNodeVisibilityTx(ctx, tx, input.SiteID, NodeKindPage, strings.TrimSpace(input.PageKey), audiences); err != nil {
			return err
		}
		_, err = bumpVisibilityRevisionTx(ctx, tx, input.SiteID)
		return err
	})
	if err != nil {
		return nil, classifyStoreError(err)
	}
	return s.PageByID(ctx, input.SiteID, pageID)
}

func validateNewPage(input NewPage) error {
	if input.SiteID <= 0 || input.Position < 0 || strings.TrimSpace(input.PageKey) == "" ||
		strings.TrimSpace(input.Slug) == "" || strings.TrimSpace(input.PublisherSubjectKey) == "" ||
		!validPageKey(input.PageKey) || !common.IsCanonURI(input.BundleRootURI) {
		return ErrInvalidRecord
	}
	if _, err := normalizeAudiences(input.VisibleTo); err != nil {
		return err
	}
	return nil
}

func validPageKey(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && value != "." && value != ".." && !strings.ContainsAny(value, "/\\\x00{}*")
}

const pageSelect = `SELECT
	id, site_id, parent_id, page_key, slug, title, note, description,
	status, position, publisher_subject_key, bundle_root_uri, revision, created_at, updated_at
FROM html_pages`

func (s *SQLiteStore) PageByID(ctx context.Context, siteID, pageID int64) (*Page, error) {
	return scanPage(s.db.QueryRowContext(ctx, pageSelect+` WHERE site_id = ? AND id = ?`, siteID, pageID))
}

func (s *SQLiteStore) PageByKey(ctx context.Context, siteID int64, pageKey string) (*Page, error) {
	return scanPage(s.db.QueryRowContext(ctx, pageSelect+` WHERE site_id = ? AND page_key = ?`, siteID, pageKey))
}

func scanPage(row rowScanner) (*Page, error) {
	var page Page
	var bundleRootURI string
	err := row.Scan(
		&page.ID,
		&page.SiteID,
		&page.ParentID,
		&page.PageKey,
		&page.Slug,
		&page.Title,
		&page.Note,
		&page.Description,
		&page.Status,
		&page.Position,
		&page.PublisherSubjectKey,
		&bundleRootURI,
		&page.Revision,
		&page.CreatedAt,
		&page.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPageNotFound
	}
	if err != nil {
		return nil, err
	}
	page.BundleRootURI = common.CanonURI(bundleRootURI)
	return &page, nil
}

func (s *SQLiteStore) ListPages(ctx context.Context, siteID int64) ([]Page, error) {
	rows, err := s.db.QueryContext(ctx, pageSelect+`
		WHERE site_id = ? ORDER BY parent_id IS NOT NULL, parent_id, position, id`, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pages := make([]Page, 0)
	for rows.Next() {
		page, err := scanPage(rows)
		if err != nil {
			return nil, err
		}
		pages = append(pages, *page)
	}
	return pages, rows.Err()
}

func (s *SQLiteStore) PageTypes(ctx context.Context, siteID, pageID int64) ([]string, error) {
	return s.pageStrings(ctx, siteID, pageID, "html_page_types", "type")
}

func (s *SQLiteStore) PageSearchTags(ctx context.Context, siteID, pageID int64) ([]string, error) {
	return s.pageStrings(ctx, siteID, pageID, "html_page_search_tags", "tag")
}

func (s *SQLiteStore) pageStrings(ctx context.Context, siteID, pageID int64, table, column string) ([]string, error) {
	if _, err := s.PageByID(ctx, siteID, pageID); err != nil {
		return nil, err
	}
	query := fmt.Sprintf("SELECT %s FROM %s WHERE page_id = ? ORDER BY %s", column, table, column)
	rows, err := s.db.QueryContext(ctx, query, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	values := make([]string, 0)
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	return values, rows.Err()
}

func (s *SQLiteStore) EditorLayout(ctx context.Context, siteID int64) (*EditorLayout, error) {
	var layout EditorLayout
	err := s.db.QueryRowContext(ctx, `SELECT site_id, schema_version, revision, xml, updated_at
		FROM html_editor_layouts WHERE site_id = ?`, siteID).Scan(
		&layout.SiteID,
		&layout.SchemaVersion,
		&layout.Revision,
		&layout.XML,
		&layout.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrSiteNotFound
	}
	if err != nil {
		return nil, err
	}
	return &layout, nil
}

func (s *SQLiteStore) ReplaceEditorLayout(ctx context.Context, siteID, expectedRevision int64, schemaVersion int, data []byte) (*EditorLayout, error) {
	if siteID <= 0 || expectedRevision <= 0 || schemaVersion != EditorXMLSchemaVersion || len(data) == 0 {
		return nil, ErrInvalidRecord
	}
	document, err := ParseEditorLayout(data, LayoutLimits{})
	if err != nil || document.SchemaVersion != schemaVersion || document.Revision != expectedRevision+1 {
		return nil, ErrInvalidRecord
	}
	var layout EditorLayout
	err = s.withTx(ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `UPDATE html_editor_layouts
			SET schema_version = ?, revision = revision + 1, xml = ?, updated_at = CURRENT_TIMESTAMP
			WHERE site_id = ? AND revision = ?`, schemaVersion, append([]byte(nil), data...), siteID, expectedRevision)
		if err != nil {
			return err
		}
		changed, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if changed == 0 {
			var current int64
			if err := tx.QueryRowContext(ctx, `SELECT revision FROM html_editor_layouts WHERE site_id = ?`, siteID).Scan(&current); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return ErrSiteNotFound
				}
				return err
			}
			return &RevisionConflict{Kind: ErrLayoutRevisionConflict, Current: current}
		}
		return tx.QueryRowContext(ctx, `SELECT site_id, schema_version, revision, xml, updated_at
			FROM html_editor_layouts WHERE site_id = ?`, siteID).Scan(
			&layout.SiteID,
			&layout.SchemaVersion,
			&layout.Revision,
			&layout.XML,
			&layout.UpdatedAt,
		)
	})
	if err != nil {
		return nil, classifyPageServiceError(err)
	}
	layout.XML = append([]byte(nil), layout.XML...)
	return &layout, nil
}

func (s *SQLiteStore) SiteSEO(ctx context.Context, siteID int64) (*SiteSEO, error) {
	var seo SiteSEO
	err := s.db.QueryRowContext(ctx, `SELECT site_id, robots_text, updated_at
		FROM html_site_seo WHERE site_id = ?`, siteID).Scan(&seo.SiteID, &seo.RobotsText, &seo.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrSiteNotFound
	}
	if err != nil {
		return nil, err
	}
	return &seo, nil
}

func (s *SQLiteStore) withTx(ctx context.Context, fn func(*sql.Tx) error) error {
	if s == nil || s.db == nil || fn == nil {
		return ErrInvalidRecord
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	return nil
}

func replaceStrings(ctx context.Context, tx *sql.Tx, table, column string, pageID int64, values []string) error {
	if _, err := tx.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s WHERE page_id = ?", table), pageID); err != nil {
		return err
	}
	query := fmt.Sprintf("INSERT INTO %s(page_id, %s) VALUES (?, ?)", table, column)
	for _, value := range values {
		if _, err := tx.ExecContext(ctx, query, pageID, value); err != nil {
			return err
		}
	}
	return nil
}

func normalizeSet(values []string, lower bool) []string {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if lower {
			value = strings.ToLower(value)
		}
		if value != "" {
			set[value] = struct{}{}
		}
	}
	out := make([]string, 0, len(set))
	for value := range set {
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}

func classifyStoreError(err error) error {
	if err == nil || errors.Is(err, ErrAlreadyExists) || errors.Is(err, ErrInvalidRecord) {
		return err
	}
	var sqliteErr sqlite3.Error
	if !errors.As(err, &sqliteErr) {
		return err
	}
	switch sqliteErr.ExtendedCode {
	case sqlite3.ErrConstraintPrimaryKey, sqlite3.ErrConstraintUnique:
		return fmt.Errorf("%w: %v", ErrAlreadyExists, err)
	case sqlite3.ErrConstraintCheck, sqlite3.ErrConstraintForeignKey, sqlite3.ErrConstraintTrigger:
		return fmt.Errorf("%w: %v", ErrInvalidRecord, err)
	default:
		return err
	}
}
