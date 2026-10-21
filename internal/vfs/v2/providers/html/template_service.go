package html

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"mime"
	"path"
	"regexp"
	"sort"
	"strings"
)

const (
	maxTemplateFiles      = 256
	maxTemplateFileBytes  = 4 << 20
	maxTemplateTotalBytes = 16 << 20
	maxTemplatePathBytes  = 512
	maxInstallInputBytes  = 24 << 20
)

var (
	templateKeyPattern     = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}$`)
	templateVersionPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$`)
)

type InstallTemplateInput struct {
	TemplateKey string                 `json:"template_key" required:"true"`
	Version     string                 `json:"version" required:"true"`
	Entrypoint  string                 `json:"entrypoint" required:"true"`
	Files       []InstallTemplateAsset `json:"files" required:"true"`
}

type InstallTemplateAsset struct {
	Path        string `json:"path" required:"true"`
	ContentType string `json:"content_type,omitempty"`
	Data        []byte `json:"data" required:"true"`
}

type TemplateManifest struct {
	SchemaVersion int                     `json:"schema_version"`
	TemplateKey   string                  `json:"template_key"`
	Version       string                  `json:"version"`
	Entrypoint    string                  `json:"entrypoint"`
	PackageDigest string                  `json:"package_digest"`
	Assets        []TemplateManifestAsset `json:"assets"`
}

type TemplateManifestAsset struct {
	Path        string `json:"path"`
	ContentType string `json:"content_type"`
	Digest      string `json:"digest"`
	Size        int64  `json:"size"`
}

type InstalledTemplateDocument struct {
	TemplateKey    string   `json:"template_key"`
	Version        string   `json:"version"`
	Entrypoint     string   `json:"entrypoint"`
	PackageDigest  string   `json:"package_digest"`
	ManifestDigest string   `json:"manifest_digest"`
	Manifest       string   `json:"manifest_uri"`
	Assets         []string `json:"assets"`
}

type TemplateService struct{ store Store }

func NewTemplateService(store Store) (*TemplateService, error) {
	if store == nil {
		return nil, ErrInvalidRecord
	}
	return &TemplateService{store: store}, nil
}

func (s *TemplateService) Install(ctx context.Context, site *Site, input InstallTemplateInput) (*ApplicationTemplate, error) {
	if site == nil || !templateKeyPattern.MatchString(input.TemplateKey) || !templateVersionPattern.MatchString(input.Version) {
		return nil, ErrInvalidTemplate
	}
	entrypoint, err := normalizeTemplatePath(input.Entrypoint)
	if err != nil || path.Ext(entrypoint) != ".html" || len(input.Files) == 0 || len(input.Files) > maxTemplateFiles {
		return nil, ErrInvalidTemplate
	}
	assets := make([]NewTemplateAsset, 0, len(input.Files))
	manifestAssets := make([]TemplateManifestAsset, 0, len(input.Files))
	seen := make(map[string]struct{}, len(input.Files))
	var total int64
	entrypointFound := false
	for _, file := range input.Files {
		assetPath, err := normalizeTemplatePath(file.Path)
		if err != nil {
			return nil, ErrInvalidTemplate
		}
		if _, exists := seen[assetPath]; exists {
			return nil, ErrInvalidTemplate
		}
		seen[assetPath] = struct{}{}
		if len(file.Data) > maxTemplateFileBytes {
			return nil, ErrInvalidTemplate
		}
		total += int64(len(file.Data))
		if total > maxTemplateTotalBytes {
			return nil, ErrInvalidTemplate
		}
		contentType, err := templateContentType(assetPath, file.ContentType)
		if err != nil {
			return nil, ErrInvalidTemplate
		}
		digest := sha256Hex(file.Data)
		assets = append(assets, NewTemplateAsset{Path: assetPath, ContentType: contentType, Digest: digest, Data: append([]byte(nil), file.Data...)})
		manifestAssets = append(manifestAssets, TemplateManifestAsset{Path: assetPath, ContentType: contentType, Digest: digest, Size: int64(len(file.Data))})
		entrypointFound = entrypointFound || assetPath == entrypoint
	}
	if !entrypointFound {
		return nil, ErrInvalidTemplate
	}
	sort.Slice(assets, func(i, j int) bool { return assets[i].Path < assets[j].Path })
	sort.Slice(manifestAssets, func(i, j int) bool { return manifestAssets[i].Path < manifestAssets[j].Path })

	digestInput := struct {
		TemplateKey string                  `json:"template_key"`
		Version     string                  `json:"version"`
		Entrypoint  string                  `json:"entrypoint"`
		Assets      []TemplateManifestAsset `json:"assets"`
	}{input.TemplateKey, input.Version, entrypoint, manifestAssets}
	digestBytes, err := json.Marshal(digestInput)
	if err != nil {
		return nil, err
	}
	packageDigest := sha256Hex(digestBytes)
	manifest := TemplateManifest{SchemaVersion: 1, TemplateKey: input.TemplateKey, Version: input.Version, Entrypoint: entrypoint, PackageDigest: packageDigest, Assets: manifestAssets}
	manifestJSON, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, err
	}
	manifestJSON = append(manifestJSON, '\n')
	return s.store.InstallTemplate(ctx, NewTemplatePackage{
		SiteID: site.ID, TemplateKey: input.TemplateKey, Version: input.Version, Entrypoint: entrypoint,
		PackageDigest: packageDigest, ManifestDigest: sha256Hex(manifestJSON), ManifestJSON: manifestJSON, Assets: assets,
	})
}

func normalizeTemplatePath(raw string) (string, error) {
	if raw == "" || len(raw) > maxTemplatePathBytes || strings.HasPrefix(raw, "/") || strings.ContainsAny(raw, `\`+"\x00") {
		return "", ErrInvalidTemplate
	}
	cleaned := path.Clean(raw)
	if cleaned != raw || cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrInvalidTemplate
	}
	for _, segment := range strings.Split(cleaned, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return "", ErrInvalidTemplate
		}
	}
	return cleaned, nil
}

func templateContentType(assetPath, requested string) (string, error) {
	inferred := map[string]string{
		".html":  "text/html; charset=utf-8",
		".css":   "text/css; charset=utf-8",
		".js":    "application/javascript; charset=utf-8",
		".json":  "application/json; charset=utf-8",
		".svg":   "image/svg+xml",
		".png":   "image/png",
		".jpg":   "image/jpeg",
		".jpeg":  "image/jpeg",
		".gif":   "image/gif",
		".webp":  "image/webp",
		".ico":   "image/x-icon",
		".woff":  "font/woff",
		".woff2": "font/woff2",
		".ttf":   "font/ttf",
		".txt":   "text/plain; charset=utf-8",
	}[strings.ToLower(path.Ext(assetPath))]
	requested = strings.TrimSpace(requested)
	if requested == "" {
		if inferred == "" {
			return "", fmt.Errorf("%w: content type required for %q", ErrInvalidTemplate, assetPath)
		}
		return inferred, nil
	}
	mediaType, params, err := mime.ParseMediaType(requested)
	if err != nil || mediaType == "" {
		return "", ErrInvalidTemplate
	}
	if inferred != "" {
		inferredType, _, _ := mime.ParseMediaType(inferred)
		if mediaType != inferredType {
			return "", ErrInvalidTemplate
		}
	}
	if strings.HasPrefix(mediaType, "text/") || mediaType == "application/javascript" || mediaType == "application/json" {
		for key := range params {
			if !strings.EqualFold(key, "charset") {
				return "", ErrInvalidTemplate
			}
		}
		if charset, ok := params["charset"]; ok && !strings.EqualFold(charset, "utf-8") {
			return "", ErrInvalidTemplate
		}
		return mediaType + "; charset=utf-8", nil
	}
	if len(params) != 0 {
		return "", ErrInvalidTemplate
	}
	return mediaType, nil
}

func sha256Hex(data []byte) string {
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
}
