package local

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

type testRootCreator struct {
	next int64
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
