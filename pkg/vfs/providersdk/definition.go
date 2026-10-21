package providersdk

import (
	"MyServer/pkg/vfs"
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"time"
)

// Definition decodes and validates each connection's configuration before
// opening its provider. Dependencies are captured explicitly by Open/Check.
// Do not capture the factory request context in a long-lived backend client.
type Definition[C any] struct {
	Key                string
	Summary            string
	Defaults           func() C
	Validate           func(context.Context, C) error
	Open               func(context.Context, vfs.ProviderConnection, C) (vfs.FSProvider, error)
	Check              func(context.Context, C) error
	AllowUnknownFields bool
}

type ProviderInfo struct {
	Key          string `json:"key"`
	Summary      string `json:"summary,omitempty"`
	ConfigSchema any    `json:"config_schema"`
	CanCheck     bool   `json:"can_check"`
}

func (d Definition[C]) Info() ProviderInfo {
	return ProviderInfo{d.Key, d.Summary, Schema[C](), d.Check != nil}
}

func (d Definition[C]) Config(ctx context.Context, data []byte) (C, error) {
	var value C
	if d.Defaults != nil {
		value = d.Defaults()
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		data = []byte("{}")
	}
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	if !d.AllowUnknownFields {
		decoder.DisallowUnknownFields()
	}
	if !json.Valid(data) {
		return value, fmt.Errorf("%w: invalid provider config", vfs.ErrInvalidArgument)
	}
	if err := decoder.Decode(&value); err != nil {
		return value, fmt.Errorf("%w: config: %v", vfs.ErrInvalidArgument, err)
	}
	if err := ctx.Err(); err != nil {
		return value, err
	}
	if d.Validate != nil {
		if err := d.Validate(ctx, value); err != nil {
			return value, err
		}
	}
	return value, nil
}

func (d Definition[C]) Factory() vfs.ProviderFactory {
	return func(ctx context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, error) {
		provider, _, err := d.open(ctx, connection)
		return provider, err
	}
}

func (d Definition[C]) open(ctx context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, C, error) {
	var zero C
	if !validName(d.Key) || d.Open == nil {
		return nil, zero, fmt.Errorf("%w: invalid provider definition", vfs.ErrInvalidArgument)
	}
	if connection.ProviderKey != d.Key {
		return nil, zero, fmt.Errorf("%w: provider key mismatch", vfs.ErrInvalidArgument)
	}
	if _, err := (vfs.ResourceAddress{ProviderKey: d.Key, ConnectionKey: "default", ScopeKey: "dev", Path: "/"}).URI(); err != nil {
		return nil, zero, err
	}
	cfg, err := d.Config(ctx, connection.Config)
	if err != nil {
		return nil, zero, err
	}
	provider, err := d.Open(ctx, connection, cfg)
	if err == nil && provider == nil {
		return nil, zero, fmt.Errorf("%w: nil provider", vfs.ErrInternal)
	}
	return provider, cfg, err
}

func (d Definition[C]) CheckConfig(ctx context.Context, data []byte) error {
	cfg, err := d.Config(ctx, data)
	if err != nil {
		return err
	}
	if d.Check == nil {
		return vfs.ErrUnsupported
	}
	return d.Check(ctx, cfg)
}

// Schema describes ordinary JSON structs, collections and scalar values.
// Custom marshalers, interfaces and recursive edges deliberately use an open
// schema. Domain validation remains the Validate callback's responsibility.
func Schema[T any]() any { return schema(reflect.TypeFor[T](), map[reflect.Type]bool{}) }
func schema(t reflect.Type, seen map[reflect.Type]bool) any {
	if t == nil || seen[t] {
		return map[string]any{}
	}
	if t == reflect.TypeFor[time.Time]() {
		return map[string]any{"type": "string", "format": "date-time"}
	}
	if t == reflect.TypeFor[json.RawMessage]() {
		return map[string]any{}
	}
	if t.Implements(reflect.TypeFor[json.Marshaler]()) || reflect.PointerTo(t).Implements(reflect.TypeFor[json.Marshaler]()) {
		return map[string]any{}
	}
	if t.Kind() == reflect.Pointer {
		return map[string]any{"anyOf": []any{schema(t.Elem(), seen), map[string]any{"type": "null"}}}
	}
	seen[t] = true
	defer delete(seen, t)
	switch t.Kind() {
	case reflect.Struct:
		props := map[string]any{}
		required := []string{}
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			if !f.IsExported() {
				continue
			}
			tag := strings.Split(f.Tag.Get("json"), ",")
			if tag[0] == "-" {
				continue
			}
			if f.Anonymous && tag[0] == "" {
				return map[string]any{}
			}
			name := tag[0]
			if name == "" {
				name = f.Name
			}
			props[name] = schema(f.Type, seen)
			if f.Tag.Get("secret") == "true" {
				props[name].(map[string]any)["writeOnly"] = true
			}
			if description := f.Tag.Get("description"); description != "" {
				props[name].(map[string]any)["description"] = description
			}
			if f.Tag.Get("required") == "true" {
				required = append(required, name)
			}
		}
		out := map[string]any{"type": "object", "properties": props}
		if len(required) > 0 {
			out["required"] = required
		}
		return out
	case reflect.String:
		return map[string]any{"type": "string"}
	case reflect.Bool:
		return map[string]any{"type": "boolean"}
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return map[string]any{"type": "integer"}
	case reflect.Float32, reflect.Float64:
		return map[string]any{"type": "number"}
	case reflect.Slice, reflect.Array:
		if t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Uint8 {
			return map[string]any{"type": "string", "contentEncoding": "base64"}
		}
		return map[string]any{"type": "array", "items": schema(t.Elem(), seen)}
	case reflect.Map:
		return map[string]any{"type": "object", "additionalProperties": schema(t.Elem(), seen)}
	default:
		return map[string]any{}
	}
}
