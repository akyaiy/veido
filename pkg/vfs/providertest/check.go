package providertest

import (
	"github.com/akyaiy/veido/pkg/vfs"
	"context"
	"io"
	"os"
	"path"
	"strings"
	"testing"
)

type CheckOptions struct {
	Root         string
	Expected     []string
	MaxNodes     int
	MaxFileBytes int64
}

// CheckTree checks a bounded, stable fixture through the real VFS core. It
// does not mutate resources. Expected paths may include hidden resources.
func CheckTree(t testing.TB, ctx context.Context, h *Harness, options CheckOptions) {
	t.Helper()
	if options.Root == "" {
		options.Root = "/"
	}
	if options.MaxNodes <= 0 {
		options.MaxNodes = 1000
	}
	if options.MaxFileBytes <= 0 {
		options.MaxFileBytes = 1 << 20
	}
	seen := map[string]bool{}
	var visit func(string, *vfs.Node)
	visit = func(p string, listed *vfs.Node) {
		t.Helper()
		if seen[p] {
			return
		}
		seen[p] = true
		if len(seen) > options.MaxNodes {
			t.Fatalf("provider fixture exceeds %d nodes", options.MaxNodes)
		}
		node, err := h.Frontend.Stat(ctx, h.Actor, h.URI(p))
		if err != nil {
			t.Fatalf("Stat(%s): %v", p, err)
		}
		if node == nil {
			t.Fatalf("Stat(%s) returned nil metadata", p)
		}
		if listed != nil && (listed.Name != node.Name || listed.IsDir != node.IsDir || listed.Kind != node.Kind || (!node.IsDir && listed.Size != node.Size)) {
			t.Fatalf("ReadDir/Stat disagree for %s: %+v vs %+v", p, listed, node)
		}
		if node.IsDir {
			children, err := h.Frontend.ReadDir(ctx, h.Actor, h.URI(p))
			if err != nil {
				t.Fatalf("ReadDir(%s): %v", p, err)
			}
			names := map[string]bool{}
			for _, child := range children {
				if child == nil || child.Name == "" || child.Name == "." || child.Name == ".." || strings.ContainsAny(child.Name, "/\\\x00") {
					t.Fatalf("invalid child in %s: %+v", p, child)
				}
				if names[child.Name] {
					t.Fatalf("duplicate child %s/%s", p, child.Name)
				}
				names[child.Name] = true
				visit(path.Join(p, child.Name), child)
			}
			return
		}
		file, err := h.Frontend.OpenFile(ctx, h.Actor, h.URI(p), os.O_RDONLY)
		if err != nil {
			t.Fatalf("OpenFile(%s): %v", p, err)
		}
		info, statErr := file.Stat()
		data, readErr := io.ReadAll(io.LimitReader(file, options.MaxFileBytes+1))
		closeErr := file.Close()
		if statErr != nil || readErr != nil || closeErr != nil {
			t.Fatalf("read %s: stat=%v read=%v close=%v", p, statErr, readErr, closeErr)
		}
		if int64(len(data)) > options.MaxFileBytes {
			t.Fatalf("fixture %s exceeds file limit", p)
		}
		if info == nil || info.IsDir() || info.Name() != node.Name || info.Size() != int64(len(data)) || node.Size != info.Size() {
			t.Fatalf("inconsistent file snapshot for %s", p)
		}
	}
	visit(options.Root, nil)
	for _, expected := range options.Expected {
		visit(expected, nil)
	}
}
