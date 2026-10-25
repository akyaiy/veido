// Package getpage resolves a public browser path against the actor-visible
// HTML page tree and returns the application entrypoint for that route.
package getpage

import (
	"MyServer/internal/vfs/v2/providers/html/hooks/getstatic"
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"MyServer/pkg/vfs/hooksdk"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"strings"
	"time"
)

const (
	HookKey          = "get-page"
	HookVersion      = 2
	NotFoundCode     = "not_found"
	maxInputBytes    = 4 << 10
	maxTreeBytes     = 4 << 20
	maxOutputBytes   = 6 << 20
	publicPageStatus = "ready"
)

type Input struct {
	SiteURI     vfs.URI `json:"site_uri"`
	TemplateKey string  `json:"template_key"`
	Path        string  `json:"path"`
}

type Output struct {
	getstatic.Output
	Route   string `json:"route"`
	Found   bool   `json:"found"`
	Code    string `json:"code,omitempty"`
	PageKey string `json:"page_key"`
}

func (o Output) MarshalJSON() ([]byte, error) {
	if !o.Found {
		return json.Marshal(struct {
			Route string `json:"route"`
			Found bool   `json:"found"`
			Code  string `json:"code"`
		}{Route: o.Route, Found: false, Code: o.Code})
	}
	type outputAlias Output
	return json.Marshal(outputAlias(o))
}

type treeDocument struct {
	TreeRevision       int64      `json:"tree_revision"`
	ModelRevision      int64      `json:"model_revision"`
	VisibilityRevision int64      `json:"visibility_revision"`
	Pages              []treePage `json:"pages"`
}

type treePage struct {
	ID       int64      `json:"id"`
	PageKey  string     `json:"page_key"`
	Slug     string     `json:"slug"`
	Title    string     `json:"title"`
	Status   string     `json:"status"`
	Position int        `json:"position"`
	Revision int64      `json:"revision"`
	Children []treePage `json:"children"`
}

func Definition() hooks.Definition {
	return hooksdk.Native(HookKey, HookVersion, hooksdk.NativeOptions{
		Enabled: true,
		Active:  true,
		Limits: hooks.Limits{
			Timeout:        3 * time.Second,
			MaxSteps:       4,
			MaxInputBytes:  maxInputBytes,
			MaxOutputBytes: maxOutputBytes,
		},
	}, run)
}

func run(ctx context.Context, execution hooks.Execution, input Input) (Output, error) {
	if input.SiteURI.Provider() != "html" || input.SiteURI.Path() != "/" {
		return Output{}, vfs.NewError(vfs.KindInvalidArgument, vfs.OpRead, "invalid page target", vfs.ErrInvalidArgument)
	}
	route, segments, err := normalizeRoute(input.Path)
	if err != nil {
		return Output{}, vfs.NewError(vfs.KindInvalidArgument, vfs.OpRead, "invalid page path", err)
	}
	treeURI, err := siteResourceURI(input.SiteURI, "/tree.json")
	if err != nil {
		return Output{}, vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "invalid get-page binding URI", err)
	}
	treeBytes, err := readBounded(ctx, execution.VFS, treeURI, maxTreeBytes)
	if err != nil {
		return Output{}, hooks.FailStep("read-page-tree", err)
	}
	var tree treeDocument
	if err := decodeStrict(treeBytes, &tree); err != nil {
		return Output{}, hooks.FailStep("decode-page-tree", vfs.NewError(vfs.KindFailedPrecondition, vfs.OpRead, "invalid page tree", err))
	}
	page, found := resolve(tree.Pages, segments)
	if !found {
		return Output{Route: route, Found: false, Code: NotFoundCode}, nil
	}
	asset, err := getstatic.Resolve(ctx, execution, getstatic.Input{SiteURI: input.SiteURI, TemplateKey: input.TemplateKey, Path: "index.html"})
	if err != nil {
		return Output{}, err
	}
	return Output{Output: asset, Route: route, Found: true, PageKey: page.PageKey}, nil
}

func normalizeRoute(raw string) (string, []string, error) {
	if raw == "" || len(raw) > 2048 || !strings.HasPrefix(raw, "/") || strings.ContainsAny(raw, "\\\x00?#%") {
		return "", nil, fmt.Errorf("path must be an absolute decoded browser path")
	}
	if raw != "/" {
		raw = strings.TrimSuffix(raw, "/")
	}
	cleaned := path.Clean(raw)
	if cleaned != raw || cleaned == "/" {
		return "", nil, fmt.Errorf("path is not a clean page route")
	}
	segments := strings.Split(strings.TrimPrefix(cleaned, "/"), "/")
	for _, segment := range segments {
		if segment == "" || segment == "." || segment == ".." {
			return "", nil, fmt.Errorf("path contains an invalid segment")
		}
	}
	return cleaned, segments, nil
}

func resolve(pages []treePage, segments []string) (treePage, bool) {
	var current treePage
	for _, segment := range segments {
		found := false
		for _, candidate := range pages {
			if candidate.Slug == segment {
				if candidate.Status != publicPageStatus {
					return treePage{}, false
				}
				current = candidate
				pages = candidate.Children
				found = true
				break
			}
		}
		if !found {
			return treePage{}, false
		}
	}
	return current, true
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
		return nil, vfs.NewError(vfs.KindResourceExhausted, vfs.OpRead, "page tree exceeds limit", nil)
	}
	return data, nil
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
