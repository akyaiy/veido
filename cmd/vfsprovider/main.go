// vfsprovider creates an independently runnable provider development package.
package main

import (
	"bytes"
	"embed"
	"errors"
	"flag"
	"fmt"
	"go/format"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"text/template"
)

//go:embed templates/*.txt
var templates embed.FS

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, out io.Writer) error {
	if len(args) == 0 || args[0] != "new" {
		return errors.New("usage: vfsprovider new -dir PATH [-key example] [-kind virtual|filesystem]")
	}
	flags := flag.NewFlagSet("new", flag.ContinueOnError)
	flags.SetOutput(out)
	dir := flags.String("dir", "", "new directory (must not exist)")
	key := flags.String("key", "example", "provider key")
	kind := flags.String("kind", "virtual", "virtual or filesystem")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if *dir == "" || flags.NArg() != 0 {
		return errors.New("supply -dir for a new package")
	}
	if !regexp.MustCompile(`^[A-Za-z0-9_-]+$`).MatchString(*key) {
		return errors.New("key must contain letters, digits, underscores or hyphens")
	}
	if *kind != "virtual" && *kind != "filesystem" {
		return errors.New("kind must be virtual or filesystem")
	}
	data := struct {
		Key        string
		Filesystem bool
	}{strconv.Quote(*key), *kind == "filesystem"}
	files := map[string][]byte{}
	for name, source := range map[string]string{"main.go": "main", "provider.go": *kind, "provider_test.go": "test"} {
		raw, err := templates.ReadFile("templates/" + source + ".txt")
		if err != nil {
			return err
		}
		tmpl, err := template.New(source).Parse(string(raw))
		if err != nil {
			return err
		}
		var b bytes.Buffer
		if err := tmpl.Execute(&b, data); err != nil {
			return err
		}
		formatted, err := format.Source(b.Bytes())
		if err != nil {
			return fmt.Errorf("format %s: %w", name, err)
		}
		files[name] = formatted
	}
	// Never overwrite an existing package, including its uncommitted files.
	if err := os.Mkdir(*dir, 0755); err != nil {
		return err
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(*dir, name), content, 0644); err != nil {
			return err
		}
	}
	fmt.Fprintf(out, "Created %s provider in %s. Run go test and go run in that directory.\n", *kind, *dir)
	return nil
}
