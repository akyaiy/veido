# scopes provider

`scopes` is a system provider for looking at VFS v2 itself from inside VFS v2.

Most providers adapt some outside storage: local files, S3, WebDAV, GitHub, a
database, and so on. This provider is different. It exposes VFS metadata as a
small virtual filesystem.

In practice it answers questions like:

- which scopes are visible to the current actor;
- which provider connections exist inside a scope;
- what basic metadata is known about a scope, provider, or connection.

It is useful for debugging, WebDAV/file-manager browsing, admin tools, tests,
and UI code that wants to inspect the current VFS shape without reaching
directly into storage tables.

## Behavior

The provider is mostly read-only.

It supports directory browsing, generated metadata files, creating user scopes,
and deleting non-system scopes. Attempts to move resources or write regular
content should fail with permission-style errors.

Creating a directory under the scopes listing creates a new user-owned scope.
The owner is the full actor key, for example `user:42`, and the created scope
kind is `user`.

The visible name entered by the user is not used as the full global scope key.
The provider prefixes it with the first six hex characters of the SHA-256 hash
of the actor key:

```text
<actor-hash>-<requested-name>
```

For example, actor `user:42` creating `work` becomes something like
`ea3fd4-work`.

This is intentional because scope keys are global. The prefix makes it harder
for one actor to casually reserve short attractive names for everyone else.

Requested names may contain only ASCII letters, digits, `-`, and `_`.

Deleting a scope is allowed only for non-system scopes. A scope with kind
`system` is protected and must not be deleted through this provider.

Provider connections live under a scope's `connections` directory:

```text
/scopes/<scope-key>/connections/<provider-key>@<connection-key>/
```

Creating that directory creates a connection with empty `{}` config,
`status: "active"`, and `ready: false`. The connection is visible, but the VFS
resolver will not use it until `ready` is set to `true`.

Each connection directory exposes:

- `info.json` as a read-only snapshot;
- `config.json` as the writable provider config;
- `status.json` as the writable status/ready file.

Saving `config.json` requires valid JSON. Saving `status.json` accepts fields
such as:

```json
{
  "ready": true
}
```

or:

```json
{
  "status": "disabled",
  "ready": false
}
```

Metadata files such as `info.json` are synthetic. They are generated when opened
and are meant for humans, debuggers, WebDAV clients, and simple integrations.
They should be treated as a view of current state, not as stable database
exports or a public API contract.

## Implementation Style

The provider is built on `internal/vfs/v2/virtfs`.

That keeps the provider from hand-writing the same routing logic in `Stat`,
`ReadDir`, `OpenFile`, `Mkdir`, and `Delete`. The virtual tree is described
once, and `virtfs` handles the boring filesystem defaults:

- missing paths return `os.ErrNotExist`;
- directories are not opened as files;
- generated files are read-only;
- unsupported mutating operations are denied by default;
- unsupported control commands return `vfs.ErrNotImplemented`.

This matters for WebDAV especially. WebDAV clients call filesystem methods in
combinations that are easy to forget when a provider is written by hand.

## Intended Use

Register this provider as a normal VFS provider, usually under the provider key
`scopes`, with a system connection.

It should receive storage dependencies through `DI`:

- `Scopes` for scope lookup, creation, listing, and deletion;
- `Connections` for provider and connection lookup.

The authorization decision still belongs to the VFS core. The provider assumes
it is called after the core has resolved the actor, scope, connection, and access
checks.

## Non-Goals

This provider is not a general management API.

It can create and delete ordinary user scopes and basic provider connections,
but it should not silently perform remote side effects. More dangerous behaviors
such as credential rotation, remote probes, rescans, or migrations should be
explicit and reviewed carefully, probably through VFS `Control` commands or
clearly named command-like virtual files.

It also should not become a second source of truth. The source of truth remains
the VFS storage layer; this provider only presents that state in a filesystem
shape.
