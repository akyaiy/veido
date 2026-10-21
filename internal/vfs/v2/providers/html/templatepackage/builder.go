// Package templatepackage builds explicit application-template install inputs
// outside the HTML Provider runtime. The resulting package is still installed
// through actor-bound VFS Control; this helper never receives a Store.
package templatepackage

import (
	html "MyServer/internal/vfs/v2/providers/html"
	"fmt"
	"io"
	"os"
	"path"
	"strings"
)

const (
	maxSourceFiles = 256
	maxSourceFile  = 4 << 20
	maxSourceTotal = 16 << 20
)

type Replacement struct {
	Old string
	New string
}

type File struct {
	SourcePath  string
	TargetPath  string
	ContentType string
	Replace     []Replacement
}

type Spec struct {
	TemplateKey string
	Version     string
	Entrypoint  string
	Files       []File
}

// DefaultSPA returns the reviewed allowlist for data/HTML/frontend. Files not
// named here—including generators, archives, swap files and SVG copies—cannot
// enter the installed package.
func DefaultSPA(version string) Spec {
	const key = "default-spa"
	return Spec{
		TemplateKey: key,
		Version:     version,
		Entrypoint:  "index.html",
		Files: []File{
			{SourcePath: "index.html", TargetPath: "index.html"},
			{SourcePath: "css/style.css", TargetPath: "css/style.css"},
			{SourcePath: "css/admin.css", TargetPath: "css/admin.css"},
			{SourcePath: "css/page.css", TargetPath: "css/page.css"},
			{SourcePath: "js/app.js", TargetPath: "js/app.js"},
			{SourcePath: "js/admin.js", TargetPath: "js/admin.js"},
			{SourcePath: "js/page.js", TargetPath: "js/page.js"},
			{SourcePath: "js/router.js", TargetPath: "js/router.js"},
			{SourcePath: "js/vfsv2.js", TargetPath: "js/vfsv2.js"},
			{SourcePath: "js/markdown-it.min.js", TargetPath: "vendor/markdown-it.min.js"},
			{SourcePath: "img/favicon.png", TargetPath: "img/favicon.png"},
			{SourcePath: "img/icons.svg", TargetPath: "img/icons.svg"},
		},
	}
}

// BuildDirectory reads only the spec allowlist from sourceDir. os.Root keeps
// every lookup beneath sourceDir; explicit Lstat checks additionally reject
// symlinks and non-regular source files.
func BuildDirectory(sourceDir string, spec Spec) (html.InstallTemplateInput, error) {
	var result html.InstallTemplateInput
	if sourceDir == "" || spec.TemplateKey == "" || spec.Version == "" || spec.Entrypoint == "" || len(spec.Files) == 0 || len(spec.Files) > maxSourceFiles {
		return result, fmt.Errorf("invalid template package spec")
	}
	root, err := os.OpenRoot(sourceDir)
	if err != nil {
		return result, fmt.Errorf("open template source: %w", err)
	}
	defer root.Close()

	result = html.InstallTemplateInput{TemplateKey: spec.TemplateKey, Version: spec.Version, Entrypoint: spec.Entrypoint, Files: make([]html.InstallTemplateAsset, 0, len(spec.Files))}
	seenSources := make(map[string]struct{}, len(spec.Files))
	seenTargets := make(map[string]struct{}, len(spec.Files))
	var total int64
	for _, file := range spec.Files {
		source, err := cleanRelative(file.SourcePath)
		if err != nil {
			return html.InstallTemplateInput{}, fmt.Errorf("invalid source path %q: %w", file.SourcePath, err)
		}
		target, err := cleanRelative(file.TargetPath)
		if err != nil {
			return html.InstallTemplateInput{}, fmt.Errorf("invalid target path %q: %w", file.TargetPath, err)
		}
		if _, exists := seenSources[source]; exists {
			return html.InstallTemplateInput{}, fmt.Errorf("duplicate source path %q", source)
		}
		if _, exists := seenTargets[target]; exists {
			return html.InstallTemplateInput{}, fmt.Errorf("duplicate target path %q", target)
		}
		seenSources[source] = struct{}{}
		seenTargets[target] = struct{}{}
		if err := requireRegularPath(root, source); err != nil {
			return html.InstallTemplateInput{}, fmt.Errorf("unsafe template source %q: %w", source, err)
		}
		handle, err := root.Open(source)
		if err != nil {
			return html.InstallTemplateInput{}, fmt.Errorf("open template source %q: %w", source, err)
		}
		data, readErr := io.ReadAll(io.LimitReader(handle, maxSourceFile+1))
		closeErr := handle.Close()
		if readErr != nil {
			return html.InstallTemplateInput{}, fmt.Errorf("read template source %q: %w", source, readErr)
		}
		if closeErr != nil {
			return html.InstallTemplateInput{}, fmt.Errorf("close template source %q: %w", source, closeErr)
		}
		if len(data) > maxSourceFile {
			return html.InstallTemplateInput{}, fmt.Errorf("template source %q exceeds file limit", source)
		}
		total += int64(len(data))
		if total > maxSourceTotal {
			return html.InstallTemplateInput{}, fmt.Errorf("template package exceeds total limit")
		}
		for _, replacement := range file.Replace {
			if replacement.Old == "" || !strings.Contains(string(data), replacement.Old) {
				return html.InstallTemplateInput{}, fmt.Errorf("template source %q no longer contains reviewed text %q", source, replacement.Old)
			}
			data = []byte(strings.ReplaceAll(string(data), replacement.Old, replacement.New))
		}
		result.Files = append(result.Files, html.InstallTemplateAsset{Path: target, ContentType: file.ContentType, Data: data})
	}
	return result, nil
}

func cleanRelative(raw string) (string, error) {
	if raw == "" || strings.HasPrefix(raw, "/") || strings.ContainsAny(raw, `\`+"\x00") {
		return "", fmt.Errorf("path must be relative")
	}
	cleaned := path.Clean(raw)
	if cleaned != raw || cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", fmt.Errorf("path is not clean")
	}
	return cleaned, nil
}

func requireRegularPath(root *os.Root, name string) error {
	parts := strings.Split(name, "/")
	for index := range parts {
		current := strings.Join(parts[:index+1], "/")
		info, err := root.Lstat(current)
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("symbolic links are forbidden")
		}
		if index < len(parts)-1 && !info.IsDir() {
			return fmt.Errorf("path parent is not a directory")
		}
		if index == len(parts)-1 && !info.Mode().IsRegular() {
			return fmt.Errorf("source is not a regular file")
		}
	}
	return nil
}
