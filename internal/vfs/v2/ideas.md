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
