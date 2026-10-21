# VFS v2 provider SDK

Read the [provider authoring guide](../../docs/VFS_V2_PROVIDER_SDK_RU.md) for
virtual resources, ordinary filesystem backends, composition and testing.

Create a runnable example from the repository root:

```sh
go run ./cmd/vfsprovider new -dir ./myprovider -key example -kind virtual
go test ./myprovider
go run ./myprovider
```

Use `-kind filesystem` for an ordinary read-only filesystem starting point.
Mutable filesystems can implement `FSProvider` directly or use
`providersdk.FromBackend` and its optional write interfaces.

| Package | Responsibility |
| --- | --- |
| `vfs` | Public provider/file contracts, actor context and errors |
| `providersdk` | Resource tree, typed documents/commands, filesystem adapters, composition, definitions/catalog |
| `providertest` | Disposable real VFS core and bounded tree checks |
| `providerdev` | Local inspector, HTTP API and WebDAV development server |
| `adapters/webdav` | Public WebDAV adapter and transactional upload middleware |

The project module currently uses the local name `MyServer`. External consumers
can use a Go module `replace` pointing to this repository; publishing the module
under a remote import path is a separate packaging step.
