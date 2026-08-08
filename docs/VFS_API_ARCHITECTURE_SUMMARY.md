# VFS API Architecture Summary

## Purpose

The VFS API gives the project one way to address different resources as a tree of files and directories.

A user, external client, or internal service can work with local files, system entities, functions, shared resources, and remote storage through one language:

```text
provider + connection + scope + path + method
```

The VFS API is responsible for:

- accepting a resource address and a filesystem-like operation;
- resolving the address into a concrete provider and scope;
- forwarding the operation to the provider;
- keeping internal services free to store data in databases, services, remote APIs, or real files.

## When It Is Used

This model is used when the system needs to:

- expose file navigation for UI, WebDAV, or API clients;
- use one contract for local, shared, users, functions, gdrive, s3, github, and other providers;
- address resources that belong to different users, projects, or system scopes;
- separate stable resource identity from convenient mount paths;
- run provider-specific commands through `Control` without turning query strings into operations.

## How It Works

The main flow is:

1. A client sends a canonical URI or a human-oriented mount path.
2. VFS reads the actor from context.
3. If the input is a mount path, the system resolves it inside the current scope.
4. The URI is parsed into provider, connection, scope, path, and query.
5. The resolver finds the effective scope and provider connection.
6. The provider receives the operation in its own data model.
7. ACL checks access to the scope and target resource.
8. The provider runs the filesystem method or `Control`.
9. VFS returns files, directories, content, or an error.

## Components

- `ResourceURI` describes the external resource address.
- `ResourceResolver` or `VFSRouter` parses URI, scope, and connection.
- `MountManagerFSProvider` maps mount paths to canonical URIs.
- `FSProvider` defines the syscall-like contract for reading, writing, listing, deleting, and moving.
- Storage providers persist bytes and metadata.
- Remote adapter providers adapt external APIs to the VFS contract.
- Projection providers expose application domain models as files and directories.
- ACL decides whether an actor may perform an operation on a resolved resource.

## Example

A user opens a file:

```text
/my-343123/home/docs/report.md
```

The system resolves the path:

```text
/my-343123/home/docs/report.md
  -> scope:1
  -> mount /home
  -> local@default[scope:1]:///docs/report.md
  -> ResourceRef(metadata:105)
```

VFS then checks access to the scope and file. If access is allowed, the `local` provider opens the file and returns its content.

## Limits

- The VFS API does not require all internal data to be stored as real files.
- A mount path is not the stable identity of a resource.
- Query is only for filters, formats, versions, or views, not primary operations.
- Ordinary CRUD stays in VFS methods, while provider-specific commands use `Control` or action files.
- Each provider remains responsible for its own semantics and write validation.

## Architecture Decision Records

### ADR-001: Provider-First URI

#### Context

The project has different resource types: local files, system entities, functions, shared overlays, and remote providers.

#### Problem

A plain path does not preserve provider identity and becomes ambiguous for Google Drive, S3, GitHub, system providers, and per-user connections.

#### Options

- store all resources in one global path namespace;
- use mount paths as the primary identity;
- introduce provider-first canonical URIs.

#### Decision

Use this format:

```text
<provider>[@<connection>][<scope>]:///<path>?<query>
```

#### Consequences

Each resource gets a stable address for APIs, ACL, logs, and internal services. Mount paths remain convenient aliases for navigation.

### ADR-002: `Control` For Provider-Specific Commands

#### Context

Some providers need commands that are not ordinary read, write, delete, or list operations.

#### Problem

If commands are encoded in query strings, the URI starts answering both "what is this?" and "what should happen?".

#### Options

- encode operations in query;
- create separate REST endpoints for each provider;
- add a syscall-like `Control` method.

#### Decision

Keep ordinary CRUD in VFS methods and run provider-specific commands through `Control` or action files.

#### Consequences

Methods, path, and query keep clear roles. File-oriented clients can use action files, while API-native clients can use `Control`.

## Implementation Details

### Core Idea

Project API can be represented as a Unix-like virtual file system.

External clients do not have to call many unrelated REST endpoints directly. They can interact with resources through a tree of directories and files:

```text
users@system:///"admin - 1"/userdata.json
functions@system:///resize-image/source.go
shared@me:///project/file.md
gdrive@work:///My Drive/report.docx
```

This does not mean the internals must be implemented as real files. The file-system model is an external API language. Internally, providers may use databases, services, cloud APIs, auth modules, function runners, or ordinary file storage.

### 2. Current Project Fit

The existing project already has the right foundation:

- `internal/vfs` defines the basic VFS layer.
- `FSProvider` already exposes filesystem-like operations:
  - `ResolvePathToID`
  - `ReadDir`
  - `OpenFile`
  - `Stat`
  - `Mkdir`
  - `Move`
  - `Delete`
- `MountManagerFSProvider` already routes operations through mounted providers.
- WebDAV already adapts the VFS into an external protocol.
- `/api/files/acc2fs` already exposes VFS operations over HTTP.
- `SharedFSProvider` already proves that providers can expose dynamic virtual resources without owning real files.

So the architecture does not need to be invented from scratch. It needs to be made explicit and generalized.

### 3. Important Insight From SharedFSProvider

`SharedFSProvider` is the best current example of a projection provider.

It does not store files itself. Instead, it:

1. Shows a virtual tree to the user.
2. Resolves virtual paths into real VFS node IDs.
3. Delegates real operations to a bound provider.
4. Returns virtual paths back to the caller.

Conceptually:

```text
SharedFSProvider:
  virtual path -> real VFS node id -> bindProvider operation
```

The same pattern can be used for system modules:

```text
UsersFSProvider:
  virtual path -> user id / field / action -> auth/db/service operation

FunctionsFSProvider:
  virtual path -> function name / source / action -> function service operation

GDriveFSProvider:
  virtual path -> remote file id / folder id -> remote provider API operation
```

This means `FSProvider` is not only for storage providers. It is also suitable for dynamic projections over application state.

### 4. Provider Types

A useful mental split:

```text
Storage providers:
  LocalFSProvider
  HostFSProvider

Remote adapter providers:
  GDriveFSProvider
  S3FSProvider
  GitHubFSProvider
  WebDAVProvider

Projection providers:
  UsersFSProvider
  FunctionsFSProvider
  ACLProvider
  HTMLBlocksProvider

Overlay/routing providers:
  SharedFSProvider
  MountManagerFSProvider
```

A storage provider mainly persists bytes and metadata.

A projection provider exposes some domain model as files and directories.

A routing provider resolves paths or URIs into the correct provider.

### 5. Canonical Resource URI Model

The preferred model is provider-first:

```text
<provider>[@<connection>][<scope>]:///<path>?<query>
```

Examples:

```text
local@default:///home/user/a.txt
shared@me:///project/file.md
users@system:///"admin - 1"/userdata.json
functions@system:///resize-image/source.go
gdrive@work:///My Drive/report.docx
s3@assets-bucket:///images/logo.png
github@triggerssmith:///JWTproject2/main/internal/vfs/vfs.go
gdrive@work[user:42]:///My Drive/report.docx
```

Meaning:

```text
provider   = provider type: local, shared, users, functions, gdrive, s3, github
connection = optional provider instance/account/bucket/repo/connection key
scope      = optional explicit owner/security context, such as [user:42]
path       = resource path inside that provider connection
query      = read/list/stat/open modifiers, not the main operation
```

This avoids ambiguity when different providers have different semantics.

For example:

- Google Drive can have duplicate names and file IDs.
- S3 has object keys, not real directories.
- GitHub writes may mean commits.
- System providers may expose actions that change application state.
- Local files behave closer to POSIX.

The URI should preserve provider identity instead of hiding everything inside one plain path.

### 6. Mount Paths As Aliases

Mount paths are still useful, but they should be treated as aliases, not as the canonical identity of a resource.

Examples:

```text
/home                  -> local@default:///home/user
/shared                -> shared@me:///
/system/users          -> users@system:///
/system/functions      -> functions@system:///
/cloud/google/work     -> gdrive@work:///
/projects/acme/drive   -> gdrive@client-acme:///
```

Rule:

```text
Canonical URI is the stable identity.
Mount path is a convenient navigation alias.
```

This keeps the Unix-like feel while avoiding chaos from arbitrary system resources being mounted inside arbitrary user folders.

### 7. Methods, Path, Query, And Control

The VFS should keep a syscall-like separation:

```text
method + URI + options
```

The method expresses the operation:

```text
ReadDir(ctx, uri)
OpenFile(ctx, uri, flags)
Stat(ctx, uri)
Mkdir(ctx, uri)
Move(ctx, oldURI, newURI)
Delete(ctx, uri)
Control(ctx, uri, command, input)
```

The path expresses the target resource:

```text
users@system:///"admin - 1"/userdata.json
functions@system:///resize-image/source.go
gdrive@work:///My Drive/report.docx
```

The query expresses a modifier, filter, version, format, or view:

```text
users@system:///?status=active
gdrive@work:///doc123?export=pdf
github@repo:///file.go?ref=main
s3@bucket:///file.txt?versionId=abc
```

Do not use query to replace methods.

Bad:

```text
users@system:///"admin - 1"/userdata.json?op=write
users@system:///?op=list
functions@system:///resize?run=true
```

Good:

```text
OpenFile(users@system:///"admin - 1"/userdata.json, O_WRONLY)
ReadDir(users@system:///?status=active)
Control(functions@system:///resize, "run", input)
```

Short rule:

```text
Path answers: what is this?
Method answers: what to do?
Query answers: which representation, version, filter, or mode?
Control answers: which provider-specific command?
```

### 8. Query As Ioctl-Lite

`query` can be thought of as a lightweight, declarative cousin of `ioctl`, but only for modifiers.

Good query usage:

```text
gdrive@work:///doc123?export=pdf
github@project:///file.go?ref=main
s3@bucket:///file.txt?versionId=abc
users@system:///?status=active
```

Poor query usage:

```text
users@system:///admin?do=ban
local@default:///a.txt?delete=true
functions@system:///resize?run=true
```

Those are commands, not representation modifiers. They belong in `Control`, action files, or ordinary VFS methods.

### 9. Control Method

`Control` is useful and should be added as the provider-specific command mechanism.

Suggested shape:

```go
Control(ctx context.Context, id ResourceID, command string, in []byte) ([]byte, error)
```

Or, if the URI model is introduced directly:

```go
Control(ctx context.Context, uri ResourceURI, command string, in []byte) ([]byte, error)
```

Normal use cases:

```text
Control(gdrive@work:///doc123, "export", {"format":"pdf"})
Control(gdrive@work:///, "sync", {})
Control(functions@system:///resize-image, "run", {"input":"..."})
Control(users@system:///"admin - 1", "reset-password", {"newPassword":"..."})
Control(local@default:///video.mp4, "thumbnail", {"time":"00:01:20"})
```

Boundary rule:

```text
If it is normal file or directory behavior, use the normal VFS method.
If it reads or writes file content, use OpenFile.
If it manages provider-specific behavior or invokes a capability, use Control.
```

Avoid putting ordinary CRUD into `Control`.

### 10. Action Files

Some commands can also be represented as special files:

```text
functions@system:///resize-image/run.action
users@system:///"admin - 1"/password.action
gdrive@work:///.sync.action
```

This is useful when the command fits the filesystem metaphor and should be accessible through file-oriented clients.

Recommended distinction:

```text
Control:
  internal/API-native provider command

*.action files:
  file-oriented command facade for clients and UI
```

Both can call the same underlying service logic.

### 11. Users Provider Example

Potential user tree:

```text
users@system:///
  "admin - 1"/
    userdata.json
    groups.json
    permissions.json
    password.action
    sessions/
  "user1 - 2"/
    userdata.json
```

Behavior:

```text
ReadDir(users@system:///)
  lists users as virtual directories

OpenFile(users@system:///"admin - 1"/userdata.json, O_RDONLY)
  returns dynamic JSON from the database

OpenFile(users@system:///"admin - 1"/userdata.json, O_WRONLY)
  accepts JSON, validates it, and applies updates through the user service

Delete(users@system:///"admin - 1")
  deletes or disables the user, depending on chosen semantics

Control(users@system:///"admin - 1", "reset-password", input)
  runs provider-specific user command
```

Important detail:

Writing `userdata.json` does not mean bytes are blindly stored. It means the provider accepts a proposed new representation, validates it, and applies allowed changes. If validation fails, the write returns an error.

### 12. Multiple Provider Connections

A single user may connect several instances of the same provider type. Google Drive is only one example; the same rule applies to S3, GitHub, WebDAV, external databases, project stores, and other providers.

Use `@connection` as the connection key in the current user context:

```text
gdrive@personal:///
gdrive@work:///
s3@assets:///
s3@backups:///
github@main-org:///
github@client-acme:///
```

For user `42`:

```text
gdrive@personal:///...     -> connection(default-scope(user:42), provider:gdrive, name:personal)
gdrive@work:///...         -> connection(default-scope(user:42), provider:gdrive, name:work)
s3@assets:///...           -> connection(default-scope(user:42), provider:s3, name:assets)
github@client-acme:///...  -> connection(default-scope(user:42), provider:github, name:client-acme)
```

For user `17`, the same visible URI can resolve to that user's own connection:

```text
gdrive@personal:///...     -> connection(default-scope(user:17), provider:gdrive, name:personal)
s3@assets:///...           -> connection(default-scope(user:17), provider:s3, name:assets)
```

So `gdrive@personal:///` or `s3@assets:///` is unique within the current security context, not globally.

An administrator can address another user's connection explicitly through `scope`:

```text
gdrive@work[user:42]:///My Drive/report.docx
s3@assets[user:42]:///images/logo.png
github@client-acme[user:42]:///repo/main/a.go
```

Recommended normalized tables:

```text
scopes
  id
  kind
  slug
  display_name
  owner_subject_key
```

```text
principal_default_scopes
  principal_type
  principal_id
  purpose
  scope_id
```

```text
provider_connections
  id
  scope_id
  provider_type      // gdrive, s3, github, etc.
  connection_key     // personal, work, assets, client-acme
  config_json
```

Recommended uniqueness:

```text
UNIQUE(scope_id, provider_type, connection_key)
```

This allows:

- one user to have many connections for the same provider type;
- different users to reuse names like `personal` or `work`;
- one user to have multiple scopes, each with its own provider connections;
- canonical resolution to remain unambiguous inside the server.

### 13. Provider Root Behavior

Useful behavior:

```text
ReadDir(gdrive:///)
ReadDir(s3:///)
ReadDir(github:///)
```

Returns the current user's connections for that provider type:

```text
personal/
work/
client-acme/
assets/
backups/
```

Then:

```text
ReadDir(gdrive@work:///)
ReadDir(s3@assets:///)
ReadDir(github@client-acme:///)
```

Lists the root of that concrete provider connection.

This gives a clean navigation model:

```text
gdrive:///                          list my Google Drive connections
gdrive@work:///                     root of my work Drive connection
gdrive@work:///My Drive/a.txt       file inside that connection

s3:///                              list my S3 connections
s3@assets:///images/logo.png        object inside my assets connection

github:///                          list my GitHub connections
github@client-acme:///repo/main/a.go file inside my client-acme connection
```

### 14. Internal Stable References

Human-facing URIs can be context-relative:

```text
gdrive@work:///My Drive/a.txt
```

For internal durable references, use a connection ID or provider resource ID:

```text
gdrive@conn-8842:///My Drive/a.txt
gdrive@conn-8842:///file-id:abc123
gdrive@work:///file-id:abc123
```

Human-facing URI:

```text
gdrive@work:///My Drive/a.txt
```

Resolved internal identity:

```text
provider_type = gdrive
connection_id = 8842
external_file_id = abc123
```

The UI should normally show friendly names. The server should keep stable IDs where long-lived references matter.

### 15. Mount Namespaces

Mounts should probably be scoped, not purely global.

Possible mount table:

```text
mounts
  scope_id
  mount_path
  target_uri
  flags
```

Examples:

```text
scope 1, default scope of user 42:
  /cloud/google/personal -> gdrive@personal:///
  /cloud/google/work     -> gdrive@work:///

scope 2, default scope of user 17:
  /cloud/google/personal -> gdrive@personal:///
```

The same mount path can mean different things for different users, because it resolves inside their namespace.

### 16. Three Addressing Modes

There are three practical ways to address VFS resources.

#### 1. Canonical URI

Canonical URI is the primary internal/API address:

```text
local@default[scope:1]:///projects/demo
gdrive@work[scope:1]:///My Drive/report.docx
functions@system:///resize-image
shared@me:///demo/readme.md
```

Use canonical URI for:

```text
browser clients
internal services
ACL/resource resolver
logs and audit
long-lived API references
```

Internally, all non-canonical addressing should resolve into canonical URI first, and then into stable `ResourceRef`.

#### 2. Scope path namespace

For WebDAV, file managers, manual browsing, and debug UX, VFS can expose a simple path namespace:

```text
/{scope-name-id}/{mount}/...
```

Do not use `/scopes/1/...` as the user-facing path. Scope names only need to be unique in the list visible to the current actor, and shared scopes can also appear there. Use friendly but collision-resistant aliases:

```text
/my-343123/home/projects/demo
/archive-771204/home/old/a.txt
/project-acme-9981/gdrive/report.docx
/shared-from-alex-5502/home/demo/readme.md
```

Inside a scope path namespace, the next path segment is a mount alias:

```text
/my-343123/home/...       -> local@default[scope:1]:///...
/my-343123/gdrive/...     -> gdrive@work[scope:1]:///...
/my-343123/shared/...     -> shared@me[scope:1]:///...
```

If the mount target omits explicit scope:

```text
/my-343123/home/a.txt
  -> /my-343123 resolves to scope:1
  -> /home resolves to local@default:///
  -> final canonical URI is local@default[scope:1]:///a.txt
```

#### 3. Root scope listing

Opening `/` should not expose a global filesystem root. It should list scopes accessible to the current actor:

```text
/
  my-343123/
  archive-771204/
  project-acme-9981/
  shared-from-alex-5502/
```

To list a scope at `/`, the actor should have at least scope visibility/access:

```text
Can(actor, r, scope@system:///scopes/{scope_id})
or
Can(actor, x, scope@system:///scopes/{scope_id})
```

For WebDAV, it is usually simpler to list only scopes where the actor has `x`, because clients expect visible folders to be enterable.

Rule:

```text
/                                 -> list accessible scopes
/{scope-name-id}/                 -> list mounts inside that scope
/{scope-name-id}/{mount}/...      -> sugar path through mount namespace
provider@conn[scope]:///...       -> canonical URI
ResourceRef                       -> stable ACL identity
```

Important:

```text
Path namespaces are sugar.
Canonical URI is the internal address.
ResourceRef is the ACL identity.
```

For browser clients and internal API calls, prefer canonical URI. For WebDAV and human filesystem browsing, expose the sugar path namespace.

### 17. Multi-User VFS Model

The new URI model changes the old assumption that every VFS path is resolved relative to the current user's home directory.

Instead, VFS should separate:

```text
actor = who performs the operation
scope = whose namespace/provider connection is addressed
target = concrete resource URI
```

Example:

```text
local@default:///docs/a.txt
```

For user `42`, this means:

```text
actor = user:42
scope = implicit user:42
provider = local
connection = default
path = /docs/a.txt
```

An administrator can explicitly address another user's local namespace:

```text
local@default[user:17]:///docs/a.txt
```

That means:

```text
actor = user:42
scope = user:17
target = local default connection of user 17
```

Authorization should then ask:

```text
Can actor user:42 perform operation X on resource local@default[user:17]:///docs/a.txt?
```

This is different from the current `FSManager` assumption:

```text
current user -> home node id -> all paths are relative to that home
```

The new model is:

```text
current actor -> parse URI -> resolve effective scope -> resolve provider connection -> authorize -> call provider
```

### 18. Local As A Per-Scope Provider

In this model, `local` is not the global VFS root. It is a provider connection inside a concrete scope.

If scope is omitted, `local@default:///` inherits the effective scope from the actor or from the sugar path.

For actor `user:42`:

```text
local@default:/// -> default scope user:42 -> provider_connection(scope:1, local, default)
```

For actor `user:17`:

```text
local@default:/// -> default scope user:17 -> provider_connection(scope:2, local, default)
```

If scope is explicit:

```text
local@default[scope:1]:///docs/a.txt
  -> provider_connection(scope:1, local, default)

local@default[user:17]:///docs/a.txt
  -> default scope user:17
  -> provider_connection(scope:2, local, default)
```

The ordinary path root `/` is not the `local` root. It lists accessible scopes:

```text
/
  my-343123/
  project-acme-9981/
  shared-from-alex-5502/
```

Mounts appear only after selecting a scope:

```text
/my-343123/home   -> local@default[scope:1]:///
/my-343123/shared -> shared@me[scope:1]:///
```

This keeps `local` as an ordinary provider, while `/` remains a useful scope browser for WebDAV and human file browsing.

### 19. Scope Storage And ACL

`scope` should not live inside the path. It should be parsed from the URI and resolved into a normalized scope record.

```go
type ScopeRef struct {
    ID   int64
    Kind string // personal, system, org, project, team, service
    Slug string // main, archive, acme, backend
}
```

If scope is omitted:

```text
scope = actor default scope
```

Examples:

```text
local@default:///docs/a.txt
  -> actor user scope

local@default[user:17]:///docs/a.txt
  -> explicit user:17 scope

users@system:///
  -> system scope
```

Scopes should be first-class resources:

```text
scopes
  id
  kind                 // personal, system, org, project, team, service
  slug                 // main, archive, acme, backend
  display_name
  owner_subject_key    // optional owner fallback: user:7, org:3, system
  created_at
  updated_at
```

Important rule:

```text
scopes define resource spaces.
ACL defines who can enter, read, manage, or delegate those spaces.
```

Do not create a second authorization system such as `scope_owners` unless it is only metadata. Scope access should be checked through the same ACL model as every other resource.

A scope can be represented as an ACL resource:

```text
scope@system:///scopes/42
```

Suggested scope permission meaning:

```text
r = see/list the scope
w = manage scope settings, mounts, and provider connections
x = enter/use the scope as an effective target scope
```

Example ACL checks:

```text
Can(user:42, x, scope@system:///scopes/17-main)
Can(user:42, w, scope@system:///scopes/17-main)
Can(group:admin, x, scope@system:/// recursive)
```

`owner_subject_key` is only an owner fallback, consistent with the ACL document's owner-default idea:

```text
explicit deny beats owner fallback
owner fallback beats default deny
```

Provider connections should reference `scope_id`, not `owner_type/owner_id` directly:

```text
provider_connections
  id
  scope_id
  provider_type      // local, gdrive, s3, functions, users, shared
  connection_key     // default, work, system, me, assets
  config_json
  status
  created_at
  updated_at
```

Recommended uniqueness:

```text
UNIQUE(scope_id, provider_type, connection_key)
```

Example records:

```text
scope_id  provider_type  connection_key  config_json
1         local          default          {"root_node_id":"105"}
2         local          default          {"root_node_id":"220"}
1         gdrive         work             {"credentials_ref":"..."}
0         functions      system           {"root":"functions"}
0         users          system           {}
1         shared         me               {}
```

The provider receives resolved configuration. It should not guess which user or connection it belongs to.

To resolve `[user:17]` when a user can have more than one scope, keep default scope mappings:

```text
principal_default_scopes
  principal_type   // user, org, service, system
  principal_id
  purpose          // default, local, functions, admin
  scope_id
```

Then:

```text
local@default[user:17]:///docs/a.txt
  -> resolve default scope for user:17
  -> find local@default inside that scope

local@default[scope:88]:///docs/a.txt
  -> use scope 88 directly
  -> check ACL before entering it
```

Mounts should also reference `scope_id`:

```text
mounts
  id
  scope_id
  mount_path
  target_uri
  flags
```

This keeps the model clean:

```text
scopes = resource spaces
provider_connections = provider instances inside scopes
mounts = friendly aliases inside scopes
resource_acl = all authorization, including scope entry and management
```

### 20. Resolver Pipeline

A `ResourceResolver` or future `VFSRouter` should own the routing work that `FSManager` currently mixes with home-directory assumptions.

Pipeline:

```text
1. Parse ResourceURI
2. Read actor from context
3. Resolve effective scope:
   - explicit [user:17]
   - explicit [scope:88]
   - implicit actor scope
   - provider default, such as users@system -> system
4. Resolve scope record
5. Authorize actor can enter/manage the scope through ACL
6. Find provider_connection by provider + connection + scope_id
7. Resolve target resource identity
8. Authorize actor can perform r/w/x on target resource
9. Build or reuse FSProvider instance from connection config
10. Call provider method with URI path
```

This turns VFS from a "current user's file manager" into a resource router.

Old mental model:

```text
global filesystem root
  /users/42/home
  /users/17/home
```

New mental model:

```text
path root lists accessible scopes
  /my-343123/
  /project-acme-9981/

selected scope lists its mounts
  /my-343123/home              -> local@default[scope:1]:///
  /my-343123/shared            -> shared@me[scope:1]:///
  /my-343123/cloud/google/work -> gdrive@work[scope:1]:///
```

### 21. Recommended Implementation Direction

Start with a small, concrete pilot:

```text
UsersFSProvider
```

It should expose:

```text
users@system:///
users@system:///"admin - 1"/
users@system:///"admin - 1"/userdata.json
```

This pilot will test the key ideas:

- dynamic directories;
- JSON files backed by services and DB;
- validation-on-write;
- action/control operations;
- URI parsing;
- provider-specific behavior;
- compatibility with existing VFS methods.

After that, extend the same pattern to:

```text
functions@system:///
shared@me:///
gdrive:///
system@default:///
```

### 22. Main Architectural Rule

Do not turn the filesystem metaphor into an internal religion.

Use VFS as the external API and integration model:

```text
outside: files, dirs, URIs, methods
inside: services, DB, providers, cloud APIs, domain logic
```

This keeps the Unix-like power without forcing every internal module to pretend it is actually a filesystem.

### 23. Final Position

The best direction is:

```text
provider-first canonical addressing
mount paths as aliases
FSProvider as syscall-like contract
projection providers for system modules
Control for provider-specific commands
query for declarative modifiers only
context-scoped provider connections for per-user cloud accounts
local as a per-scope mounted provider
user-visible root as a mount namespace, not the global root
simple path namespace for WebDAV and human browsing
canonical URI as the internal address for clients/services
```

In short:

```text
Canonical URI identifies the resource.
VFS method performs the operation.
Query modifies representation or selection.
Control performs provider-specific commands.
Mounts make navigation pleasant.
Providers keep their real internal semantics.
```
