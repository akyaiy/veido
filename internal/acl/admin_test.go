package acl

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	testDBPath := filepath.Join("testdata", "test_roles.db")
	
	_ = os.Remove(testDBPath)

	// Открываем/создаём базу
	db, err := sql.Open("sqlite3", testDBPath)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	// Создаём таблицу roles
	schema := `
	CREATE TABLE IF NOT EXISTS roles (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE
	);
	`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		t.Fatalf("failed to create roles table: %v", err)
	}

	testRoles := []string{
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

	for _, name := range testRoles {
		_, err := db.Exec("INSERT INTO roles(name) VALUES (?)", name)
		if err != nil {
			db.Close()
			t.Fatalf("failed to insert test role: %v", err)
		}
	}

	return db
}

func TestGetRoles(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	tests := []struct {
		name      string
		limit     int
		offset    int
		wantCount int
	}{
		{
			name:      "first 3 roles",
			limit:     3,
			offset:    0,
			wantCount: 3,
		},
		{
			name:      "next 3 roles",
			limit:     3,
			offset:    3,
			wantCount: 3,
		},
		{
			name:      "last 2 roles",
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
			name:      "get all roles",
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
			result := GetRoles(db, tt.limit, tt.offset)
			
			if len(result) != tt.wantCount {
				t.Errorf("GetRoles(%d, %d) returned %d roles, want %d",
					tt.limit, tt.offset, len(result), tt.wantCount)
			}

			for i, role := range result {
				if role.ID == 0 {
					t.Errorf("role[%d] has zero ID", i)
				}
				if role.Name == "" {
					t.Errorf("role[%d] has empty Name", i)
				}
			}
		})
	}
}

func TestGetRoles_OrderAndConsistency(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	firstBatch := GetRoles(db, 5, 0)
	secondBatch := GetRoles(db, 5, 5)

	if len(firstBatch) != 5 || len(secondBatch) != 5 {
		t.Fatalf("expected 5 roles in each batch, got %d and %d", len(firstBatch), len(secondBatch))
	}

	// Проверяем что роли отличаются
	firstIDs := make(map[int64]bool)
	for _, role := range firstBatch {
		firstIDs[role.ID] = true
	}

	for _, role := range secondBatch {
		if firstIDs[role.ID] {
			t.Errorf("role ID %d appears in both batches - pagination is broken", role.ID)
		}
	}
}

func TestGetRoles_EmptyDatabase(t *testing.T) {
	testDBPath := filepath.Join("testdata", "test_roles_empty.db")
	_ = os.Remove(testDBPath)

	db, err := sql.Open("sqlite3", testDBPath)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}
	defer db.Close()

	schema := `CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, name TEXT);`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create roles table: %v", err)
	}

	result := GetRoles(db, 10, 0)
	
	if len(result) != 0 {
		t.Errorf("GetRoles on empty table should return empty slice, got %d roles", len(result))
	}
}
