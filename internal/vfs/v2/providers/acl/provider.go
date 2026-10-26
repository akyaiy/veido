package acl

import (
	aclv2 "MyServer/internal/acl/v2"
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	sdk "MyServer/pkg/vfs/providersdk"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"strconv"
	"strings"
	"time"
)

const ProviderKey = "acl"

func Definition(store *aclv2.Store, authorizer *aclv2.ACLAuthorizer) sdk.Definition[struct{}] {
	return sdk.Definition[struct{}]{Key: ProviderKey, Summary: "ACL policy and rule resources", Open: func(context.Context, vfs.ProviderConnection, struct{}) (vfs.FSProvider, error) {
		svc, err := NewRuleService(store, authorizer)
		if err != nil {
			return nil, err
		}
		return &Provider{service: svc}, nil
	}}
}

type Provider struct{ service *RuleService }

func PolicyRef(target common.ResourceRef) common.ResourceRef {
	uri, _ := (common.ResourceAddress{ProviderKey: target.ProviderKey, ConnectionKey: target.ConnectionKey, ScopeKey: target.ScopeKey, Path: target.Path}).URI()
	return common.ResourceRef{ProviderKey: ProviderKey, ConnectionKey: ProviderKey, ScopeKey: "system", Path: "/policies/" + base64.RawURLEncoding.EncodeToString([]byte(uri))}
}
func controlPlaneRef() common.ResourceRef {
	return common.ResourceRef{ProviderKey: ProviderKey, ConnectionKey: ProviderKey, ScopeKey: "system", Path: "/control-plane"}
}

func (p *Provider) Stat(ctx context.Context, raw string) (*vfs.Node, error) {
	if raw == "/" || raw == "/policies" || raw == "/rules" {
		return &vfs.Node{Name: path.Base(raw), IsDir: true, Kind: "directory", UpdatedAt: time.Now()}, nil
	}
	if _, ok := parsePolicy(raw); ok {
		return &vfs.Node{Name: path.Base(raw), Kind: "policy", IsDir: true, UpdatedAt: time.Now()}, nil
	}
	if id, ok := parseRule(raw); ok {
		if _, err := p.service.Get(ctx, actor(ctx), id); err != nil {
			return nil, err
		}
		return &vfs.Node{Name: strconv.FormatInt(id, 10), Kind: "rule", UpdatedAt: time.Now()}, nil
	}
	return nil, os.ErrNotExist
}
func (p *Provider) ReadDir(ctx context.Context, raw string) ([]*vfs.Node, error) {
	if target, ok := parsePolicy(raw); ok {
		rules, err := p.service.List(ctx, actor(ctx), target)
		if err != nil {
			return nil, err
		}
		out := make([]*vfs.Node, 0, len(rules))
		for _, rule := range rules {
			out = append(out, &vfs.Node{Name: strconv.FormatInt(rule.ID, 10), Kind: "rule", UpdatedAt: time.Now()})
		}
		return out, nil
	}
	return []*vfs.Node{}, nil
}
func (p *Provider) OpenFile(ctx context.Context, raw string, flags int) (vfs.File, error) {
	if flags&(os.O_WRONLY|os.O_RDWR|os.O_TRUNC|os.O_CREATE) != 0 {
		return nil, os.ErrPermission
	}
	id, ok := parseRule(raw)
	if !ok {
		return nil, os.ErrNotExist
	}
	rule, err := p.service.Get(ctx, actor(ctx), id)
	if err != nil {
		return nil, err
	}
	data, _ := json.Marshal(rule)
	return newFile(path.Base(raw), data), nil
}
func (p *Provider) Mkdir(context.Context, string, string) (*vfs.Node, error) {
	return nil, os.ErrPermission
}
func (p *Provider) Move(context.Context, string, string, string) error { return os.ErrPermission }
func (p *Provider) Delete(context.Context, string) error               { return os.ErrPermission }
func (p *Provider) Control(ctx context.Context, raw, command string, data []byte) ([]byte, error) {
	a := actor(ctx)
	if target, ok := parsePolicy(raw); ok && command == "create" {
		var input aclv2.RuleInput
		if err := json.Unmarshal(data, &input); err != nil {
			return nil, err
		}
		r, err := p.service.Create(ctx, a, target, input)
		if err != nil {
			return nil, err
		}
		return json.Marshal(r)
	}
	if id, ok := parseRule(raw); ok {
		switch command {
		case "update":
			var input aclv2.UpdateRuleInput
			if err := json.Unmarshal(data, &input); err != nil {
				return nil, err
			}
			r, err := p.service.Update(ctx, a, id, input)
			if err != nil {
				return nil, err
			}
			return json.Marshal(r)
		case "delete":
			return nil, p.service.Delete(ctx, a, id)
		case "set-manager":
			var in struct {
				Manager string `json:"manager_subject_key"`
				Mode    string `json:"manager_mode"`
				State   string `json:"state"`
			}
			if err := json.Unmarshal(data, &in); err != nil {
				return nil, err
			}
			r, err := p.service.SetManager(ctx, a, id, in.Manager, in.Mode, in.State)
			if err != nil {
				return nil, err
			}
			return json.Marshal(r)
		}
	}
	return nil, vfs.ErrUnsupported
}
func actor(ctx context.Context) vfs.Actor {
	r, ok := vfs.RequestContextFromContext(ctx)
	if !ok {
		return vfs.Actor{}
	}
	return r.ActorKey
}
func parsePolicy(raw string) (common.ResourceRef, bool) {
	parts := strings.Split(strings.TrimPrefix(raw, "/"), "/")
	if len(parts) != 2 || parts[0] != "policies" {
		return common.ResourceRef{}, false
	}
	b, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return common.ResourceRef{}, false
	}
	u, err := common.CastURI(string(b))
	if err != nil {
		return common.ResourceRef{}, false
	}
	r := common.ParseResourceRef(u)
	if r == nil {
		return common.ResourceRef{}, false
	}
	a := r.Payload()
	return common.ResourceRef{ProviderKey: a.ProviderKey, ConnectionKey: a.ConnectionKey, ScopeKey: a.ScopeKey, Path: a.Path}, true
}
func parseRule(raw string) (int64, bool) {
	parts := strings.Split(strings.TrimPrefix(raw, "/"), "/")
	if len(parts) != 2 || parts[0] != "rules" {
		return 0, false
	}
	id, err := strconv.ParseInt(parts[1], 10, 64)
	return id, err == nil && id > 0
}

type readFile struct {
	*bytes.Reader
	name string
}

func newFile(name string, data []byte) vfs.File {
	return &readFile{Reader: bytes.NewReader(data), name: name}
}
func (f *readFile) Write([]byte) (int, error)  { return 0, os.ErrPermission }
func (f *readFile) Close() error               { return nil }
func (f *readFile) Stat() (os.FileInfo, error) { return fileInfo{f.name, int64(f.Size())}, nil }

type fileInfo struct {
	name string
	size int64
}

func (i fileInfo) Name() string       { return i.name }
func (i fileInfo) Size() int64        { return i.size }
func (i fileInfo) Mode() os.FileMode  { return 0444 }
func (i fileInfo) ModTime() time.Time { return time.Now() }
func (i fileInfo) IsDir() bool        { return false }
func (i fileInfo) Sys() any           { return nil }

var _ io.Reader = (*readFile)(nil)
var _ = fmt.Sprintf
