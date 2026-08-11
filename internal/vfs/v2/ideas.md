# VFS authorization access plan idea

Make authorization for VFS methods explicit through a small per-method access plan.

Core idea:

- Each VFS method resolves its URI or URIs into `resolvedResource`.
- The method declares the required checks close to the operation.
- A common helper executes checks through `Authorizer.Can`.
- Targets may refer to the resource itself or to its base directory.

Suggested internal vocabulary:

- `self` - resolved resource itself.
- `parent` - parent directory of `self`.
- `source` - source resource for move-like operations.
- `source_parent` - source parent directory.
- `target` - target resource for move-like operations.
- `target_parent` - target parent directory.

Suggested default checks:

- `Stat(uri)` - `r` on `self`.
- `ReadDir(uri)` - `r` on `self`.
- `OpenFile(uri, read flags)` - `r` on `self`.
- `OpenFile(uri, write flags)` - `w` on `self`.
- `OpenFile(uri, O_CREATE)` - `w` on `parent`.
- `Mkdir(uri)` - `w` on `parent`.
- `Delete(uri)` - `w` on `self` and `parent`.
- `Move(source, target)` - `w` on `source`, `source_parent`, and `target_parent`.
- `Control(uri)` - `x` on `self`.

Parent checks should be built by copying the same `ResourceRef` identity and replacing only `Path` with `path.Dir(path.Clean("/" + ref.Path))`.

The helper should deduplicate identical `(actor, action, ResourceRef)` checks inside one operation.

# Provider router idea

Build a small routing framework for complex VFS providers.

The VFS core should continue to depend on the stable `FSProvider` interface:

- `Stat`
- `ReadDir`
- `OpenFile`
- `Mkdir`
- `Move`
- `Delete`
- `Control`

But a provider implementation should be allowed to be assembled from route handlers instead of manually implementing a large `switch` over paths.

Core idea:

- A provider registers route patterns such as `/scopes/{scopeKey}` or `/scopes/{scopeKey}/connections/{providerKey}/{connectionKey}.json`.
- The provider router implements `FSProvider`.
- Each `FSProvider` method is translated into an internal provider request.
- The router matches the request path and operation, extracts route params, and calls the matching handler.
- Simple providers may still implement `FSProvider` directly.

Example shape:

```go
r.ReadDir("/", p.root)
r.ReadDir("/scopes", p.listScopes)
r.Stat("/scopes/{scopeKey}", p.statScope)
r.OpenFile("/scopes/{scopeKey}/meta.json", p.readScopeMeta)
r.Control("/scopes", "create-scope", p.createScope)
r.Delete("/scopes/{scopeKey}", p.deleteScope)
```

Why this is useful:

- Virtual providers are closer to structured APIs than to real disk filesystems.
- Providers like `scopes`, `acl`, `users`, or `functions` will have many virtual paths, JSON views, and command endpoints.
- A router avoids repetitive and fragile `strings.Split` / `path.Clean` / manual parameter extraction in every provider.
- Route declarations document the provider surface in one place.
- Handlers stay small and focused on domain behavior.
- The core VFS contract remains stable, so existing direct providers do not need to change.
- ACL and lifecycle checks remain centralized in `VFSCore`; the router only handles provider-local dispatch.

Suggested internal request vocabulary:

- `Operation` - `stat`, `read_dir`, `open_file`, `mkdir`, `move`, `delete`, `control`.
- `Path` - provider-local clean path.
- `Params` - route variables extracted from the pattern.
- `Flags` - open flags for `OpenFile`.
- `Command` - control command for `Control`.
- `Input` - control input bytes.

Important boundary:

Provider routing must not become a second authorization layer.

The intended flow is:

```text
VFSCore
  resolve URI -> scope -> connection
  check ACL
  get provider
  call FSProvider method

Provider router
  match operation + path
  extract params
  call provider handler
```

This keeps security and lifecycle behavior in one place while making virtual providers much easier to implement.

The first good candidate for this framework is the `scopes` provider:

```text
scopes@scopes[system]:///
  scopes/
    {scopeKey}/
      meta.json
      connections/
        {providerKey}/
          {connectionKey}.json
  principals/
    {principalType}/
      {principalID}/
        default-scope
```

The `scopes` provider can validate whether the router API is pleasant before using it for other system providers.
