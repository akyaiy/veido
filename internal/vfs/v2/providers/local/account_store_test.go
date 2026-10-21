package local

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

type testRootCreator struct {
	next int64
}

func newTestAccountProvider(t *testing.T) (*AccountProvider, context.Context) {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("db.Close() error = %v", err)
		}
	})
	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		t.Fatalf("enable foreign keys error = %v", err)
	}

	const schema = `
		CREATE TABLE artifacts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hash TEXT NOT NULL UNIQUE,
			size INTEGER NOT NULL DEFAULT 0,
			relations_count INTEGER DEFAULT 0
		);
		CREATE TABLE metadata (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			parent_id INTEGER REFERENCES metadata(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			is_dir BOOLEAN NOT NULL DEFAULT 0,
			owner TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			artefact_id INTEGER,
			FOREIGN KEY (artefact_id) REFERENCES artifacts(id) ON DELETE SET NULL
		);
		CREATE UNIQUE INDEX idx_metadata_parent_name ON metadata(parent_id, name) WHERE parent_id IS NOT NULL;
		CREATE TABLE garbage_queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hash TEXT NOT NULL,
			size INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TRIGGER increment_artefact_relations
		AFTER INSERT ON metadata
		FOR EACH ROW
		WHEN NEW.artefact_id IS NOT NULL
		BEGIN
			UPDATE artifacts SET relations_count = relations_count + 1 WHERE id = NEW.artefact_id;
		END;
		CREATE TRIGGER decrement_or_queue_artefact
		AFTER DELETE ON metadata
		FOR EACH ROW
		WHEN OLD.artefact_id IS NOT NULL
		BEGIN
			UPDATE artifacts SET relations_count = relations_count - 1 WHERE id = OLD.artefact_id;
			INSERT INTO garbage_queue (hash, size)
			SELECT hash, size FROM artifacts WHERE id = OLD.artefact_id AND relations_count <= 0;
			DELETE FROM artifacts WHERE id = OLD.artefact_id AND relations_count <= 0;
		END;
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("db.Exec(schema) error = %v", err)
	}

	result, err := db.Exec(`INSERT INTO metadata (parent_id, name, is_dir, owner) VALUES (NULL, 'local:test', 1, 'user:42')`)
	if err != nil {
		t.Fatalf("insert root metadata error = %v", err)
	}
	rootID, err := result.LastInsertId()
	if err != nil {
		t.Fatalf("LastInsertId(root) error = %v", err)
	}

	account := &Account{
		SubjectKey: "local:test",
		RootNodeID: rootID,
		OwnerActor: "user:42",
		Status:     "active",
	}
	provider := NewAccountProvider(
		vfs.ProviderConnection{ID: 7, ScopeKey: "home", ProviderKey: ProviderKey, ConnectionKey: "local"},
		nil,
		account,
		db,
		NewLocalStorageDriver(t.TempDir()),
	)
	ctx := vfs.ContextWithRequestContext(context.Background(), vfs.RequestContext{
		ActorKey: vfs.Actor{Kind: vfs.ActorUser, ID: "42"},
	})
	return provider, ctx
}

func (c *testRootCreator) CreateRootNode(ctx context.Context, tx *sql.Tx, ownerActor string, subjectKey string) (int64, error) {
	c.next++
	return c.next, nil
}

func newTestStore(t *testing.T) (AccountStore, vfs.ProviderConnection) {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("db.Close() error = %v", err)
		}
	})

	if _, err := db.Exec(SchemaSQL); err != nil {
		t.Fatalf("db.Exec(schema) error = %v", err)
	}

	store, err := NewSQLiteAccountStore(db, &testRootCreator{})
	if err != nil {
		t.Fatalf("NewSQLiteAccountStore() error = %v", err)
	}

	return store, vfs.ProviderConnection{
		ID:            42,
		ScopeKey:      "alice-home",
		ProviderKey:   ProviderKey,
		ConnectionKey: "default",
	}
}

func TestSQLiteAccountStoreCreateFromBootstrapCreatesAccountOnce(t *testing.T) {
	ctx := context.Background()
	store, connection := newTestStore(t)

	account, secret, err := store.CreateFromBootstrap(ctx, BootstrapRequest{
		Connection: connection,
		Actor:      vfs.Actor{Kind: vfs.ActorUser, ID: "42"},
	})
	if err != nil {
		t.Fatalf("CreateFromBootstrap() error = %v", err)
	}
	if account.SubjectKey == "" || account.RootNodeID == 0 || secret == "" {
		t.Fatalf("account/secret not populated: account=%+v secret=%q", account, secret)
	}

	authenticated, err := store.Authenticate(ctx, account.SubjectKey, secret)
	if err != nil {
		t.Fatalf("Authenticate() error = %v", err)
	}
	if authenticated.RootNodeID != account.RootNodeID {
		t.Fatalf("authenticated root = %d, want %d", authenticated.RootNodeID, account.RootNodeID)
	}

	_, _, err = store.CreateFromBootstrap(ctx, BootstrapRequest{
		Connection: connection,
		Actor:      vfs.Actor{Kind: vfs.ActorUser, ID: "42"},
	})
	if !os.IsNotExist(err) {
		t.Fatalf("second CreateFromBootstrap() error = %v, want os.ErrNotExist", err)
	}
}

func TestBootstrapProviderCreateRequestCreatesAccountOnSave(t *testing.T) {
	ctx := context.Background()
	store, connection := newTestStore(t)
	provider := NewBootstrapProvider(connection, store)

	rctx := vfs.RequestContext{
		ActorKey: vfs.Actor{Kind: vfs.ActorUser, ID: "42"},
	}
	ctx = vfs.ContextWithRequestContext(ctx, rctx)

	first, err := provider.OpenFile(ctx, "/%account%/create_request.json", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(first create_request.json) error = %v", err)
	}
	firstData, err := io.ReadAll(first)
	if err != nil {
		t.Fatalf("ReadAll(first create_request.json) error = %v", err)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("Close(first create_request.json) error = %v", err)
	}

	second, err := provider.OpenFile(ctx, "/%account%/create_request.json", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(second create_request.json) error = %v", err)
	}
	secondData, err := io.ReadAll(second)
	if err != nil {
		t.Fatalf("ReadAll(second create_request.json) error = %v", err)
	}
	if err := second.Close(); err != nil {
		t.Fatalf("Close(second create_request.json) error = %v", err)
	}

	var firstPayload CreateRequest
	if err := json.Unmarshal(firstData, &firstPayload); err != nil {
		t.Fatalf("Unmarshal(first create_request.json) error = %v", err)
	}
	var secondPayload CreateRequest
	if err := json.Unmarshal(secondData, &secondPayload); err != nil {
		t.Fatalf("Unmarshal(second create_request.json) error = %v", err)
	}
	if firstPayload.Secret == secondPayload.Secret {
		t.Fatalf("create_request.json reused secret %q", firstPayload.Secret)
	}
	if firstPayload.Done ||
		!strings.HasPrefix(firstPayload.SubjectKey, "local:") ||
		firstPayload.Secret == "" {
		t.Fatalf("unexpected create request payload: %+v", firstPayload)
	}

	firstPayload.Done = true
	saveData, err := json.Marshal(firstPayload)
	if err != nil {
		t.Fatalf("Marshal(create request) error = %v", err)
	}

	writer, err := provider.OpenFile(ctx, "/%account%/create_request.json", os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(write create_request.json) error = %v", err)
	}
	if _, err := writer.Write(saveData); err != nil {
		t.Fatalf("Write(create_request.json) error = %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close(write create_request.json) error = %v", err)
	}

	if _, err := store.Authenticate(ctx, firstPayload.SubjectKey, firstPayload.Secret); err != nil {
		t.Fatalf("Authenticate(created account) error = %v", err)
	}

	_, err = provider.Stat(ctx, "/%account%/create_request.json")
	if !os.IsNotExist(err) {
		t.Fatalf("Stat(consumed create_request.json) error = %v, want os.ErrNotExist", err)
	}
}

func TestAccountProviderFileSystemCreateReadMoveDelete(t *testing.T) {
	provider, ctx := newTestAccountProvider(t)

	if _, err := provider.Mkdir(ctx, "/", "docs"); err != nil {
		t.Fatalf("Mkdir(/, docs) error = %v", err)
	}

	writer, err := provider.OpenFile(ctx, "/docs/hello.txt", os.O_CREATE|os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(write hello.txt) error = %v", err)
	}
	if _, err := writer.Write([]byte("hello local")); err != nil {
		t.Fatalf("Write(hello.txt) error = %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close(write hello.txt) error = %v", err)
	}

	nodes, err := provider.ReadDir(ctx, "/docs")
	if err != nil {
		t.Fatalf("ReadDir(/docs) error = %v", err)
	}
	if len(nodes) != 1 || nodes[0].Name != "hello.txt" || nodes[0].Size != int64(len("hello local")) {
		t.Fatalf("ReadDir(/docs) = %+v, want hello.txt", nodes)
	}

	reader, err := provider.OpenFile(ctx, "/docs/hello.txt", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(read hello.txt) error = %v", err)
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll(hello.txt) error = %v", err)
	}
	if err := reader.Close(); err != nil {
		t.Fatalf("Close(read hello.txt) error = %v", err)
	}
	if string(data) != "hello local" {
		t.Fatalf("file content = %q, want hello local", data)
	}

	if err := provider.Move(ctx, "/docs/hello.txt", "/", "moved.txt"); err != nil {
		t.Fatalf("Move(hello.txt) error = %v", err)
	}
	if _, err := provider.Stat(ctx, "/moved.txt"); err != nil {
		t.Fatalf("Stat(/moved.txt) error = %v", err)
	}
	if err := provider.Delete(ctx, "/moved.txt"); err != nil {
		t.Fatalf("Delete(/moved.txt) error = %v", err)
	}
	if _, err := provider.Stat(ctx, "/moved.txt"); !os.IsNotExist(err) {
		t.Fatalf("Stat(deleted moved.txt) error = %v, want os.ErrNotExist", err)
	}
}

func TestAccountProviderReplacingFileWithIdenticalContentIsNoOp(t *testing.T) {
	provider, ctx := newTestAccountProvider(t)
	const content = "console.log('unchanged');\n"

	writer, err := provider.OpenFile(ctx, "/script.js", os.O_CREATE|os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(create script.js) error = %v", err)
	}
	if _, err := writer.Write([]byte(content)); err != nil {
		t.Fatalf("Write(create script.js) error = %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close(create script.js) error = %v", err)
	}

	replacement, err := provider.OpenFile(ctx, "/script.js", os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(replace script.js) error = %v", err)
	}
	if _, err := replacement.Write([]byte(content)); err != nil {
		t.Fatalf("Write(replace script.js) error = %v", err)
	}
	if err := replacement.Close(); err != nil {
		t.Fatalf("Close(replace script.js) error = %v", err)
	}

	reader, err := provider.OpenFile(ctx, "/script.js", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(read script.js) error = %v", err)
	}
	data, readErr := io.ReadAll(reader)
	if err := errors.Join(readErr, reader.Close()); err != nil {
		t.Fatalf("Read(script.js) error = %v", err)
	}
	if string(data) != content {
		t.Fatalf("script.js = %q, want %q", data, content)
	}
}

func TestAccountProviderAppendCreatesReadableFile(t *testing.T) {
	provider, ctx := newTestAccountProvider(t)

	writer, err := provider.OpenFile(ctx, "/append.txt", os.O_CREATE|os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(create append.txt) error = %v", err)
	}
	if _, err := writer.Write([]byte("hello")); err != nil {
		t.Fatalf("Write(initial append.txt) error = %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("Close(initial append.txt) error = %v", err)
	}

	appender, err := provider.OpenFile(ctx, "/append.txt", os.O_WRONLY|os.O_APPEND)
	if err != nil {
		t.Fatalf("OpenFile(append append.txt) error = %v", err)
	}
	if _, err := appender.Write([]byte(" world")); err != nil {
		t.Fatalf("Write(append append.txt) error = %v", err)
	}
	if err := appender.Close(); err != nil {
		t.Fatalf("Close(append append.txt) error = %v", err)
	}

	reader, err := provider.OpenFile(ctx, "/append.txt", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(read append.txt) error = %v", err)
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll(append.txt) error = %v", err)
	}
	if err := reader.Close(); err != nil {
		t.Fatalf("Close(read append.txt) error = %v", err)
	}
	if string(data) != "hello world" {
		t.Fatalf("append.txt = %q, want hello world", data)
	}
}

func TestAccountProviderAbortedUploadDoesNotPublish(t *testing.T) {
	provider, ctx := newTestAccountProvider(t)
	file, err := provider.OpenFile(ctx, "/incomplete.bin", os.O_CREATE|os.O_WRONLY|os.O_EXCL)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write([]byte("partial")); err != nil {
		t.Fatal(err)
	}
	if err := vfs.FinishWrite(file, io.ErrUnexpectedEOF); err == nil {
		t.Fatal("lost transfer failure")
	}
	_ = file.Close()
	if _, err := provider.Stat(ctx, "/incomplete.bin"); !os.IsNotExist(err) {
		t.Fatalf("aborted file was published: %v", err)
	}
	file, err = provider.OpenFile(ctx, "/incomplete.bin", os.O_CREATE|os.O_WRONLY|os.O_EXCL)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write([]byte("complete")); err != nil {
		t.Fatal(err)
	}
	if err := vfs.FinishWrite(file, nil); err != nil {
		t.Fatal(err)
	}
	node, err := provider.Stat(ctx, "/incomplete.bin")
	if err != nil || node.Size != 8 {
		t.Fatalf("complete file: %+v %v", node, err)
	}
}

func TestAccountProviderAccountDirHiddenButAddressable(t *testing.T) {
	provider, ctx := newTestAccountProvider(t)

	nodes, err := provider.ReadDir(ctx, "/")
	if err != nil {
		t.Fatalf("ReadDir(/) error = %v", err)
	}
	for _, node := range nodes {
		if node.Name == accountDir {
			t.Fatalf("ReadDir(/) includes hidden %s: %+v", accountDir, nodes)
		}
	}

	if _, err := provider.Stat(ctx, "/"+accountDir); err != nil {
		t.Fatalf("Stat(%s) error = %v", accountDir, err)
	}
	file, err := provider.OpenFile(ctx, "/"+accountDir+"/info.json", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(%s/info.json) error = %v", accountDir, err)
	}
	data, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("ReadAll(info.json) error = %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close(info.json) error = %v", err)
	}
	if !strings.Contains(string(data), `"connection_id": 7`) {
		t.Fatalf("info.json = %s, want connection_id 7", data)
	}
}

func TestAccountProviderStatsJSON(t *testing.T) {
	provider, ctx := newTestAccountProvider(t)

	if _, err := provider.Mkdir(ctx, "/", "docs"); err != nil {
		t.Fatalf("Mkdir(/, docs) error = %v", err)
	}
	for _, name := range []string{"/docs/a.txt", "/docs/b.txt"} {
		writer, err := provider.OpenFile(ctx, name, os.O_CREATE|os.O_WRONLY|os.O_TRUNC)
		if err != nil {
			t.Fatalf("OpenFile(%s) error = %v", name, err)
		}
		if _, err := writer.Write([]byte("same")); err != nil {
			t.Fatalf("Write(%s) error = %v", name, err)
		}
		if err := writer.Close(); err != nil {
			t.Fatalf("Close(%s) error = %v", name, err)
		}
	}

	file, err := provider.OpenFile(ctx, "/"+accountDir+"/stats.json", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(stats.json) error = %v", err)
	}
	data, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("ReadAll(stats.json) error = %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close(stats.json) error = %v", err)
	}

	var stats AccountStats
	if err := json.Unmarshal(data, &stats); err != nil {
		t.Fatalf("Unmarshal(stats.json) error = %v; body=%s", err, data)
	}
	if stats.Files != 2 || stats.Directories != 2 || stats.LogicalBytes != 8 || stats.PhysicalBytes != 4 {
		t.Fatalf("stats = %+v, want files=2 directories=2 logical=8 physical=4; body=%s", stats, data)
	}
}
