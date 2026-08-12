package local

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"time"
)

const SchemaSQL = `
CREATE TABLE IF NOT EXISTS local_accounts (
	subject_key TEXT PRIMARY KEY,
	secret_hash TEXT NOT NULL,
	root_node_id INTEGER NOT NULL,
	owner_actor TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_bootstraps (
	connection_id INTEGER PRIMARY KEY,
	scope_key TEXT NOT NULL,
	provider TEXT NOT NULL,
	connection_key TEXT NOT NULL,
	consumed INTEGER NOT NULL DEFAULT 0,
	subject_key TEXT,
	consumed_at DATETIME,
	FOREIGN KEY (subject_key) REFERENCES local_accounts(subject_key)
);
`

func InitDB(db *sql.DB) error {
	if _, err := db.Exec(SchemaSQL); err != nil {
		return err
	}

	_, _ = db.Exec("ALTER TABLE local_bootstraps ADD COLUMN connection_id INTEGER NOT NULL DEFAULT 0")
	_, _ = db.Exec(`
		UPDATE local_bootstraps
		SET connection_id = (
			SELECT vfs_provider_connections.id
			FROM vfs_provider_connections
			WHERE vfs_provider_connections.scope_key = local_bootstraps.scope_key
			  AND vfs_provider_connections.provider = local_bootstraps.provider
			  AND vfs_provider_connections.connection_key = local_bootstraps.connection_key
		)
		WHERE connection_id = 0
	`)
	_, err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_local_bootstraps_connection_id ON local_bootstraps(connection_id)")
	return err
}

type Account struct {
	SubjectKey string
	RootNodeID int64
	OwnerActor string
	Status     string
	CreatedAt  *time.Time
	UpdatedAt  *time.Time
}

type AccountInfo struct {
	ConnectionID int64      `json:"connection_id,omitempty"`
	SubjectKey   string     `json:"subject_key"`
	RootNodeID   int64      `json:"root_node_id"`
	OwnerActor   string     `json:"owner_actor"`
	Status       string     `json:"status"`
	CreatedAt    *time.Time `json:"created_at,omitempty"`
	UpdatedAt    *time.Time `json:"updated_at,omitempty"`
}

type BootstrapRequest struct {
	Connection vfs.ProviderConnection
	Actor      vfs.Actor
}

type BootstrapCredentialRequest struct {
	Connection vfs.ProviderConnection
	Actor      vfs.Actor
	SubjectKey string
	Secret     string
}

type AccountStore interface {
	BootstrapConsumed(ctx context.Context, connection vfs.ProviderConnection) (bool, error)
	CreateFromBootstrap(ctx context.Context, req BootstrapRequest) (*Account, string, error)
	CreateFromBootstrapCredentials(ctx context.Context, req BootstrapCredentialRequest) (*Account, error)
	InfoForConnection(ctx context.Context, connection vfs.ProviderConnection) (*AccountInfo, error)
	Authenticate(ctx context.Context, subjectKey string, secret string) (*Account, error)
}

type RootNodeCreator interface {
	CreateRootNode(ctx context.Context, tx *sql.Tx, ownerActor string, subjectKey string) (int64, error)
}

type MetadataRootNodeCreator struct{}

func (MetadataRootNodeCreator) CreateRootNode(ctx context.Context, tx *sql.Tx, ownerActor string, subjectKey string) (int64, error) {
	result, err := tx.ExecContext(
		ctx,
		`INSERT INTO metadata (parent_id, name, is_dir, owner) VALUES (NULL, ?, 1, ?)`,
		subjectKey,
		ownerActor,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

type SQLiteAccountStore struct {
	db          *sql.DB
	rootCreator RootNodeCreator
}

func NewSQLiteAccountStore(db *sql.DB, rootCreator RootNodeCreator) (AccountStore, error) {
	if db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	if rootCreator == nil {
		rootCreator = MetadataRootNodeCreator{}
	}
	return &SQLiteAccountStore{
		db:          db,
		rootCreator: rootCreator,
	}, nil
}

func (s *SQLiteAccountStore) BootstrapConsumed(ctx context.Context, connection vfs.ProviderConnection) (bool, error) {
	if s == nil || s.db == nil {
		return false, vfs.ErrInvalidNewInstanceParams
	}

	var consumed bool
	if connection.ID > 0 {
		err := s.db.QueryRowContext(
			ctx,
			`SELECT consumed FROM local_bootstraps WHERE connection_id = ?`,
			connection.ID,
		).Scan(&consumed)
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		return consumed, nil
	}

	err := s.db.QueryRowContext(
		ctx,
		`SELECT consumed FROM local_bootstraps WHERE scope_key = ? AND provider = ? AND connection_key = ?`,
		connection.ScopeKey,
		connection.ProviderKey,
		connection.ConnectionKey,
	).Scan(&consumed)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return consumed, nil
}

func (s *SQLiteAccountStore) CreateFromBootstrap(ctx context.Context, req BootstrapRequest) (*Account, string, error) {
	subjectKey, err := NewSubjectKey()
	if err != nil {
		return nil, "", err
	}
	secret, err := NewSecret()
	if err != nil {
		return nil, "", err
	}

	account, err := s.CreateFromBootstrapCredentials(ctx, BootstrapCredentialRequest{
		Connection: req.Connection,
		Actor:      req.Actor,
		SubjectKey: subjectKey,
		Secret:     secret,
	})
	if err != nil {
		return nil, "", err
	}
	return account, secret, nil
}

func (s *SQLiteAccountStore) CreateFromBootstrapCredentials(ctx context.Context, req BootstrapCredentialRequest) (*Account, error) {
	if s == nil || s.db == nil || s.rootCreator == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	if req.Connection.ID <= 0 {
		return nil, vfs.ErrConnectionNotFound
	}
	if req.Connection.ScopeKey == "" || req.Connection.ProviderKey == "" || req.Connection.ConnectionKey == "" {
		return nil, vfs.ErrConnectionNotFound
	}
	if req.Actor.Kind == "" || req.Actor.ID == "" {
		return nil, os.ErrPermission
	}
	if req.SubjectKey == "" || req.Secret == "" {
		return nil, os.ErrInvalid
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	consumed, err := bootstrapConsumedTx(ctx, tx, req.Connection)
	if err != nil {
		return nil, err
	}
	if consumed {
		return nil, os.ErrNotExist
	}
	rootNodeID, err := s.rootCreator.CreateRootNode(ctx, tx, req.Actor.String(), req.SubjectKey)
	if err != nil {
		return nil, err
	}

	account := &Account{
		SubjectKey: req.SubjectKey,
		RootNodeID: rootNodeID,
		OwnerActor: req.Actor.String(),
		Status:     "active",
	}
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO local_accounts (subject_key, secret_hash, root_node_id, owner_actor, status)
		 VALUES (?, ?, ?, ?, ?)`,
		account.SubjectKey,
		hashSecret(req.Secret),
		account.RootNodeID,
		account.OwnerActor,
		account.Status,
	); err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO local_bootstraps (connection_id, scope_key, provider, connection_key, consumed, subject_key, consumed_at)
		 VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(connection_id) DO UPDATE SET
			scope_key = excluded.scope_key,
			provider = excluded.provider,
			connection_key = excluded.connection_key,
			consumed = 1,
			subject_key = excluded.subject_key,
			consumed_at = CURRENT_TIMESTAMP`,
		req.Connection.ID,
		req.Connection.ScopeKey,
		req.Connection.ProviderKey,
		req.Connection.ConnectionKey,
		account.SubjectKey,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	committed = true
	return account, nil
}

func (s *SQLiteAccountStore) InfoForConnection(ctx context.Context, connection vfs.ProviderConnection) (*AccountInfo, error) {
	if s == nil || s.db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	var subjectKey string
	var err error
	if connection.ID > 0 {
		err = s.db.QueryRowContext(
			ctx,
			`SELECT subject_key FROM local_bootstraps
			 WHERE connection_id = ? AND consumed = 1`,
			connection.ID,
		).Scan(&subjectKey)
	} else {
		err = s.db.QueryRowContext(
			ctx,
			`SELECT subject_key FROM local_bootstraps
			 WHERE scope_key = ? AND provider = ? AND connection_key = ? AND consumed = 1`,
			connection.ScopeKey,
			connection.ProviderKey,
			connection.ConnectionKey,
		).Scan(&subjectKey)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return nil, os.ErrNotExist
	}
	if err != nil {
		return nil, err
	}

	account, err := s.accountBySubject(ctx, subjectKey)
	if err != nil {
		return nil, err
	}
	info := account.info()
	info.ConnectionID = connection.ID
	return info, nil
}

func (s *SQLiteAccountStore) Authenticate(ctx context.Context, subjectKey string, secret string) (*Account, error) {
	if s == nil || s.db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	if subjectKey == "" || secret == "" {
		return nil, os.ErrPermission
	}

	var storedHash string
	account := &Account{}
	err := s.db.QueryRowContext(
		ctx,
		`SELECT subject_key, secret_hash, root_node_id, owner_actor, status, created_at, updated_at
		 FROM local_accounts
		 WHERE subject_key = ? AND status = 'active'`,
		subjectKey,
	).Scan(
		&account.SubjectKey,
		&storedHash,
		&account.RootNodeID,
		&account.OwnerActor,
		&account.Status,
		&account.CreatedAt,
		&account.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, os.ErrPermission
	}
	if err != nil {
		return nil, err
	}

	if subtle.ConstantTimeCompare([]byte(storedHash), []byte(hashSecret(secret))) != 1 {
		return nil, os.ErrPermission
	}
	return account, nil
}

func (s *SQLiteAccountStore) accountBySubject(ctx context.Context, subjectKey string) (*Account, error) {
	account := &Account{}
	err := s.db.QueryRowContext(
		ctx,
		`SELECT subject_key, root_node_id, owner_actor, status, created_at, updated_at
		 FROM local_accounts
		 WHERE subject_key = ?`,
		subjectKey,
	).Scan(
		&account.SubjectKey,
		&account.RootNodeID,
		&account.OwnerActor,
		&account.Status,
		&account.CreatedAt,
		&account.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, os.ErrNotExist
	}
	if err != nil {
		return nil, err
	}
	return account, nil
}

func (a *Account) info() *AccountInfo {
	if a == nil {
		return nil
	}
	return &AccountInfo{
		SubjectKey: a.SubjectKey,
		RootNodeID: a.RootNodeID,
		OwnerActor: a.OwnerActor,
		Status:     a.Status,
		CreatedAt:  a.CreatedAt,
		UpdatedAt:  a.UpdatedAt,
	}
}

func bootstrapConsumedTx(ctx context.Context, tx *sql.Tx, connection vfs.ProviderConnection) (bool, error) {
	var consumed bool
	if connection.ID > 0 {
		err := tx.QueryRowContext(
			ctx,
			`SELECT consumed FROM local_bootstraps WHERE connection_id = ?`,
			connection.ID,
		).Scan(&consumed)
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		return consumed, nil
	}

	err := tx.QueryRowContext(
		ctx,
		`SELECT consumed FROM local_bootstraps WHERE scope_key = ? AND provider = ? AND connection_key = ?`,
		connection.ScopeKey,
		connection.ProviderKey,
		connection.ConnectionKey,
	).Scan(&consumed)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return consumed, nil
}

func NewSubjectKey() (string, error) {
	id, err := randomBase64URL(18)
	if err != nil {
		return "", err
	}
	return "local:" + id, nil
}

func NewSecret() (string, error) {
	return randomBase64URL(32)
}

func randomBase64URL(size int) (string, error) {
	if size <= 0 {
		return "", fmt.Errorf("invalid random size")
	}
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}
