# План основной pre-prod сборки

Целевое решение зафиксировано в
[ADR-009](adr/PREPROD_SERVER_RUNTIME_DECISION_RU.md). Этот документ задаёт
порядок реализации, не меняя принятых ADR по VFS, HTML и hooks.

## Целевая структура

```text
cmd/server/main.go                         минимальный process entrypoint
internal/serverapp/config.go              versioned YAML + env secret resolver
internal/serverapp/build.go               composition root и allowlist modules
internal/serverapp/runtime.go             Start, readiness, Shutdown, ownership handles
internal/serverapp/router.go              верхнеуровневый mount transport adapters
internal/serverapp/authn.go               HTTP credential -> trusted vfs.Actor
internal/serverapp/owner_authorizer.go     временная fail-closed pre-ACL policy

internal/auth/adapters/httpapi/            новый минимальный session adapter
internal/vfs/v2/                          VFS Core и нейтральные contracts
internal/vfs/v2/adapters/httpapi/          VFS HTTP adapter
internal/vfs/v2/adapters/sitehttp/         site HTTP adapter
internal/vfs/v2/adapters/webdav/           optional WebDAV adapter
internal/vfs/v2/providers/system/scopes/   scopes module
internal/vfs/v2/providers/local/           local module
internal/vfs/v2/providers/html/            HTML module + get-static/get-page
pkg/vfs/providersdk/                       публичный provider module contract
pkg/vfs/hooks/                             transport-neutral hook runtime contract
```

`internal/app`, `api/handlers`, `internal/vfs`, debug/shared providers и demo
bootstrap не входят в dependency graph `cmd/server`.

## Порядок итераций реализации

1. **Config/process shell.** Ввести strict config loader, env secret resolver,
   signal context и тестируемый `Runtime` без доменной сборки. Проверить invalid
   config, отсутствующий JWT secret и идемпотентный shutdown.
2. **Pre-ACL gate.** Реализовать `OwnerScopeAuthorizer` и матричные тесты:
   owner/foreign/unknown scope, synthetic scope gate, системная scopes projection,
   error fail-closed. Удалить `allowAll` только из production graph, не переписывая
   demo tests без необходимости.
3. **Core modules.** Собрать stores, provider pool и положительный allowlist
   `scopes`, `local`, `html`; зарегистрировать из HTML module только
   `get-static/get-page`. Не переносить seed-функции из `cmd/vfsv2html`.
4. **HTTP surfaces.** Подключить минимальный Auth session adapter, Auth actor
   resolver, VFS HTTP и site HTTP. Legacy user/admin/register handlers и
   universal hook endpoint не монтировать. Добавить integration tests, что
   unauthenticated и foreign-scope requests не доходят до provider.
5. **Optional WebDAV.** Монтировать тот же actor-bound frontend только при
   `enabled`; убрать fallback actor и debug/scopes seed. Проверить выключенный
   transport и shutdown in-flight запроса.
6. **Production graph guard.** Тестом/статическим check зафиксировать отсутствие
   импортов legacy handlers, `internal/vfs`, debug/shared и символов allow-all в
   `cmd/server` graph. После успешных интеграционных тестов обновить статус
   ADR-009, но не статусы ADR-003/ACLv2.

## Зависимости следующих работ

```text
config + Runtime lifecycle
        -> OwnerScopeAuthorizer
        -> core provider allowlist
        -> VFS HTTP + site HTTP
        -> optional WebDAV
        -> pre-prod smoke/deployment checks

ACLv2 (отдельно, не эта серия)
        -> заменяет OwnerScopeAuthorizer
        -> только затем разрешает shared/cross-scope/anonymous policy
```

## Проверки и известные ограничения

На каждой реализации запускаются целевые package tests и `go test ./cmd/server`;
перед объявлением среза готовым — `go test ./...` и сборка `go build ./cmd/server`.

До ACLv2 остаются ограничения: нет sharing и cross-scope, нет anonymous site,
нет ACL grants/lifecycle и нет публичного произвольного hook execution. HTML
active publication, durable hook journal и lifecycle recovery не являются
скрытыми prerequisites первого среза и остаются в статусах ADR-007, ADR-008 и
ADR-003 соответственно.
