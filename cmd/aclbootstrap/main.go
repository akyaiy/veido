// aclbootstrap creates the initial protected policy-admin grants locally.
package main

import (
	aclv2 "github.com/akyaiy/veido/internal/acl/v2"
	"github.com/akyaiy/veido/internal/common"
	"github.com/akyaiy/veido/internal/database/schema"
	"github.com/akyaiy/veido/internal/sqliteDB"
	aclprovider "github.com/akyaiy/veido/internal/vfs/v2/providers/acl"
	htmlprovider "github.com/akyaiy/veido/internal/vfs/v2/providers/html"
	localprovider "github.com/akyaiy/veido/internal/vfs/v2/providers/local"
	usersprovider "github.com/akyaiy/veido/internal/vfs/v2/providers/users"
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
)

func main() {
	dbPath := flag.String("db", "", "SQLite database path")
	subject := flag.String("admin-subject", "", "trusted admin subject, e.g. user:1")
	flag.Parse()
	if *dbPath == "" || *subject == "" {
		log.Fatal("-db and -admin-subject are required")
	}
	db, err := sqliteDB.Open(context.Background(), *dbPath, sqliteDB.Options{})
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := schema.Migrate(context.Background(), db, localprovider.MigrationGroup(), htmlprovider.MigrationGroup(), usersprovider.MigrationGroup(), aclprovider.MigrationGroup()); err != nil {
		log.Fatal(err)
	}
	store, err := aclv2.NewStore(db)
	if err != nil {
		log.Fatal(err)
	}
	for _, grant := range []struct {
		target    common.ResourceRef
		action    string
		recursive bool
	}{
		{common.ResourceRef{ProviderKey: "scopes", ConnectionKey: "scopes", ScopeKey: "system", Path: "/scopes/system"}, "x", false},
		{common.ResourceRef{ProviderKey: "acl", ConnectionKey: "acl", ScopeKey: "system", Path: "/control-plane"}, "x", false}, {common.ResourceRef{ProviderKey: "acl", ConnectionKey: "acl", ScopeKey: "system", Path: "/policies"}, "r", true}, {common.ResourceRef{ProviderKey: "acl", ConnectionKey: "acl", ScopeKey: "system", Path: "/policies"}, "x", true},
	} {
		input := aclv2.RuleInput{SubjectKey: *subject, Action: aclv2Action(grant.action), Effect: aclv2.EffectAllow, Priority: 100, Recursive: grant.recursive, CreatedByActor: "bootstrap", ManagerSubjectKey: "service:bootstrap", ManagerMode: "full", State: "active"}
		_, err := store.CreateManagedRule(context.Background(), grant.target, input, true)
		if err != nil && !errors.Is(err, aclv2.ErrConflict) {
			log.Fatal(err)
		}
	}
	fmt.Println("ACL policy-admin bootstrap grants are ready")
}
func aclv2Action(action string) common.Action { return common.Action(action) }
