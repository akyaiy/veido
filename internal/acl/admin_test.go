package acl

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	testDBPath := filepath.Join("testdata", "test_groups.db")
	
	_ = os.Remove(testDBPath)

	// Открываем/создаём базу
	db, err := sql.Open("sqlite3", testDBPath)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	// Создаём таблицу groups
	schema := `
	CREATE TABLE IF NOT EXISTS groups (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE
	);
	`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		t.Fatalf("failed to create groups table: %v", err)
	}

	testGroups := []string{
		"Admin",
		"User",
		"Editor",
		"Viewer",
		"Moderator",
		"Guest",
		"SuperAdmin",
		"Contributor",
		"Reviewer",
		"Manager",
	}

	for _, name := range testGroups {
		_, err := db.Exec("INSERT INTO groups(name) VALUES (?)", name)
		if err != nil {
			db.Close()
			t.Fatalf("failed to insert test group: %v", err)
		}
	}

	return db
}

func TestGetGroups(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	tests := []struct {
		name      string
		limit     int
		offset    int
		wantCount int
	}{
		{
			name:      "first 3 groups",
			limit:     3,
			offset:    0,
			wantCount: 3,
		},
		{
			name:      "next 3 groups",
			limit:     3,
			offset:    3,
			wantCount: 3,
		},
		{
			name:      "last 2 groups",
			limit:     2,
			offset:    8,
			wantCount: 2,
		},
		{
			name:      "offset beyond total",
			limit:     10,
			offset:    20,
			wantCount: 0,
		},
		{
			name:      "get all groups",
			limit:     100,
			offset:    0,
			wantCount: 10,
		},
		{
			name:      "limit 0",
			limit:     0,
			offset:    0,
			wantCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetGroups(db, tt.limit, tt.offset)
			
			if len(result) != tt.wantCount {
				t.Errorf("GetGroups(%d, %d) returned %d groups, want %d",
					tt.limit, tt.offset, len(result), tt.wantCount)
			}

			for i, group := range result {
				if group.ID == 0 {
					t.Errorf("group[%d] has zero ID", i)
				}
				if group.Name == "" {
					t.Errorf("group[%d] has empty Name", i)
				}
			}
		})
	}
}

func TestGetGroups_OrderAndConsistency(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	firstBatch := GetGroups(db, 5, 0)
	secondBatch := GetGroups(db, 5, 5)

	if len(firstBatch) != 5 || len(secondBatch) != 5 {
		t.Fatalf("expected 5 groups in each batch, got %d and %d", len(firstBatch), len(secondBatch))
	}

	// Проверяем что роли отличаются
	firstIDs := make(map[int64]bool)
	for _, group := range firstBatch {
		firstIDs[group.ID] = true
	}

	for _, group := range secondBatch {
		if firstIDs[group.ID] {
			t.Errorf("group ID %d appears in both batches - pagination is broken", group.ID)
		}
	}
}

func TestGetGroups_EmptyDatabase(t *testing.T) {
	testDBPath := filepath.Join("testdata", "test_groups_empty.db")
	_ = os.Remove(testDBPath)

	db, err := sql.Open("sqlite3", testDBPath)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}
	defer db.Close()

	schema := `CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY, name TEXT);`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create groups table: %v", err)
	}

	result := GetGroups(db, 10, 0)
	
	if len(result) != 0 {
		t.Errorf("GetGroups on empty table should return empty slice, got %d groups", len(result))
	}
}
