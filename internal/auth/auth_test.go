package auth

import (
	"context"
	"errors"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"MyServer/internal/database/migrate"
	"MyServer/internal/sqliteDB"
)

const testPassword = "correct-horse-battery-staple"

func newTestAuth(t *testing.T) (*Auth, int64) {
	t.Helper()
	db, err := sqliteDB.Open(context.Background(), filepath.Join(t.TempDir(), "auth.sqlite3"), sqliteDB.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrate.Run(context.Background(), db, sqliteDB.MigrationGroup(), MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	service, err := NewAuth(db, Config{Secret: []byte("0123456789abcdef0123456789abcdef"), Issuer: "auth-test", Audience: "auth-clients", AccessTTL: 5 * time.Minute, RefreshTTL: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	id, err := service.CreateUser(&User{Name: " Alice.Example ", Password: testPassword, Status: " ACTIVE "})
	if err != nil {
		t.Fatal(err)
	}
	return service, int64(id)
}

func login(t *testing.T, service *Auth) *LoginResponse {
	t.Helper()
	response, err := service.Login(&LoginRequest{Username: "ALICE.EXAMPLE", Password: testPassword})
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func TestLoginAndAccessVerification(t *testing.T) {
	service, userID := newTestAuth(t)
	response := login(t, service)
	claims, err := service.VerifyAccessToken(response.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject == "" || claims.SessionID == "" || claims.TokenUse != TokenUseAccess || claims.Issuer != "auth-test" || claims.ID == "" || claims.IssuedAt == nil || claims.NotBefore == nil || claims.ExpiresAt == nil || len(claims.Audience) != 1 || claims.Audience[0] != "auth-clients" {
		t.Fatalf("access token misses required claims: %#v", claims)
	}
	var stored string
	if err := service.db.QueryRow("SELECT refresh_token_hash FROM sessions WHERE id = ?", claims.SessionID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored == response.RefreshToken || stored != tokenHash(response.RefreshToken) {
		t.Fatal("refresh credential was not stored exclusively as a hash")
	}
	if response.UserID != userID || response.Username != "alice.example" {
		t.Fatalf("unexpected login response: %#v", response)
	}
}

func TestRefreshRotationAndReuseRevokesSession(t *testing.T) {
	service, _ := newTestAuth(t)
	initial := login(t, service)
	rotated, err := service.Refresh(&RefreshRequest{RefreshToken: initial.RefreshToken})
	if err != nil {
		t.Fatal(err)
	}
	if rotated.RefreshToken == initial.RefreshToken {
		t.Fatal("refresh token was not rotated")
	}
	if _, err := service.VerifyAccessToken(rotated.AccessToken); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Refresh(&RefreshRequest{RefreshToken: initial.RefreshToken}); !errors.Is(err, ErrRefreshTokenReuse) {
		t.Fatalf("old refresh reuse error = %v", err)
	}
	if _, err := service.VerifyAccessToken(rotated.AccessToken); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("session survived refresh reuse: %v", err)
	}
	if _, err := service.Refresh(&RefreshRequest{RefreshToken: rotated.RefreshToken}); err == nil {
		t.Fatal("revoked token family can still refresh")
	}
}

func TestConcurrentRefreshCreatesAtMostOneBranch(t *testing.T) {
	service, _ := newTestAuth(t)
	initial := login(t, service)
	start := make(chan struct{})
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := service.Refresh(&RefreshRequest{RefreshToken: initial.RefreshToken})
			results <- err
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		}
	}
	if successes > 1 {
		t.Fatalf("concurrent refresh created %d successful branches", successes)
	}
}

func TestLogoutUsesAuthenticatedSession(t *testing.T) {
	service, userID := newTestAuth(t)
	response := login(t, service)
	claims, err := service.VerifyAccessToken(response.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	ctx := ContextWithPrincipal(context.Background(), Principal{UserID: userID, SessionID: claims.SessionID})
	if err := service.Logout(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Refresh(&RefreshRequest{RefreshToken: response.RefreshToken}); err == nil {
		t.Fatal("refresh succeeded after logout")
	}
	if _, err := service.VerifyAccessToken(response.AccessToken); err == nil {
		t.Fatal("access succeeded after logout")
	}
}

func TestBlockedUserRejectedByLoginBasicAndExistingSession(t *testing.T) {
	service, userID := newTestAuth(t)
	response := login(t, service)
	if err := service.UpdateUser(userID, &User{Status: StatusBlocked}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Login(&LoginRequest{Username: "alice.example", Password: testPassword}); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("login error = %v", err)
	}
	req := httptest.NewRequest("GET", "/webdav", nil)
	req.SetBasicAuth("alice.example", testPassword)
	if _, err := service.AuthenticateBasicRequest(req); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("basic error = %v", err)
	}
	if _, err := service.VerifyAccessToken(response.AccessToken); err == nil {
		t.Fatal("existing access survived block")
	}
}

func TestPasswordChangeChecksOldPasswordAndRevokesSessions(t *testing.T) {
	service, userID := newTestAuth(t)
	response := login(t, service)
	if err := service.ChangePassword(userID, "wrong-password", "new-password-123"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("wrong old password error = %v", err)
	}
	if _, err := service.AuthenticateUser("alice.example", testPassword); err != nil {
		t.Fatal("password changed despite wrong old password")
	}
	if err := service.ChangePassword(userID, testPassword, "new-password-123"); err != nil {
		t.Fatal(err)
	}
	if _, err := service.VerifyAccessToken(response.AccessToken); err == nil {
		t.Fatal("password change did not revoke session")
	}
	if _, err := service.AuthenticateUser("alice.example", "new-password-123"); err != nil {
		t.Fatal(err)
	}
}

func TestTokenUsesCannotBeExchanged(t *testing.T) {
	service, _ := newTestAuth(t)
	response := login(t, service)
	if _, err := service.VerifyAccessToken(response.RefreshToken); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("refresh accepted as access: %v", err)
	}
	if _, err := service.Refresh(&RefreshRequest{RefreshToken: response.AccessToken}); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("access accepted as refresh: %v", err)
	}
}
