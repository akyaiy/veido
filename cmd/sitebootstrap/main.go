// sitebootstrap provisions one HTML site through the public actor-bound VFS API.
package main

import (
	"MyServer/internal/common"
	"MyServer/internal/vfs/v2/providers/html"
	"MyServer/internal/vfs/v2/providers/html/templatepackage"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

type manifest struct {
	ScopeName string `json:"scope_name"`
	Site      struct {
		Connection      string   `json:"connection"`
		Name            string   `json:"name"`
		BaseURL         string   `json:"base_url"`
		Visibility      []string `json:"visibility"`
		TemplateSource  string   `json:"template_source"`
		TemplateVersion string   `json:"template_version"`
	} `json:"site"`
	Publishers []struct {
		Connection string `json:"connection"`
		SourceDir  string `json:"source_dir"`
	} `json:"publishers"`
	Pages []struct {
		Key        string   `json:"key"`
		Slug       string   `json:"slug"`
		Title      string   `json:"title"`
		Status     string   `json:"status"`
		Publisher  string   `json:"publisher"`
		SourceDir  string   `json:"source_dir"`
		Visibility []string `json:"visibility"`
	} `json:"pages"`
}
type client struct {
	base, token string
	http        *http.Client
}

func main() {
	file := flag.String("manifest", "./site.bootstrap.json", "bootstrap manifest")
	server := flag.String("server", "http://localhost:8080", "running server URL")
	token := flag.String("access-token", os.Getenv("SITE_BOOTSTRAP_ACCESS_TOKEN"), "access JWT (or SITE_BOOTSTRAP_ACCESS_TOKEN)")
	templateOnly := flag.Bool("install-template-only", false, "install the template package only; do not change scope, connections, publishers, or pages")
	siteURIOverride := flag.String("site-uri", "", "canonical HTML site URI for template-only installation")
	templateVersion := flag.String("template-version", "", "override the immutable application-template version from the manifest")
	flag.Parse()
	if *token == "" {
		fail(fmt.Errorf("access token is required"))
	}
	data, err := os.ReadFile(*file)
	if err != nil {
		fail(err)
	}
	var m manifest
	if err = json.Unmarshal(data, &m); err != nil {
		fail(err)
	}
	if m.ScopeName == "" || m.Site.Connection == "" || m.Site.TemplateSource == "" || m.Site.TemplateVersion == "" {
		fail(fmt.Errorf("scope_name and site connection/template fields are required"))
	}
	if strings.TrimSpace(*templateVersion) != "" {
		m.Site.TemplateVersion = strings.TrimSpace(*templateVersion)
	}
	c := client{base: strings.TrimRight(*server, "/"), token: *token, http: http.DefaultClient}
	if *templateOnly && strings.TrimSpace(*siteURIOverride) != "" {
		uri, err := common.CastURI(strings.TrimSpace(*siteURIOverride))
		if err != nil || uri.Provider() != html.ProviderKey || uri.Path() != "/" || !uri.HasScope() {
			fail(fmt.Errorf("-site-uri must be a canonical HTML site root"))
		}
		input, err := templatepackage.BuildDirectory(m.Site.TemplateSource, templatepackage.DefaultSPA(m.Site.TemplateVersion))
		if err != nil {
			fail(err)
		}
		if err := c.control(string(uri)+"templates", "install", input); err != nil {
			fail(fmt.Errorf("install site template: %w", err))
		}
		fmt.Printf("SITE_URI=%s\n", uri)
		return
	}
	var scope node
	var scopeExists bool
	scope, scopeExists, err = c.findScope(m.ScopeName)
	if err != nil {
		fail(fmt.Errorf("find site scope: %w", err))
	}
	if *templateOnly {
		if !scopeExists {
			fail(fmt.Errorf("site scope %q does not exist; template-only install never creates a site", m.ScopeName))
		}
	} else if scopeExists {
		fail(fmt.Errorf("site scope %q already exists (%s); bootstrap refuses to overwrite an existing site or publisher connection", m.ScopeName, scope.Name))
	} else {
		scope, err = c.mkdir("scopes@scopes[system]:///scopes/" + m.ScopeName)
		if err != nil {
			fail(fmt.Errorf("create site scope: %w", err))
		}
	}
	htmlURI := fmt.Sprintf("html@%s[%s]:///", m.Site.Connection, scope.Name)
	if *templateOnly {
		input, err := templatepackage.BuildDirectory(m.Site.TemplateSource, templatepackage.DefaultSPA(m.Site.TemplateVersion))
		if err != nil {
			fail(err)
		}
		if err := c.control(htmlURI+"templates", "install", input); err != nil {
			fail(fmt.Errorf("install site template: %w", err))
		}
		fmt.Printf("SITE_URI=%s\n", htmlURI)
		return
	}
	for _, p := range m.Publishers {
		if err := c.connection(scope.Name, "local", p.Connection, `{"mode":"bootstrap"}`); err != nil {
			fail(fmt.Errorf("configure publisher connection %q: %w", p.Connection, err))
		}
		if err := c.activatePublisher(scope.Name, p.Connection); err != nil {
			fail(fmt.Errorf("activate publisher %q: %w", p.Connection, err))
		}
	}
	if err := c.connection(scope.Name, "html", m.Site.Connection, `{}`); err != nil {
		fail(fmt.Errorf("configure HTML connection %q: %w", m.Site.Connection, err))
	}
	if err := c.control(htmlURI, "initialize", map[string]any{"name": m.Site.Name, "base_url": m.Site.BaseURL, "visible_to": m.Site.Visibility}); err != nil {
		fail(fmt.Errorf("initialize site %s: %w", htmlURI, err))
	}
	input, err := templatepackage.BuildDirectory(m.Site.TemplateSource, templatepackage.DefaultSPA(m.Site.TemplateVersion))
	if err != nil {
		fail(err)
	}
	if err := c.control(htmlURI+"templates", "install", input); err != nil {
		fail(fmt.Errorf("install site template: %w", err))
	}
	for _, p := range m.Publishers {
		root := fmt.Sprintf("local@%s[%s]:///", p.Connection, scope.Name)
		if err := c.control(htmlURI+"publishers", "register-root", map[string]any{"root_uri": root, "purpose": "content", "visible_to": m.Site.Visibility}); err != nil {
			fail(fmt.Errorf("register publisher root %s: %w", root, err))
		}
	}
	for _, p := range m.Pages {
		root := fmt.Sprintf("local@%s[%s]:///pages/%s", p.Publisher, scope.Name, p.Key)
		for _, dir := range []string{"/pages", "/pages/" + p.Key} {
			if _, err := c.mkdir(fmt.Sprintf("local@%s[%s]:///%s", p.Publisher, scope.Name, strings.TrimPrefix(dir, "/"))); err != nil {
				fail(fmt.Errorf("create page directory %s: %w", dir, err))
			}
		}
		for _, name := range []string{"content.md", "style.css", "script.js"} {
			b, err := os.ReadFile(filepath.Join(p.SourceDir, name))
			if err != nil {
				fail(err)
			}
			if err := c.file(root+"/"+name, b); err != nil {
				fail(fmt.Errorf("write page file %s: %w", root+"/"+name, err))
			}
		}
		if err := c.control(htmlURI+"pages", "create", map[string]any{"expected_tree_revision": 1, "position": map[string]bool{"last": true}, "page_key": p.Key, "slug": p.Slug, "title": p.Title, "status": p.Status, "bundle_root_uri": root, "visible_to": p.Visibility}); err != nil {
			fail(fmt.Errorf("create page %q: %w", p.Key, err))
		}
	}
	fmt.Printf("SITE_URI=%s\n", htmlURI)
}
func fail(err error) { fmt.Fprintln(os.Stderr, "site bootstrap:", err); os.Exit(1) }
func (c client) req(method, path string, body []byte) ([]byte, error) {
	r, err := http.NewRequest(method, c.base+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	r.Header.Set("Authorization", "Bearer "+c.token)
	r.Header.Set("Content-Type", "application/json")
	q, err := c.http.Do(r)
	if err != nil {
		return nil, err
	}
	defer q.Body.Close()
	data, _ := io.ReadAll(q.Body)
	if q.StatusCode < 200 || q.StatusCode > 299 {
		return nil, fmt.Errorf("%s: %s", q.Status, data)
	}
	return data, nil
}

type node struct {
	Name string `json:"name"`
}

func (c client) mkdir(uri string) (node, error) {
	var n node
	b, e := c.req("POST", "/api/v2/vfs/directory?uri="+url.QueryEscape(uri), nil)
	if e != nil {
		return n, e
	}
	e = json.Unmarshal(b, &n)
	return n, e
}

func (c client) findScope(name string) (node, bool, error) {
	data, err := c.req("GET", "/api/v2/vfs/list?uri="+url.QueryEscape("scopes@scopes[system]:///scopes"), nil)
	if err != nil {
		return node{}, false, err
	}
	var listed struct {
		Items []node `json:"items"`
	}
	if err = json.Unmarshal(data, &listed); err != nil {
		return node{}, false, err
	}
	for _, item := range listed.Items {
		if strings.HasSuffix(item.Name, "-"+name) {
			return item, true, nil
		}
	}
	return node{}, false, nil
}
func (c client) connection(scope, provider, key, config string) error {
	connectionURI := "scopes@scopes[system]:///scopes/" + scope + "/connections/" + provider + "@" + key
	if _, e := c.mkdir(connectionURI); e != nil {
		if _, statErr := c.req("GET", "/api/v2/vfs/stat?uri="+url.QueryEscape(connectionURI), nil); statErr != nil {
			return fmt.Errorf("create connection: %w", e)
		}
	}
	if _, e := c.req("PUT", "/api/v2/vfs/file?uri="+url.QueryEscape(connectionURI+"/config.json"), []byte(config)); e != nil {
		return e
	}
	_, e := c.req("PUT", "/api/v2/vfs/file?uri="+url.QueryEscape(connectionURI+"/status.json"), []byte(`{"ready":true}`))
	return e
}
func (c client) control(uri, command string, input any) error {
	b, e := json.Marshal(input)
	if e != nil {
		return e
	}
	_, e = c.req("POST", "/api/v2/vfs/control?uri="+url.QueryEscape(uri)+"&command="+url.QueryEscape(command), b)
	return e
}
func (c client) file(uri string, b []byte) error {
	_, e := c.req("POST", "/api/v2/vfs/file?uri="+url.QueryEscape(uri), b)
	return e
}

func (c client) activatePublisher(scope, key string) error {
	root := fmt.Sprintf("local@%s[%s]:///", key, scope)
	data, err := c.req("GET", "/api/v2/vfs/read?uri="+url.QueryEscape(root+"%account%/create_request.json"), nil)
	if err != nil {
		return err
	}
	var request struct {
		Done       bool   `json:"done"`
		SubjectKey string `json:"subject_key"`
		Secret     string `json:"secret"`
	}
	if err := json.Unmarshal(data, &request); err != nil {
		return err
	}
	request.Done = true
	payload, err := json.Marshal(request)
	if err != nil {
		return err
	}
	if _, err = c.req("PUT", "/api/v2/vfs/file?uri="+url.QueryEscape(root+"%account%/create_request.json"), payload); err != nil {
		return err
	}
	uri := "scopes@scopes[system]:///scopes/" + scope + "/connections/local@" + key + "/config.json"
	config, _ := json.Marshal(map[string]string{"mode": "account", "subject_key": request.SubjectKey, "secret": request.Secret})
	_, err = c.req("PUT", "/api/v2/vfs/file?uri="+url.QueryEscape(uri), config)
	return err
}

var _ = html.ProviderKey
