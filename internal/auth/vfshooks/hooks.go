package vfshooks

import (
	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/pkg/vfs"
	"github.com/akyaiy/veido/pkg/vfs/hooks"
	"github.com/akyaiy/veido/pkg/vfs/providersdk"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
)

const (
	HookRegister       = "auth.register"
	HookLogin          = "auth.login"
	HookRefresh        = "auth.refresh"
	HookLogout         = "auth.logout"
	HookChangePassword = "auth.change-password"
	HookRevokeSessions = "auth.revoke-sessions"
)

type registerInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
type loginInput = registerInput
type changePasswordInput struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}
type emptyInput struct{}

type sessionOutput struct {
	UserID      int64  `json:"user_id"`
	Username    string `json:"username,omitempty"`
	AccessToken string `json:"access_token"`
	UserStatus  string `json:"user_status,omitempty"`
	ScopeKey    string `json:"scope_key,omitempty"`
}
type okOutput struct {
	OK bool `json:"ok"`
}

type Handlers struct {
	auth     *auth.Auth
	frontend vfs.Frontend
}

func Register(registry *hooks.Registry, service *auth.Auth, frontend vfs.Frontend) error {
	if registry == nil || service == nil || frontend == nil {
		return hooks.ErrInvalidDefinition
	}
	h := &Handlers{auth: service, frontend: frontend}
	definitions := []hooks.Definition{
		definition[registerInput, sessionOutput](HookRegister, h.register),
		definition[loginInput, sessionOutput](HookLogin, h.login),
		definition[emptyInput, sessionOutput](HookRefresh, h.refresh),
		definition[emptyInput, okOutput](HookLogout, h.logout),
		definition[changePasswordInput, okOutput](HookChangePassword, h.changePassword),
		definition[emptyInput, okOutput](HookRevokeSessions, h.revokeSessions),
	}
	for _, item := range definitions {
		if err := registry.Register(item); err != nil {
			return err
		}
	}
	return nil
}

func definition[In, Out any](key string, handler func(context.Context, hooks.Execution, In) (Out, error)) hooks.Definition {
	return hooks.Definition{
		Key: key, Version: 1, Engine: hooks.NativeEngineKey,
		Script: hooks.NativeHandler(func(ctx context.Context, execution hooks.Execution) (json.RawMessage, error) {
			input, err := decode[In](execution.Input)
			if err != nil {
				return nil, vfs.NewError(vfs.KindInvalidArgument, vfs.OpControl, "invalid auth hook input", err)
			}
			output, err := handler(ctx, execution, input)
			if err != nil {
				return nil, classify(err)
			}
			return json.Marshal(output)
		}),
		InputSchema: providersdk.Schema[In](), OutputSchema: providersdk.Schema[Out](),
		ValidateInput:  func(raw json.RawMessage) error { _, err := decode[In](raw); return err },
		ValidateOutput: func(raw json.RawMessage) error { _, err := decode[Out](raw); return err },
		Enabled:        true, Active: true,
	}
}

func (h *Handlers) register(ctx context.Context, execution hooks.Execution, input registerInput) (sessionOutput, error) {
	if err := requireGuest(execution.Actor); err != nil {
		log.Printf("err1")
		return sessionOutput{}, err
	}
	user, err := h.auth.CreateUser(&auth.User{Name: input.Username, Password: input.Password, Status: auth.StatusActive})
	if err != nil {
		log.Printf("err2")
		return sessionOutput{}, err
	}
	scopeKey, err := h.createPersonalScope(ctx, int64(user))
	if err != nil {
		log.Printf("err3")
		cleanupErr := h.auth.DeleteNewUser(int64(user))
		if cleanupErr != nil {
			log.Printf("err4")
			return sessionOutput{}, vfs.NewError(vfs.KindInternal, vfs.OpControl, "registration provisioning rollback failed", errors.Join(err, cleanupErr))
		}
		return sessionOutput{}, vfs.NewError(vfs.KindFailedPrecondition, vfs.OpControl, "registration could not provision personal scope", err)
	}
	result, err := h.auth.Login(&auth.LoginRequest{Username: input.Username, Password: input.Password})
	if err != nil {
		log.Printf("err5")
		return sessionOutput{}, err
	}
	setRefreshCredential(ctx, result.RefreshToken)
	return sessionOutput{UserID: result.UserID, Username: result.Username, AccessToken: result.AccessToken, UserStatus: result.UserStatus, ScopeKey: scopeKey}, nil
}

func (h *Handlers) createPersonalScope(ctx context.Context, userID int64) (string, error) {
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: strconv.FormatInt(userID, 10)}
	uri, err := (vfs.ResourceAddress{ProviderKey: "scopes", ConnectionKey: "scopes", ScopeKey: "system", Path: "/scopes/workspace"}).URI()
	if err != nil {
		return "", err
	}
	node, err := h.frontend.Mkdir(ctx, actor, uri)
	if err != nil {
		return "", err
	}
	defaultURI, err := (vfs.ResourceAddress{ProviderKey: "scopes", ConnectionKey: "scopes", ScopeKey: "system", Path: "/me/default_scope.json"}).URI()
	if err != nil {
		return "", err
	}
	file, err := h.frontend.OpenFile(ctx, actor, defaultURI, os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		return "", err
	}
	if _, err := file.Write([]byte(`{"scope_key":"` + node.Name + `"}`)); err != nil {
		_ = file.Close()
		return "", err
	}
	if err := vfs.FinishWrite(file, nil); err != nil {
		return "", err
	}
	return node.Name, nil
}

func (h *Handlers) login(ctx context.Context, execution hooks.Execution, input loginInput) (sessionOutput, error) {
	if err := requireGuest(execution.Actor); err != nil {
		return sessionOutput{}, err
	}
	result, err := h.auth.Login(&auth.LoginRequest{Username: input.Username, Password: input.Password})
	if err != nil {
		return sessionOutput{}, err
	}
	setRefreshCredential(ctx, result.RefreshToken)
	return sessionOutput{UserID: result.UserID, Username: result.Username, AccessToken: result.AccessToken, UserStatus: result.UserStatus}, nil
}

func (h *Handlers) refresh(ctx context.Context, execution hooks.Execution, _ emptyInput) (sessionOutput, error) {
	if execution.Actor.Kind != vfs.ActorGuest && execution.Actor.Kind != vfs.ActorUser {
		return sessionOutput{}, vfs.ErrPermissionDenied
	}
	token, ok := refreshCredential(ctx)
	if !ok {
		return sessionOutput{}, vfs.NewError(vfs.KindInvalidArgument, vfs.OpControl, "refresh credential is required", auth.ErrNoTokenFound)
	}
	result, err := h.auth.Refresh(&auth.RefreshRequest{RefreshToken: token})
	if err != nil {
		clearRefreshCredential(ctx)
		return sessionOutput{}, err
	}
	setRefreshCredential(ctx, result.RefreshToken)
	return sessionOutput{AccessToken: result.AccessToken}, nil
}

func (h *Handlers) logout(ctx context.Context, execution hooks.Execution, _ emptyInput) (okOutput, error) {
	if err := requireUser(execution.Actor); err != nil {
		return okOutput{}, err
	}
	if err := h.auth.Logout(ctx); err != nil {
		return okOutput{}, err
	}
	clearRefreshCredential(ctx)
	return okOutput{OK: true}, nil
}

func (h *Handlers) changePassword(ctx context.Context, execution hooks.Execution, input changePasswordInput) (okOutput, error) {
	userID, err := userID(execution.Actor)
	if err != nil {
		return okOutput{}, err
	}
	if err := h.auth.ChangePassword(userID, input.OldPassword, input.NewPassword); err != nil {
		return okOutput{}, err
	}
	clearRefreshCredential(ctx)
	return okOutput{OK: true}, nil
}

func (h *Handlers) revokeSessions(ctx context.Context, execution hooks.Execution, _ emptyInput) (okOutput, error) {
	userID, err := userID(execution.Actor)
	if err != nil {
		return okOutput{}, err
	}
	if err := h.auth.RevokeAllTokens(userID); err != nil {
		return okOutput{}, err
	}
	clearRefreshCredential(ctx)
	return okOutput{OK: true}, nil
}

func requireGuest(actor vfs.Actor) error {
	if actor.Kind != vfs.ActorGuest || actor.ID == "" {
		return vfs.ErrPermissionDenied
	}
	return nil
}
func requireUser(actor vfs.Actor) error {
	_, err := userID(actor)
	return err
}
func userID(actor vfs.Actor) (int64, error) {
	if actor.Kind != vfs.ActorUser || actor.ID == "" {
		return 0, vfs.ErrPermissionDenied
	}
	id, err := strconv.ParseInt(actor.ID, 10, 64)
	if err != nil || id <= 0 {
		return 0, vfs.ErrPermissionDenied
	}
	return id, nil
}

func decode[T any](raw []byte) (T, error) {
	var value T
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return value, err
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return value, errors.New("expected one JSON value")
		}
		return value, err
	}
	return value, nil
}

func classify(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := vfs.KindOf(err); ok {
		return err
	}
	switch {
	case errors.Is(err, auth.ErrUserExists):
		return vfs.NewError(vfs.KindConflict, vfs.OpControl, "user already exists", err)
	case errors.Is(err, auth.ErrInvalidCredentials), errors.Is(err, auth.ErrPasswordMismatch), errors.Is(err, auth.ErrInvalidToken), errors.Is(err, auth.ErrNoTokenFound):
		return vfs.NewError(vfs.KindPermissionDenied, vfs.OpControl, "authentication failed", err)
	case errors.Is(err, auth.ErrUserNotFound):
		return vfs.NewError(vfs.KindNotFound, vfs.OpControl, "user not found", err)
	default:
		return vfs.NewError(vfs.KindInternal, vfs.OpControl, "authentication operation failed", fmt.Errorf("auth hook: %w", err))
	}
}
