package html

import (
	"errors"
	"math"
	"strings"
	"testing"
)

func TestBuildEditorModelIsDeterministicAndFiltersMissingParents(t *testing.T) {
	parentID := int64(10)
	hiddenParentID := int64(99)
	site := Site{TreeRevision: 7, ModelRevision: 11}
	pages := []Page{
		{ID: 12, ParentID: &hiddenParentID, Position: 1, PageKey: "orphan", Title: "Orphan"},
		{ID: 11, ParentID: &parentID, Position: 0, PageKey: "child", Title: "A & B", Description: `say "hello"`},
		{ID: 10, Position: 0, PageKey: "home", Title: "Home"},
	}

	first, err := BuildEditorModel(site, pages)
	if err != nil {
		t.Fatalf("BuildEditorModel: %v", err)
	}
	second, err := BuildEditorModel(site, []Page{pages[2], pages[0], pages[1]})
	if err != nil {
		t.Fatalf("BuildEditorModel reordered: %v", err)
	}
	if string(first) != string(second) {
		t.Fatalf("model is not deterministic:\n%s\n---\n%s", first, second)
	}
	model := string(first)
	for _, expected := range []string{
		`<site-model schema-version="1" tree-revision="7" model-revision="11">`,
		`title="A &amp; B"`,
		`description="say &#34;hello&#34;"`,
		`<connection kind="parent" from-id="10" to-id="11" order="0"></connection>`,
	} {
		if !strings.Contains(model, expected) {
			t.Fatalf("model missing %q:\n%s", expected, model)
		}
	}
	if strings.Contains(model, `from-id="99"`) {
		t.Fatalf("model disclosed missing parent connection:\n%s", model)
	}
}

func TestBuildEditorModelRejectsDuplicatePageID(t *testing.T) {
	_, err := BuildEditorModel(Site{}, []Page{{ID: 1, PageKey: "one"}, {ID: 1, PageKey: "two"}})
	if !errors.Is(err, ErrInvalidEditorXML) {
		t.Fatalf("error = %v, want ErrInvalidEditorXML", err)
	}
}

func TestParseAndNormalizeEditorLayout(t *testing.T) {
	input := []byte(`<site-layout layout-revision="12" schema-version="1">
  <connections><connection to-id="2" from-id="1" bend-y="140" bend-x="360"/></connections>
  <nodes>
    <node view="collapsed" height="120" width="240" y="80" x="420" page-id="2"/>
    <node page-id="1" x="120" y="80" width="240" height="120" view="expanded"/>
  </nodes>
</site-layout>`)

	document, err := ParseEditorLayout(input, LayoutLimits{})
	if err != nil {
		t.Fatalf("ParseEditorLayout: %v", err)
	}
	if document.SchemaVersion != 1 || document.Revision != 12 || len(document.Nodes) != 2 || len(document.Connections) != 1 {
		t.Fatalf("document = %#v", document)
	}
	normalized, err := NormalizeEditorLayout(*document, LayoutLimits{})
	if err != nil {
		t.Fatalf("NormalizeEditorLayout: %v", err)
	}
	want := `<site-layout schema-version="1" layout-revision="12">
  <nodes>
    <node page-id="1" x="120" y="80" width="240" height="120" view="expanded"></node>
    <node page-id="2" x="420" y="80" width="240" height="120" view="collapsed"></node>
  </nodes>
  <connections>
    <connection from-id="1" to-id="2" bend-x="360" bend-y="140"></connection>
  </connections>
</site-layout>
`
	if string(normalized) != want {
		t.Fatalf("normalized layout:\n%s\nwant:\n%s", normalized, want)
	}
	reparsed, err := ParseEditorLayout(normalized, LayoutLimits{})
	if err != nil {
		t.Fatalf("ParseEditorLayout(normalized): %v", err)
	}
	renormalized, err := NormalizeEditorLayout(*reparsed, LayoutLimits{})
	if err != nil || string(renormalized) != string(normalized) {
		t.Fatalf("normalization is not idempotent: %v\n%s", err, renormalized)
	}
}

func TestParseEditorLayoutRejectsUnsafeOrUnknownXML(t *testing.T) {
	tests := map[string]string{
		"doctype":                `<!DOCTYPE site-layout [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><site-layout schema-version="1" layout-revision="1"/>`,
		"processing instruction": `<?unsafe value?><site-layout schema-version="1" layout-revision="1"/>`,
		"comment":                `<site-layout schema-version="1" layout-revision="1"><!-- hidden --></site-layout>`,
		"xinclude":               `<site-layout schema-version="1" layout-revision="1"><xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/></site-layout>`,
		"unknown element":        `<site-layout schema-version="1" layout-revision="1"><metadata/></site-layout>`,
		"unknown attribute":      `<site-layout schema-version="1" layout-revision="1" owner="admin"/>`,
		"duplicate attribute":    `<site-layout schema-version="1" schema-version="1" layout-revision="1"/>`,
		"multiple roots":         `<site-layout schema-version="1" layout-revision="1"/><site-layout schema-version="1" layout-revision="1"/>`,
		"text":                   `<site-layout schema-version="1" layout-revision="1">secret</site-layout>`,
	}
	for name, input := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := ParseEditorLayout([]byte(input), LayoutLimits{})
			if !errors.Is(err, ErrInvalidEditorXML) {
				t.Fatalf("error = %v, want ErrInvalidEditorXML", err)
			}
		})
	}
}

func TestParseEditorLayoutRejectsInvalidValuesAndLimits(t *testing.T) {
	tests := map[string]string{
		"unsupported schema": `<site-layout schema-version="2" layout-revision="1"/>`,
		"zero revision":      `<site-layout schema-version="1" layout-revision="0"/>`,
		"duplicate node":     `<site-layout schema-version="1" layout-revision="1"><nodes><node page-id="1" x="0" y="0" width="1" height="1" view="expanded"/><node page-id="1" x="1" y="1" width="1" height="1" view="expanded"/></nodes></site-layout>`,
		"unknown view":       `<site-layout schema-version="1" layout-revision="1"><nodes><node page-id="1" x="0" y="0" width="1" height="1" view="hidden"/></nodes></site-layout>`,
		"nan":                `<site-layout schema-version="1" layout-revision="1"><nodes><node page-id="1" x="NaN" y="0" width="1" height="1" view="expanded"/></nodes></site-layout>`,
		"infinity":           `<site-layout schema-version="1" layout-revision="1"><nodes><node page-id="1" x="+Inf" y="0" width="1" height="1" view="expanded"/></nodes></site-layout>`,
		"zero width":         `<site-layout schema-version="1" layout-revision="1"><nodes><node page-id="1" x="0" y="0" width="0" height="1" view="expanded"/></nodes></site-layout>`,
		"half bend":          `<site-layout schema-version="1" layout-revision="1"><connections><connection from-id="1" to-id="2" bend-x="1"/></connections></site-layout>`,
		"self connection":    `<site-layout schema-version="1" layout-revision="1"><connections><connection from-id="1" to-id="1"/></connections></site-layout>`,
	}
	for name, input := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := ParseEditorLayout([]byte(input), LayoutLimits{})
			if !errors.Is(err, ErrInvalidEditorXML) {
				t.Fatalf("error = %v, want ErrInvalidEditorXML", err)
			}
		})
	}

	tooManyNodes := `<site-layout schema-version="1" layout-revision="1"><nodes><node page-id="1" x="0" y="0" width="1" height="1" view="expanded"/><node page-id="2" x="0" y="0" width="1" height="1" view="expanded"/></nodes></site-layout>`
	if _, err := ParseEditorLayout([]byte(tooManyNodes), LayoutLimits{MaxNodes: 1}); !errors.Is(err, ErrInvalidEditorXML) {
		t.Fatalf("node limit error = %v", err)
	}
	if _, err := ParseEditorLayout([]byte(`<site-layout schema-version="1" layout-revision="1"/>`), LayoutLimits{MaxBytes: 8}); !errors.Is(err, ErrInvalidEditorXML) {
		t.Fatalf("byte limit error = %v", err)
	}
}

func TestNormalizeEditorLayoutRejectsNonFiniteValues(t *testing.T) {
	document := LayoutDocument{
		SchemaVersion: 1,
		Revision:      1,
		Nodes:         []LayoutNode{{PageID: 1, X: math.Inf(1), Y: 0, Width: 1, Height: 1, View: "expanded"}},
	}
	if _, err := NormalizeEditorLayout(document, LayoutLimits{}); !errors.Is(err, ErrInvalidEditorXML) {
		t.Fatalf("error = %v, want ErrInvalidEditorXML", err)
	}
}
