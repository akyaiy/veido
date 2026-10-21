package providersdk

import (
	"MyServer/internal/vfs/v2/virtfs"
	"MyServer/pkg/vfs"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
)

type DocumentSpec[T, V any] struct {
	Read               func(context.Context, Request, T) (V, error)
	Replace            func(context.Context, Request, T, V) error
	Validate           func(context.Context, V) error
	MaxBytes           int64
	AllowUnknownFields bool
}

func JSON[T, V any](parent *Resource[T], name string, read func(context.Context, Request, T) (V, error)) *Resource[T] {
	return Document(parent, name, DocumentSpec[T, V]{Read: read})
}

func Document[T, V any](parent *Resource[T], name string, spec DocumentSpec[T, V]) *Resource[T] {
	var replace func(context.Context, Request, T, []byte) error
	if spec.Read == nil {
		parent.tree.err = errors.Join(parent.tree.err, fmt.Errorf("%s requires Read", name))
	}
	if spec.Replace != nil {
		replace = func(ctx context.Context, req Request, entity T, data []byte) error {
			value, err := decode[V](data, !spec.AllowUnknownFields)
			if err != nil {
				return err
			}
			if spec.Validate != nil {
				if err := spec.Validate(ctx, value); err != nil {
					return err
				}
			}
			return spec.Replace(ctx, req, entity, value)
		}
	}
	r := bytesDocument(parent, name, func(ctx context.Context, req Request, entity T) ([]byte, error) {
		value, err := spec.Read(ctx, req, entity)
		if err != nil {
			return nil, err
		}
		return encode(value)
	}, replace, spec.MaxBytes)
	r.entry.info.Kind = "document"
	r.entry.info.Schema = Schema[V]()
	return r
}

func decode[T any](data []byte, strict bool) (T, error) {
	var value T
	d := json.NewDecoder(bytes.NewReader(data))
	if strict {
		d.DisallowUnknownFields()
	}
	if err := d.Decode(&value); err != nil {
		return value, vfs.NewError(vfs.KindInvalidArgument, vfs.OpWrite, "invalid JSON", errors.Join(os.ErrInvalid, err))
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		return value, vfs.NewError(vfs.KindInvalidArgument, vfs.OpWrite, "expected one JSON value", os.ErrInvalid)
	}
	return value, nil
}
func encode(value any) ([]byte, error) {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

type CommandSpec[T, In, Out any] struct {
	Handle             func(context.Context, Request, T, In) (Out, error)
	Validate           func(context.Context, In) error
	MaxBytes           int64
	AllowUnknownFields bool
}

// Command uses Control and consequently the core's execute permission. It is
// not exposed as a writable file and does not silently change write ACL rules.
func Command[T, In, Out any](target *Resource[T], name string, spec CommandSpec[T, In, Out]) {
	if !target.tree.mutable() {
		return
	}
	if !validName(name) || spec.Handle == nil {
		target.tree.err = errors.Join(target.tree.err, fmt.Errorf("invalid command %q", name))
		return
	}
	e := target.entry
	if e.commands == nil {
		e.commands = map[string]func(context.Context, Request, []byte) ([]byte, error){}
	}
	if _, ok := e.commands[name]; ok {
		target.tree.err = errors.Join(target.tree.err, fmt.Errorf("duplicate command %q", name))
		return
	}
	limit := spec.MaxBytes
	if limit <= 0 {
		limit = DefaultMaxDocumentBytes
	}
	e.commands[name] = func(ctx context.Context, req Request, data []byte) ([]byte, error) {
		if int64(len(data)) > limit {
			return nil, vfs.ErrResourceExhausted
		}
		if len(bytes.TrimSpace(data)) == 0 {
			data = []byte("{}")
		}
		input, err := decode[In](data, !spec.AllowUnknownFields)
		if err != nil {
			return nil, err
		}
		if spec.Validate != nil {
			if err := spec.Validate(ctx, input); err != nil {
				return nil, err
			}
		}
		value, err := target.load(ctx, req)
		if err != nil {
			return nil, err
		}
		out, err := spec.Handle(ctx, req, value, input)
		if err != nil {
			return nil, err
		}
		return encode(out)
	}
	e.info.Commands = append(e.info.Commands, CommandInfo{Name: name, Input: Schema[In](), Output: Schema[Out]()})
	e.handler.Control = func(ctx context.Context, req virtfs.Request, command string, input []byte) ([]byte, error) {
		if _, err := target.load(ctx, request(req)); err != nil {
			return nil, err
		}
		h, ok := e.commands[command]
		if !ok {
			return nil, vfs.ErrUnsupported
		}
		return h(ctx, request(req), input)
	}
}
