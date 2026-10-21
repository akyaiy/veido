// Package getstatic reads an allowlisted application-template asset for a
// trusted site binding and returns its bytes together with HTTP metadata.
package getstatic

import (
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"MyServer/pkg/vfs/hooksdk"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"os"
	"path"
	"regexp"
	"strings"
	"time"
)

const (
	HookKey          = "get-static"
	HookVersion      = 1
	maxManifestBytes = 1 << 20
	maxManifestFiles = 256
	maxAssetBytes    = 4 << 20
	maxOutputBytes   = 6 << 20
)

var (
	templateKeyPattern     = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)
	templateVersionPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$`)
)

type Input struct {
	Path string `json:"path"`
}

type Config struct {
	TemplateKey string `json:"template_key"`
}

type Output struct {
	Content      []byte `json:"content"`
	ContentType  string `json:"content_type"`
	Digest       string `json:"digest"`
	Size         int64  `json:"size"`
	ETag         string `json:"etag"`
	CacheControl string `json:"cache_control"`
	Entrypoint   bool   `json:"entrypoint"`
	TemplateKey  string `json:"template_key"`
	Version      string `json:"template_version"`
}

type templateManifest struct {
	SchemaVersion int             `json:"schema_version"`
	TemplateKey   string          `json:"template_key"`
	Version       string          `json:"version"`
	Entrypoint    string          `json:"entrypoint"`
	PackageDigest string          `json:"package_digest"`
	Assets        []manifestAsset `json:"assets"`
}

type manifestAsset struct {
	Path        string `json:"path"`
	ContentType string `json:"content_type"`
	Digest      string `json:"digest"`
	Size        int64  `json:"size"`
}

func Definition() hooks.Definition {
	return hooksdk.Native(HookKey, HookVersion, hooksdk.NativeOptions{
		Enabled: true,
		Active:  true,
		Limits: hooks.Limits{
			Timeout:        3 * time.Second,
			MaxSteps:       4,
			MaxInputBytes:  4 << 10,
			MaxOutputBytes: maxOutputBytes,
		},
	}, run)
}

func Register(registry *hooks.Registry) error {
	if registry == nil {
		return hooks.ErrInvalidDefinition
	}
	return registry.Register(Definition())
}

func BindingKey(siteURI vfs.URI) string {
	digest := sha256.Sum256([]byte(siteURI))
	return "html.get-static." + hex.EncodeToString(digest[:8])
}

func SiteBinding(bindingKey string, siteURI vfs.URI, templateKey string) (hooks.Binding, error) {
	if !templateKeyPattern.MatchString(templateKey) || siteURI.Provider() != "html" || siteURI.Path() != "/" {
		return hooks.Binding{}, fmt.Errorf("%w: invalid get-static site binding", hooks.ErrInvalidDefinition)
	}
	return hooksdk.ResourceBinding(bindingKey, HookKey, HookVersion, siteURI, Config{TemplateKey: templateKey})
}

func run(ctx context.Context, execution hooks.Execution, input Input) (Output, error) {
	return Resolve(ctx, execution, input)
}

// Resolve reads and verifies one manifest-listed template asset. It is shared
// by site hooks that need to return the application entrypoint after resolving
// their own domain resource.
func Resolve(ctx context.Context, execution hooks.Execution, input Input) (Output, error) {
	if execution.Binding == nil {
		return Output{}, vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "get-static requires a site binding", hooks.ErrBindingNotFound)
	}
	assetPath, err := normalizeAssetPath(input.Path)
	if err != nil {
		return Output{}, vfs.NewError(vfs.KindInvalidArgument, vfs.OpRead, "invalid static asset path", err)
	}
	config, err := decodeConfig(execution.Binding.Config)
	if err != nil {
		return Output{}, vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "invalid get-static binding", err)
	}
	versionsURI, err := siteResourceURI(execution.Binding.ResourceURI, path.Join("/templates", config.TemplateKey))
	if err != nil {
		return Output{}, vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "invalid get-static binding URI", err)
	}
	versions, err := execution.VFS.ReadDir(ctx, versionsURI)
	if err != nil {
		return Output{}, hooks.FailStep("list-template-versions", err)
	}
	version, err := latestVersion(versions)
	if err != nil {
		return Output{}, hooks.FailStep("resolve-latest-template", vfs.NewError(vfs.KindNotFound, vfs.OpRead, "application template not found", err))
	}
	manifestURI, err := siteResourceURI(execution.Binding.ResourceURI, path.Join("/templates", config.TemplateKey, version, "manifest.json"))
	if err != nil {
		return Output{}, vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "invalid get-static binding URI", err)
	}
	manifestBytes, err := readBounded(ctx, execution.VFS, manifestURI, maxManifestBytes)
	if err != nil {
		return Output{}, hooks.FailStep("read-template-manifest", err)
	}
	manifest, err := decodeManifest(manifestBytes, config.TemplateKey, version)
	if err != nil {
		return Output{}, hooks.FailStep("validate-template-manifest", vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "invalid template manifest", err))
	}
	asset, found := findAsset(manifest.Assets, assetPath)
	if !found {
		return Output{}, hooks.FailStep("resolve-template-asset", vfs.NewError(vfs.KindNotFound, vfs.OpRead, "static asset not found", vfs.ErrNotFound))
	}
	resourceURI, err := siteResourceURI(execution.Binding.ResourceURI, path.Join("/templates", config.TemplateKey, version, "files", asset.Path))
	if err != nil {
		return Output{}, hooks.FailStep("resolve-template-asset", vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "invalid template asset URI", err))
	}
	content, err := readBounded(ctx, execution.VFS, resourceURI, maxAssetBytes)
	if err != nil {
		return Output{}, hooks.FailStep("read-template-asset", err)
	}
	digest := sha256.Sum256(content)
	if int64(len(content)) != asset.Size || hex.EncodeToString(digest[:]) != asset.Digest {
		return Output{}, hooks.FailStep("verify-template-asset", vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "template asset does not match manifest", vfs.ErrFailedPrecondition))
	}
	entrypoint := asset.Path == manifest.Entrypoint
	cacheControl := "no-cache"
	return Output{
		Content: content, ContentType: asset.ContentType, Digest: asset.Digest,
		Size: asset.Size, ETag: `"sha256-` + asset.Digest + `"`, CacheControl: cacheControl, Entrypoint: entrypoint,
		TemplateKey: config.TemplateKey, Version: version,
	}, nil
}

func decodeConfig(data []byte) (Config, error) {
	var config Config
	if err := decodeStrict(data, &config); err != nil {
		return config, err
	}
	if !templateKeyPattern.MatchString(config.TemplateKey) {
		return config, fmt.Errorf("invalid template identity")
	}
	return config, nil
}

func decodeManifest(data []byte, templateKey, version string) (templateManifest, error) {
	var manifest templateManifest
	if err := decodeStrict(data, &manifest); err != nil {
		return manifest, err
	}
	if manifest.SchemaVersion != 1 || manifest.TemplateKey != templateKey || manifest.Version != version || len(manifest.Assets) == 0 || len(manifest.Assets) > maxManifestFiles {
		return manifest, fmt.Errorf("manifest identity or size mismatch")
	}
	entrypoint, err := normalizeAssetPath(manifest.Entrypoint)
	if err != nil {
		return manifest, err
	}
	manifest.Entrypoint = entrypoint
	seen := make(map[string]struct{}, len(manifest.Assets))
	entrypointFound := false
	for index := range manifest.Assets {
		asset := &manifest.Assets[index]
		asset.Path, err = normalizeAssetPath(asset.Path)
		if err != nil || asset.Size < 0 || asset.Size > maxAssetBytes || !validDigest(asset.Digest) {
			return manifest, fmt.Errorf("invalid manifest asset")
		}
		if _, _, err := mime.ParseMediaType(asset.ContentType); err != nil {
			return manifest, fmt.Errorf("invalid manifest content type")
		}
		if _, exists := seen[asset.Path]; exists {
			return manifest, fmt.Errorf("duplicate manifest asset")
		}
		seen[asset.Path] = struct{}{}
		entrypointFound = entrypointFound || asset.Path == entrypoint
	}
	if !entrypointFound {
		return manifest, fmt.Errorf("manifest entrypoint is absent")
	}
	return manifest, nil
}

func latestVersion(nodes []*vfs.Node) (string, error) {
	latest := ""
	for _, node := range nodes {
		if node != nil && node.IsDir && templateVersionPattern.MatchString(node.Name) {
			latest = node.Name
		}
	}
	if latest == "" {
		return "", vfs.ErrNotFound
	}
	return latest, nil
}

func decodeStrict(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return fmt.Errorf("expected one JSON value")
	}
	return nil
}

func normalizeAssetPath(raw string) (string, error) {
	if raw == "" || len(raw) > 512 || strings.HasPrefix(raw, "/") || strings.ContainsAny(raw, `\`+"\x00") {
		return "", fmt.Errorf("path must be a relative asset path")
	}
	cleaned := path.Clean(raw)
	if cleaned != raw || cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", fmt.Errorf("path is not clean")
	}
	return cleaned, nil
}

func validDigest(value string) bool {
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == 32 && strings.ToLower(value) == value
}

func findAsset(assets []manifestAsset, requested string) (manifestAsset, bool) {
	for _, asset := range assets {
		if asset.Path == requested {
			return asset, true
		}
	}
	return manifestAsset{}, false
}

func siteResourceURI(siteURI vfs.URI, resourcePath string) (vfs.URI, error) {
	if siteURI.Provider() != "html" || siteURI.ConnectionKey() == "" || siteURI.ScopeKey() == "" || siteURI.Path() != "/" {
		return "", fmt.Errorf("binding resource is not an HTML site root")
	}
	return (vfs.ResourceAddress{ProviderKey: siteURI.Provider(), ConnectionKey: siteURI.ConnectionKey(), ScopeKey: siteURI.ScopeKey(), Path: resourcePath}).URI()
}

func readBounded(ctx context.Context, bound hooks.VFS, uri vfs.URI, limit int64) ([]byte, error) {
	file, err := bound.OpenFile(ctx, uri, os.O_RDONLY)
	if err != nil {
		return nil, err
	}
	data, readErr := io.ReadAll(io.LimitReader(file, limit+1))
	closeErr := file.Close()
	if readErr != nil {
		return nil, readErr
	}
	if closeErr != nil {
		return nil, closeErr
	}
	if int64(len(data)) > limit {
		return nil, vfs.ErrResourceExhausted
	}
	return data, nil
}
