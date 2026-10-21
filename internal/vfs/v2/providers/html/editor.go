package html

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"strings"
)

const EditorXMLSchemaVersion = 1

var (
	ErrInvalidEditorXML       = errors.New("invalid editor XML")
	ErrLayoutRevisionConflict = errors.New("layout revision conflict")
)

type LayoutLimits struct {
	MaxBytes          int
	MaxNodes          int
	MaxConnections    int
	MaxAttributeBytes int
	MaxCoordinate     float64
	MaxDimension      float64
}

var defaultLayoutLimits = LayoutLimits{
	MaxBytes:          256 << 10,
	MaxNodes:          10_000,
	MaxConnections:    20_000,
	MaxAttributeBytes: 4 << 10,
	MaxCoordinate:     10_000_000,
	MaxDimension:      1_000_000,
}

type LayoutDocument struct {
	SchemaVersion int
	Revision      int64
	Nodes         []LayoutNode
	Connections   []LayoutConnection
}

type LayoutNode struct {
	PageID int64
	X      float64
	Y      float64
	Width  float64
	Height float64
	View   string
}

type LayoutConnection struct {
	FromID int64
	ToID   int64
	BendX  *float64
	BendY  *float64
}

type siteModelXML struct {
	XMLName       xml.Name          `xml:"site-model"`
	SchemaVersion int               `xml:"schema-version,attr"`
	TreeRevision  int64             `xml:"tree-revision,attr"`
	ModelRevision int64             `xml:"model-revision,attr"`
	Nodes         siteModelNodesXML `xml:"nodes"`
	Connections   siteModelEdgesXML `xml:"connections"`
}

type siteModelNodesXML struct {
	Pages []siteModelPageXML `xml:"page"`
}

type siteModelPageXML struct {
	ID          int64  `xml:"id,attr"`
	Key         string `xml:"key,attr"`
	Title       string `xml:"title,attr"`
	Description string `xml:"description,attr"`
}

type siteModelEdgesXML struct {
	Connections []siteModelConnectionXML `xml:"connection"`
}

type siteModelConnectionXML struct {
	Kind   string `xml:"kind,attr"`
	FromID int64  `xml:"from-id,attr"`
	ToID   int64  `xml:"to-id,attr"`
	Order  int    `xml:"order,attr"`
}

// BuildEditorModel creates the read-only editor projection. The caller owns
// actor-dependent visibility filtering; missing parents are intentionally not
// exposed as connections.
func BuildEditorModel(site Site, pages []Page) ([]byte, error) {
	ordered := append([]Page(nil), pages...)
	sort.Slice(ordered, func(i, j int) bool {
		if (ordered[i].ParentID == nil) != (ordered[j].ParentID == nil) {
			return ordered[i].ParentID == nil
		}
		if ordered[i].ParentID != nil && *ordered[i].ParentID != *ordered[j].ParentID {
			return *ordered[i].ParentID < *ordered[j].ParentID
		}
		if ordered[i].Position != ordered[j].Position {
			return ordered[i].Position < ordered[j].Position
		}
		return ordered[i].ID < ordered[j].ID
	})

	known := make(map[int64]struct{}, len(ordered))
	nodes := make([]siteModelPageXML, 0, len(ordered))
	for _, page := range ordered {
		if page.ID <= 0 || page.PageKey == "" {
			return nil, editorXMLInvalid("model contains an invalid page")
		}
		if _, exists := known[page.ID]; exists {
			return nil, editorXMLInvalid("model contains a duplicate page ID")
		}
		known[page.ID] = struct{}{}
		nodes = append(nodes, siteModelPageXML{ID: page.ID, Key: page.PageKey, Title: page.Title, Description: page.Description})
	}

	edges := make([]siteModelConnectionXML, 0, len(ordered))
	for _, page := range ordered {
		if page.ParentID == nil {
			continue
		}
		if _, visible := known[*page.ParentID]; !visible {
			continue
		}
		edges = append(edges, siteModelConnectionXML{Kind: "parent", FromID: *page.ParentID, ToID: page.ID, Order: page.Position})
	}
	sort.Slice(edges, func(i, j int) bool {
		if edges[i].FromID != edges[j].FromID {
			return edges[i].FromID < edges[j].FromID
		}
		if edges[i].Order != edges[j].Order {
			return edges[i].Order < edges[j].Order
		}
		return edges[i].ToID < edges[j].ToID
	})

	document := siteModelXML{
		SchemaVersion: EditorXMLSchemaVersion,
		TreeRevision:  site.TreeRevision,
		ModelRevision: site.ModelRevision,
		Nodes:         siteModelNodesXML{Pages: nodes},
		Connections:   siteModelEdgesXML{Connections: edges},
	}
	return marshalEditorXML(document)
}

type layoutXML struct {
	XMLName       xml.Name             `xml:"site-layout"`
	SchemaVersion string               `xml:"schema-version,attr"`
	Revision      string               `xml:"layout-revision,attr"`
	Nodes         layoutNodesXML       `xml:"nodes"`
	Connections   layoutConnectionsXML `xml:"connections"`
}

type layoutNodesXML struct {
	Nodes []layoutNodeXML `xml:"node"`
}

type layoutNodeXML struct {
	PageID string `xml:"page-id,attr"`
	X      string `xml:"x,attr"`
	Y      string `xml:"y,attr"`
	Width  string `xml:"width,attr"`
	Height string `xml:"height,attr"`
	View   string `xml:"view,attr"`
}

type layoutConnectionsXML struct {
	Connections []layoutConnectionXML `xml:"connection"`
}

type layoutConnectionXML struct {
	FromID string `xml:"from-id,attr"`
	ToID   string `xml:"to-id,attr"`
	BendX  string `xml:"bend-x,attr,omitempty"`
	BendY  string `xml:"bend-y,attr,omitempty"`
}

func ParseEditorLayout(data []byte, limits LayoutLimits) (*LayoutDocument, error) {
	limits = effectiveLayoutLimits(limits)
	if len(data) == 0 || len(data) > limits.MaxBytes {
		return nil, editorXMLInvalid("layout document size is outside the allowed range")
	}
	if err := validateLayoutXMLShape(data, limits); err != nil {
		return nil, err
	}

	var raw layoutXML
	decoder := xml.NewDecoder(bytes.NewReader(data))
	decoder.Strict = true
	if err := decoder.Decode(&raw); err != nil {
		return nil, editorXMLInvalid("layout XML cannot be decoded: %v", err)
	}

	schemaVersion, err := parsePositiveInt("schema-version", raw.SchemaVersion)
	if err != nil || schemaVersion != EditorXMLSchemaVersion {
		return nil, editorXMLInvalid("unsupported layout schema version")
	}
	revision, err := parsePositiveInt64("layout-revision", raw.Revision)
	if err != nil {
		return nil, err
	}

	document := &LayoutDocument{SchemaVersion: schemaVersion, Revision: revision}
	seenNodes := make(map[int64]struct{}, len(raw.Nodes.Nodes))
	for _, item := range raw.Nodes.Nodes {
		node, err := parseLayoutNode(item, limits)
		if err != nil {
			return nil, err
		}
		if _, exists := seenNodes[node.PageID]; exists {
			return nil, editorXMLInvalid("layout contains duplicate page-id %d", node.PageID)
		}
		seenNodes[node.PageID] = struct{}{}
		document.Nodes = append(document.Nodes, node)
	}

	seenConnections := make(map[[2]int64]struct{}, len(raw.Connections.Connections))
	for _, item := range raw.Connections.Connections {
		connection, err := parseLayoutConnection(item, limits)
		if err != nil {
			return nil, err
		}
		key := [2]int64{connection.FromID, connection.ToID}
		if _, exists := seenConnections[key]; exists {
			return nil, editorXMLInvalid("layout contains a duplicate connection")
		}
		seenConnections[key] = struct{}{}
		document.Connections = append(document.Connections, connection)
	}
	return document, nil
}

func NormalizeEditorLayout(document LayoutDocument, limits LayoutLimits) ([]byte, error) {
	limits = effectiveLayoutLimits(limits)
	if document.SchemaVersion != EditorXMLSchemaVersion || document.Revision <= 0 {
		return nil, editorXMLInvalid("invalid layout schema or revision")
	}
	if len(document.Nodes) > limits.MaxNodes || len(document.Connections) > limits.MaxConnections {
		return nil, editorXMLInvalid("layout exceeds structural limits")
	}

	nodes := append([]LayoutNode(nil), document.Nodes...)
	sort.Slice(nodes, func(i, j int) bool { return nodes[i].PageID < nodes[j].PageID })
	rawNodes := make([]layoutNodeXML, 0, len(nodes))
	seenNodes := make(map[int64]struct{}, len(nodes))
	for _, node := range nodes {
		if err := validateLayoutNode(node, limits); err != nil {
			return nil, err
		}
		if _, exists := seenNodes[node.PageID]; exists {
			return nil, editorXMLInvalid("layout contains duplicate page-id %d", node.PageID)
		}
		seenNodes[node.PageID] = struct{}{}
		rawNodes = append(rawNodes, layoutNodeXML{
			PageID: strconv.FormatInt(node.PageID, 10), X: formatFloat(node.X), Y: formatFloat(node.Y),
			Width: formatFloat(node.Width), Height: formatFloat(node.Height), View: node.View,
		})
	}

	connections := append([]LayoutConnection(nil), document.Connections...)
	sort.Slice(connections, func(i, j int) bool {
		if connections[i].FromID != connections[j].FromID {
			return connections[i].FromID < connections[j].FromID
		}
		return connections[i].ToID < connections[j].ToID
	})
	rawConnections := make([]layoutConnectionXML, 0, len(connections))
	seenConnections := make(map[[2]int64]struct{}, len(connections))
	for _, connection := range connections {
		if err := validateLayoutConnection(connection, limits); err != nil {
			return nil, err
		}
		key := [2]int64{connection.FromID, connection.ToID}
		if _, exists := seenConnections[key]; exists {
			return nil, editorXMLInvalid("layout contains a duplicate connection")
		}
		seenConnections[key] = struct{}{}
		raw := layoutConnectionXML{FromID: strconv.FormatInt(connection.FromID, 10), ToID: strconv.FormatInt(connection.ToID, 10)}
		if connection.BendX != nil {
			raw.BendX = formatFloat(*connection.BendX)
			raw.BendY = formatFloat(*connection.BendY)
		}
		rawConnections = append(rawConnections, raw)
	}

	raw := layoutXML{
		SchemaVersion: strconv.Itoa(document.SchemaVersion),
		Revision:      strconv.FormatInt(document.Revision, 10),
		Nodes:         layoutNodesXML{Nodes: rawNodes},
		Connections:   layoutConnectionsXML{Connections: rawConnections},
	}
	encoded, err := marshalEditorXML(raw)
	if err != nil {
		return nil, err
	}
	if len(encoded) > limits.MaxBytes {
		return nil, editorXMLInvalid("normalized layout exceeds the byte limit")
	}
	return encoded, nil
}

func initialEditorLayout(data []byte) ([]byte, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return NormalizeEditorLayout(LayoutDocument{SchemaVersion: EditorXMLSchemaVersion, Revision: 1}, LayoutLimits{})
	}
	document, err := ParseEditorLayout(data, LayoutLimits{})
	if err != nil {
		return nil, err
	}
	if document.Revision != 1 {
		return nil, editorXMLInvalid("initial layout revision must be 1")
	}
	return NormalizeEditorLayout(*document, LayoutLimits{})
}

func validateLayoutXMLShape(data []byte, limits LayoutLimits) error {
	allowed := map[string]map[string]struct{}{
		"site-layout": {"schema-version": {}, "layout-revision": {}},
		"nodes":       {},
		"node":        {"page-id": {}, "x": {}, "y": {}, "width": {}, "height": {}, "view": {}},
		"connections": {},
		"connection":  {"from-id": {}, "to-id": {}, "bend-x": {}, "bend-y": {}},
	}
	allowedChildren := map[string]map[string]struct{}{
		"":            {"site-layout": {}},
		"site-layout": {"nodes": {}, "connections": {}},
		"nodes":       {"node": {}},
		"connections": {"connection": {}},
	}
	required := map[string][]string{
		"site-layout": {"schema-version", "layout-revision"},
		"node":        {"page-id", "x", "y", "width", "height", "view"},
		"connection":  {"from-id", "to-id"},
	}

	decoder := xml.NewDecoder(bytes.NewReader(data))
	decoder.Strict = true
	stack := make([]string, 0, 4)
	counts := map[string]int{}
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return editorXMLInvalid("layout XML is malformed: %v", err)
		}
		switch value := token.(type) {
		case xml.StartElement:
			if value.Name.Space != "" {
				return editorXMLInvalid("XML namespaces are not allowed")
			}
			name := value.Name.Local
			parent := ""
			if len(stack) > 0 {
				parent = stack[len(stack)-1]
			}
			if _, ok := allowedChildren[parent][name]; !ok {
				return editorXMLInvalid("element %q is not allowed inside %q", name, parent)
			}
			if name == "site-layout" {
				counts[name]++
				if counts[name] > 1 {
					return editorXMLInvalid("layout must contain exactly one root element")
				}
			}
			if name == "nodes" || name == "connections" {
				counts[name]++
				if counts[name] > 1 {
					return editorXMLInvalid("element %q may appear only once", name)
				}
			}
			if name == "node" {
				counts[name]++
				if counts[name] > limits.MaxNodes {
					return editorXMLInvalid("layout contains too many nodes")
				}
			}
			if name == "connection" {
				counts[name]++
				if counts[name] > limits.MaxConnections {
					return editorXMLInvalid("layout contains too many connections")
				}
			}
			seen := make(map[string]struct{}, len(value.Attr))
			for _, attribute := range value.Attr {
				if attribute.Name.Space != "" {
					return editorXMLInvalid("namespaced attributes are not allowed")
				}
				attributeName := attribute.Name.Local
				if _, ok := allowed[name][attributeName]; !ok {
					return editorXMLInvalid("attribute %q is not allowed on %q", attributeName, name)
				}
				if _, duplicate := seen[attributeName]; duplicate {
					return editorXMLInvalid("attribute %q is duplicated", attributeName)
				}
				if len(attribute.Value) > limits.MaxAttributeBytes {
					return editorXMLInvalid("attribute %q is too long", attributeName)
				}
				seen[attributeName] = struct{}{}
			}
			for _, attributeName := range required[name] {
				if _, ok := seen[attributeName]; !ok {
					return editorXMLInvalid("required attribute %q is missing on %q", attributeName, name)
				}
			}
			stack = append(stack, name)
		case xml.EndElement:
			if len(stack) == 0 || stack[len(stack)-1] != value.Name.Local {
				return editorXMLInvalid("layout XML has mismatched elements")
			}
			stack = stack[:len(stack)-1]
		case xml.CharData:
			if len(bytes.TrimSpace(value)) != 0 {
				return editorXMLInvalid("text content is not allowed")
			}
		case xml.Comment, xml.Directive, xml.ProcInst:
			return editorXMLInvalid("comments, directives and processing instructions are not allowed")
		}
	}
	if len(stack) != 0 {
		return editorXMLInvalid("layout XML is incomplete")
	}
	if counts["site-layout"] != 1 {
		return editorXMLInvalid("layout must contain exactly one root element")
	}
	return nil
}

func parseLayoutNode(raw layoutNodeXML, limits LayoutLimits) (LayoutNode, error) {
	pageID, err := parsePositiveInt64("page-id", raw.PageID)
	if err != nil {
		return LayoutNode{}, err
	}
	x, err := parseBoundedFloat("x", raw.X, -limits.MaxCoordinate, limits.MaxCoordinate, true)
	if err != nil {
		return LayoutNode{}, err
	}
	y, err := parseBoundedFloat("y", raw.Y, -limits.MaxCoordinate, limits.MaxCoordinate, true)
	if err != nil {
		return LayoutNode{}, err
	}
	width, err := parseBoundedFloat("width", raw.Width, 0, limits.MaxDimension, false)
	if err != nil {
		return LayoutNode{}, err
	}
	height, err := parseBoundedFloat("height", raw.Height, 0, limits.MaxDimension, false)
	if err != nil {
		return LayoutNode{}, err
	}
	node := LayoutNode{PageID: pageID, X: x, Y: y, Width: width, Height: height, View: raw.View}
	if err := validateLayoutNode(node, limits); err != nil {
		return LayoutNode{}, err
	}
	return node, nil
}

func parseLayoutConnection(raw layoutConnectionXML, limits LayoutLimits) (LayoutConnection, error) {
	fromID, err := parsePositiveInt64("from-id", raw.FromID)
	if err != nil {
		return LayoutConnection{}, err
	}
	toID, err := parsePositiveInt64("to-id", raw.ToID)
	if err != nil {
		return LayoutConnection{}, err
	}
	connection := LayoutConnection{FromID: fromID, ToID: toID}
	if (raw.BendX == "") != (raw.BendY == "") {
		return LayoutConnection{}, editorXMLInvalid("bend-x and bend-y must be provided together")
	}
	if raw.BendX != "" {
		bendX, err := parseBoundedFloat("bend-x", raw.BendX, -limits.MaxCoordinate, limits.MaxCoordinate, true)
		if err != nil {
			return LayoutConnection{}, err
		}
		bendY, err := parseBoundedFloat("bend-y", raw.BendY, -limits.MaxCoordinate, limits.MaxCoordinate, true)
		if err != nil {
			return LayoutConnection{}, err
		}
		connection.BendX = &bendX
		connection.BendY = &bendY
	}
	if err := validateLayoutConnection(connection, limits); err != nil {
		return LayoutConnection{}, err
	}
	return connection, nil
}

func validateLayoutNode(node LayoutNode, limits LayoutLimits) error {
	if node.PageID <= 0 {
		return editorXMLInvalid("page-id must be positive")
	}
	if node.View != "expanded" && node.View != "collapsed" {
		return editorXMLInvalid("unsupported layout view %q", node.View)
	}
	for name, value := range map[string]float64{"x": node.X, "y": node.Y} {
		if !finite(value) || math.Abs(value) > limits.MaxCoordinate {
			return editorXMLInvalid("%s is outside the allowed range", name)
		}
	}
	for name, value := range map[string]float64{"width": node.Width, "height": node.Height} {
		if !finite(value) || value <= 0 || value > limits.MaxDimension {
			return editorXMLInvalid("%s is outside the allowed range", name)
		}
	}
	return nil
}

func validateLayoutConnection(connection LayoutConnection, limits LayoutLimits) error {
	if connection.FromID <= 0 || connection.ToID <= 0 || connection.FromID == connection.ToID {
		return editorXMLInvalid("connection endpoints must be distinct positive IDs")
	}
	if (connection.BendX == nil) != (connection.BendY == nil) {
		return editorXMLInvalid("bend coordinates must be provided together")
	}
	for name, value := range map[string]*float64{"bend-x": connection.BendX, "bend-y": connection.BendY} {
		if value != nil && (!finite(*value) || math.Abs(*value) > limits.MaxCoordinate) {
			return editorXMLInvalid("%s is outside the allowed range", name)
		}
	}
	return nil
}

func effectiveLayoutLimits(limits LayoutLimits) LayoutLimits {
	defaults := defaultLayoutLimits
	if limits.MaxBytes <= 0 {
		limits.MaxBytes = defaults.MaxBytes
	}
	if limits.MaxNodes <= 0 {
		limits.MaxNodes = defaults.MaxNodes
	}
	if limits.MaxConnections <= 0 {
		limits.MaxConnections = defaults.MaxConnections
	}
	if limits.MaxAttributeBytes <= 0 {
		limits.MaxAttributeBytes = defaults.MaxAttributeBytes
	}
	if limits.MaxCoordinate <= 0 {
		limits.MaxCoordinate = defaults.MaxCoordinate
	}
	if limits.MaxDimension <= 0 {
		limits.MaxDimension = defaults.MaxDimension
	}
	return limits
}

func parsePositiveInt(name, value string) (int, error) {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, editorXMLInvalid("%s must be a positive integer", name)
	}
	return parsed, nil
}

func parsePositiveInt64(name, value string) (int64, error) {
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, editorXMLInvalid("%s must be a positive integer", name)
	}
	return parsed, nil
}

func parseBoundedFloat(name, value string, min, max float64, inclusiveMin bool) (float64, error) {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || !finite(parsed) || parsed > max || (inclusiveMin && parsed < min) || (!inclusiveMin && parsed <= min) {
		return 0, editorXMLInvalid("%s is outside the allowed range", name)
	}
	if parsed == 0 {
		parsed = 0
	}
	return parsed, nil
}

func marshalEditorXML(value any) ([]byte, error) {
	data, err := xml.MarshalIndent(value, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal editor XML: %w", err)
	}
	return append(data, '\n'), nil
}

func formatFloat(value float64) string {
	if value == 0 {
		value = 0
	}
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func finite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func editorXMLInvalid(format string, args ...any) error {
	message := strings.TrimSpace(fmt.Sprintf(format, args...))
	return fmt.Errorf("%w: %s", ErrInvalidEditorXML, message)
}
