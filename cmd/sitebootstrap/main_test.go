package main

import (
	"encoding/json"
	"os"
	"testing"
)

func TestCheckedInManifestDecodesRequiredFields(t *testing.T) {
	data, err := os.ReadFile("../../site.bootstrap.json")
	if err != nil {
		t.Fatal(err)
	}
	var value manifest
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	if value.ScopeName == "" || value.Site.Connection == "" || value.Site.TemplateSource == "" || value.Site.TemplateVersion == "" {
		t.Fatalf("required bootstrap values were not decoded: %+v", value.Site)
	}
}
