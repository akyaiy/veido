package providersdk

import (
	"github.com/akyaiy/veido/internal/vfs/v2/virtfs"
	"github.com/akyaiy/veido/pkg/vfs"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path"
	"time"
)

const DefaultMaxDocumentBytes int64 = 1 << 20

// ReadFile wraps a stream without buffering it. Seeking is exposed only when
// the underlying stream implements io.Seeker. Metadata belongs to this open
// snapshot, rather than a later request to the backend.
func ReadFile(ctx context.Context, node *vfs.Node, stream io.ReadCloser) vfs.File {
	return &readFile{ctx: ctx, info: nodeInfo{*node}, stream: stream}
}

type readFile struct {
	ctx    context.Context
	info   nodeInfo
	stream io.ReadCloser
	closed bool
}

func (f *readFile) Read(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	if err := f.ctx.Err(); err != nil {
		return 0, err
	}
	return f.stream.Read(p)
}
func (f *readFile) Write([]byte) (int, error) { return 0, os.ErrPermission }
func (f *readFile) Seek(off int64, whence int) (int64, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	if err := f.ctx.Err(); err != nil {
		return 0, err
	}
	if s, ok := f.stream.(io.Seeker); ok {
		return s.Seek(off, whence)
	}
	return 0, vfs.ErrUnsupported
}
func (f *readFile) Close() error {
	if f.closed {
		return nil
	}
	f.closed = true
	return f.stream.Close()
}
func (f *readFile) Stat() (os.FileInfo, error) {
	if f.closed {
		return nil, os.ErrClosed
	}
	return f.info, nil
}

type nodeInfo struct{ node vfs.Node }

func (i nodeInfo) Name() string { return i.node.Name }
func (i nodeInfo) Size() int64  { return i.node.Size }
func (i nodeInfo) Mode() os.FileMode {
	if i.node.IsDir {
		return os.ModeDir | 0755
	}
	return 0644
}
func (i nodeInfo) ModTime() time.Time { return i.node.UpdatedAt }
func (i nodeInfo) IsDir() bool        { return i.node.IsDir }
func (i nodeInfo) Sys() any           { return nil }

// WriteFile wraps a sequential staged upload. commit and abort own finalizing
// and releasing the writer. A failed Write poisons the session; Close cannot
// accidentally publish a partial upload. Close is an alias for Commit.
func WriteFile(ctx context.Context, node *vfs.Node, writer io.Writer, commit, abort func() error) vfs.WriteFile {
	return &writeFile{ctx: ctx, node: *node, writer: writer, commit: commit, abort: abort}
}

type writeFile struct {
	ctx           context.Context
	node          vfs.Node
	writer        io.Writer
	commit, abort func() error
	closed        bool
	err           error
	maxBytes      int64
}

func (f *writeFile) Read([]byte) (int, error) { return 0, os.ErrPermission }
func (f *writeFile) Write(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	if f.err != nil {
		return 0, f.err
	}
	if f.err = f.ctx.Err(); f.err != nil {
		return 0, f.err
	}
	if f.maxBytes > 0 && int64(len(p)) > f.maxBytes-f.node.Size {
		f.err = vfs.ErrResourceExhausted
		return 0, f.err
	}
	n, err := f.writer.Write(p)
	f.node.Size += int64(n)
	if err == nil && n != len(p) {
		err = io.ErrShortWrite
	}
	f.err = err
	return n, err
}
func (f *writeFile) Seek(off int64, whence int) (int64, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	if off == 0 && (whence == io.SeekCurrent || whence == io.SeekEnd) {
		return f.node.Size, nil
	}
	return 0, vfs.ErrUnsupported
}
func (f *writeFile) Stat() (os.FileInfo, error) { return nodeInfo{f.node}, nil }
func (f *writeFile) Close() error               { return f.Commit() }
func (f *writeFile) Commit() error {
	if f.closed {
		return f.err
	}
	f.closed = true
	if f.err == nil {
		f.err = f.ctx.Err()
	}
	if f.err == nil && f.commit != nil {
		f.err = f.commit()
	}
	if f.err != nil && f.abort != nil {
		f.err = errors.Join(f.err, f.abort())
	}
	return f.err
}
func (f *writeFile) Abort() error {
	if f.closed {
		return nil
	}
	f.closed = true
	if f.abort != nil {
		return f.abort()
	}
	return nil
}

func BufferedFile(ctx context.Context, name string, maxBytes int64, save func([]byte) error) vfs.WriteFile {
	if maxBytes <= 0 {
		maxBytes = DefaultMaxDocumentBytes
	}
	buffer := new(bytes.Buffer)
	f := WriteFile(ctx, FileNode(name, 0), buffer, func() error { defer buffer.Reset(); return save(buffer.Bytes()) }, func() error { buffer.Reset(); return nil }).(*writeFile)
	f.maxBytes = maxBytes
	return f
}

type FileSpec[T any] struct {
	Metadata func(context.Context, Request, T) (*vfs.Node, error)
	Open     func(context.Context, Request, T, int) (vfs.File, error)
}

// File is the escape hatch for custom file semantics, including streaming
// blobs. Ordinary filesystem providers should use FromBackend or Compose.
func File[T any](parent *Resource[T], name string, spec FileSpec[T]) *Resource[T] {
	r := add(parent, name, parent.load, false)
	r.entry.info.Kind = "file"
	if spec.Metadata == nil || spec.Open == nil {
		r.tree.err = errors.Join(r.tree.err, errors.New("File requires Metadata and Open"))
		return r
	}
	r.Metadata(spec.Metadata)
	r.entry.handler.OpenFile = func(ctx context.Context, req virtfs.Request, flags int) (vfs.File, error) {
		value, err := r.load(ctx, request(req))
		if err != nil {
			return nil, err
		}
		return spec.Open(ctx, request(req), value, flags)
	}
	return r
}

func Bytes[T any](parent *Resource[T], name string, read func(context.Context, Request, T) ([]byte, error)) *Resource[T] {
	return bytesDocument(parent, name, read, nil, 0)
}

// BytesDocument supports codecs other than JSON, with the same bounded,
// cancelable replacement protocol as Document.
func BytesDocument[T any](parent *Resource[T], name string, read func(context.Context, Request, T) ([]byte, error), replace func(context.Context, Request, T, []byte) error, maxBytes int64) *Resource[T] {
	return bytesDocument(parent, name, read, replace, maxBytes)
}

func bytesDocument[T any](parent *Resource[T], name string, read func(context.Context, Request, T) ([]byte, error), replace func(context.Context, Request, T, []byte) error, maxBytes int64) *Resource[T] {
	if read == nil {
		parent.tree.err = errors.Join(parent.tree.err, errors.New("document requires a reader"))
	}
	return File(parent, name, FileSpec[T]{
		Metadata: func(ctx context.Context, req Request, value T) (*vfs.Node, error) {
			data, err := read(ctx, req, value)
			if err != nil {
				return nil, err
			}
			return FileNode(path.Base(req.Path), int64(len(data))), nil
		},
		Open: func(ctx context.Context, req Request, value T, flags int) (vfs.File, error) {
			if flags&os.O_CREATE != 0 && flags&os.O_EXCL != 0 {
				return nil, os.ErrExist
			}
			if !wantsWrite(flags) {
				data, err := read(ctx, req, value)
				if err != nil {
					return nil, err
				}
				return ReadFile(ctx, FileNode(path.Base(req.Path), int64(len(data))), &byteStream{Reader: bytes.NewReader(data)}), nil
			}
			if replace == nil {
				return nil, os.ErrPermission
			}
			if flags&os.O_APPEND != 0 || flags&(os.O_WRONLY|os.O_RDWR) == 0 || flags&os.O_TRUNC == 0 {
				return nil, vfs.ErrUnsupported
			}
			return BufferedFile(ctx, path.Base(req.Path), maxBytes, func(data []byte) error { return replace(ctx, req, value, data) }), nil
		},
	})
}

type byteStream struct{ *bytes.Reader }

func (*byteStream) Close() error { return nil }
func wantsWrite(flags int) bool {
	return flags&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_TRUNC|os.O_CREATE) != 0
}
