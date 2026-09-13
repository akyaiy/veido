package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// Build generated packages as external modules: consumers must not need any
// imports from MyServer/internal, even though the implementation uses them.
func TestGeneratedProvidersBuildOutsideModule(t *testing.T) {
	repo, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"virtual", "filesystem"} {
		t.Run(kind, func(t *testing.T) {
			dir := filepath.Join(t.TempDir(), "provider")
			var output bytes.Buffer
			if err := run([]string{"new", "-dir", dir, "-key", "example", "-kind", kind}, &output); err != nil {
				t.Fatal(err)
			}
			module := "module example.org/provider\n\ngo 1.24.3\n\nrequire MyServer v0.0.0\nreplace MyServer => " + strconv.Quote(repo) + "\n"
			if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(module), 0600); err != nil {
				t.Fatal(err)
			}
			// Reuse this repository's verified dependency checksums, so this
			// external-consumer compile test does not need a checksum service.
			sums, err := os.ReadFile(filepath.Join(repo, "go.sum"))
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "go.sum"), sums, 0600); err != nil {
				t.Fatal(err)
			}
			cmd := exec.Command("go", "test", "-mod=mod", "./...")
			cmd.Dir = dir
			cmd.Env = append(os.Environ(), "GOWORK=off", "GOPROXY=off")
			if out, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("generated %s provider: %v\n%s", kind, err, out)
			}
			original, err := os.ReadFile(filepath.Join(dir, "provider.go"))
			if err != nil {
				t.Fatal(err)
			}
			if err := run([]string{"new", "-dir", dir}, &output); err == nil {
				t.Fatal("overwrote an existing package")
			}
			after, _ := os.ReadFile(filepath.Join(dir, "provider.go"))
			if !bytes.Equal(original, after) {
				t.Fatal("existing source changed")
			}
			if strings.Contains(string(original), "/internal/") {
				t.Fatal("generated provider imports private contracts")
			}
		})
	}
}
