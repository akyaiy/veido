# ADR-009: Основная pre-prod сборка и границы server runtime

> Статус решения: принято.  
> Статус реализации: в процессе; database open, обязательные migration groups и
> standalone migration CLI реализованы, composition root и новый runtime ещё отсутствуют.  
> Дата решения: 21 октября 2026 года.  
> Связанные документы: [план реализации](../PREPROD_SERVER_RUNTIME_PLAN_RU.md),
> [scope resolution](VFS_V2_SCOPE_RESOLUTION_DECISION_RU.md),
> [HTML Provider](VFS_V2_HTML_PROVIDER_DECISION_RU.md),
> [server hooks](VFS_V2_SERVER_HOOKS_DECISION_RU.md),
> [ACL lifecycle](ACL_LIFECYCLE_ARCHITECTURE_RU.md).

## 1. Контекст

В репозитории одновременно существуют legacy `cmd/server`, отдельные demo-команды
VFSv2 и уже реализованные части HTML Provider, hooks и HTTP/WebDAV adapters. Demo
композиции полезны как проверяемые примеры, но содержат bootstrap/seed-код,
fallback actor и разрешающий всё authorizer. Механическое объединение этих команд
создало бы новый монолит и сделало demo-политику частью сервера.

Нужна одна основная pre-prod сборка, которая сохраняет границы Auth, VFS Core и
провайдеров и остаётся безопасной до появления ACLv2.

## 2. Решение

### 2.1. Единственная основная команда

Единственным production binary является `cmd/server`. Его `main.go` только:

1. получает путь к конфигурации;
2. создаёт корневой `context` для `SIGINT`/`SIGTERM`;
3. вызывает composition root;
4. запускает runtime и преобразует итоговую ошибку в exit code.

`main.go` не создаёт providers, routes, middleware, stores и demo fixtures.
Команды `cmd/vfsv2html`, `cmd/vfsv2webdav`, `cmd/vfsv2debug` и legacy-код не
импортируются основной сборкой и могут существовать только как demo/dev tools.

### 2.2. Границы сборки

```text
cmd/server
    -> composition root
        -> config + secrets + DB + migrations
        -> Auth
        -> owner-only pre-ACL authorizer
        -> provider modules + hook registry
        -> VFS Core + actor-bound hook runtime
        -> transport adapters
    -> application Runtime.Start / Runtime.Shutdown

HTTP request
    -> transport authentication -> trusted actor
    -> VFS HTTP | site HTTP | optional WebDAV
    -> VFS Core -> authorizer -> owning provider
                             -> BoundVFS -> VFS Core -> authorizer -> target provider
```

Обязанности разделены так:

| Граница | Ответственность | Не должна делать |
| --- | --- | --- |
| Composition root | Создать concrete dependencies, зарегистрировать выбранные modules и собрать runtime | Содержать HTTP handlers или доменную логику |
| Application runtime | Владеть сервером, provider pool, hook runtime, фоновой работой и упорядоченным shutdown | Разрешать URI или принимать решения доступа |
| Transport adapters | Аутентифицировать протокол, получить actor, декодировать запрос и вызвать application/VFS contract | Обращаться к БД или provider store напрямую |
| Provider module | Объявить provider factory, hooks и bindings своего домена | Регистрировать глобальные routes, вызывать чужой store/service или менять actor |
| VFS Core | Разрешить канонический URI, применить authorizer и вызвать provider | Знать HTTP, HTML site routing или provider-specific config |

Composition root зависит от concrete packages. Все остальные зависимости идут к
контрактам внутрь; transport и providers не зависят друг от друга.

### 2.3. Модули первого среза

В основную сборку входят только:

- Auth, новый тонкий session HTTP adapter (`login`, `refresh`, `logout`) и
  middleware, устанавливающий доверенного `vfs.Actor`;
- VFS Core, scope/connection stores, provider pool и no-op lifecycle sink как явно
  временная реализация до ADR-003;
- системный `scopes` provider;
- `local` provider;
- HTML Provider;
- только native hooks `get-static` и `get-page`, зарегистрированные HTML module;
- VFS HTTP adapter;
- site HTTP adapter, вызывающий hooks с actor исходного запроса;
- WebDAV adapter при `transports.webdav.enabled: true`.

Universal hook HTTP adapter не является публичной поверхностью первого среза:
`get-static` и `get-page` вызываются site adapter через hook runtime. WebDAV не
использует fallback actor и по умолчанию выключен.

Не входят в сборку и не могут быть зарегистрированы косвенно:

- `internal/vfs` и остальные legacy VFS/API handlers;
- legacy HTML handlers и SPA catch-all из прежнего `internal/app`;
- debug provider и debug seed;
- shared provider до подключения настоящего ACL;
- ACLv2 и ACL management API.

Legacy user/admin/register handlers не переносятся. Создание первого пользователя
является отдельной одноразовой bootstrap-операцией; оно не открывается как
неограниченный публичный route.

Регистрация использует положительный allowlist modules. Автообнаружение packages,
регистрация «всех известных» providers и build-time side-effect imports запрещены.

### 2.4. Временная модель доступа до ACL

Pre-prod использует отдельный fail-closed `OwnerScopeAuthorizer`, а не
`allowAll`, не legacy ACL bypass и не provider-local проверку доступа.

Для обычного resource ref операция разрешена только если:

1. actor аутентифицирован и имеет поддерживаемый тип;
2. `ref.ScopeKey` разрешается в существующий scope;
3. `scope.OwnerSubjectKey == SubjectKey(actor.String())`.

Все действия над ресурсами принадлежащего actor scope разрешаются временной
политикой; все обращения к чужому, неизвестному или некорректному scope и все
ошибки lookup запрещают операцию. Для synthetic scope gate из ADR-005 проверяется
владелец адресуемого `/scopes/<scope-key>`.

`scopes` provider является узкой системной проекцией. До ACL основная сборка
разрешает только actor-filtered чтение корня/списка и чтение метаданных scope,
которым владеет actor; произвольные системные мутации через публичные transports
запрещены. Сам provider может дополнительно сузить результат, но не расширить
решение authorizer.

Anonymous/fallback/system actor для пользовательских HTTP-запросов в первом
срезе отсутствует. Поэтому site HTTP также требует Auth. Междоменная работа HTML
hooks выполняется только через переданный `BoundVFS`, сохраняя того же actor.

Эта политика не является ACLv2 и не хранит grants. При подключении ACL она
целиком заменяется evaluator, а ScopeResolver остаётся чистым механизмом
адресации согласно ADR-005.

### 2.5. Конфигурация и secrets

Формат основной конфигурации — один versioned YAML-файл. Неизвестные поля,
неподдерживаемая `version`, отсутствующие обязательные значения и неразрешённые
secret references являются ошибкой запуска. Сервер не создаёт config-файл и не
генерирует секрет при старте.

Целевой верхнеуровневый контракт:

```yaml
version: 1
server:
  listen: ":8080"
  read_timeout: 15s
  write_timeout: 30s
  idle_timeout: 60s
  shutdown_timeout: 20s
database:
  sqlite_path: "./data/db/server.sqlite3"
auth:
  jwt_signing_secret: "env:JWT_SIGNING_SECRET"
  jwt_issuer: "jwtproject2"
  jwt_audience: "jwtproject2"
  access_token_ttl: 15m
  refresh_token_ttl: 24h
  refresh_cookie_secure: true
providers:
  local:
    storage_path: "./data/cas"
  html: {}
site:
  enabled: true
  mount: "/"
  site_uri: "html@site[site-owner]:///"
  entrypoint: "index.html"
transports:
  vfs_http:
    enabled: true
    mount: "/api/v2/vfs"
  webdav:
    enabled: false
    mount: "/webdav"
    base_uri: "local@default[site-owner]:///"
limits:
  max_file_write_bytes: 33554432
  max_control_bytes: 1048576
  max_json_bytes: 65536
```

Секреты задаются ссылкой `env:NAME`, читаются только при старте и не выводятся в
логи. Обязательный общий secret первого среза — `JWT_SIGNING_SECRET` (не менее 32
случайных bytes). Дополнительно обязательны только включённые возможности:

- bootstrap password администратора — если отдельно включён одноразовый
  bootstrap пользователей;
- credential local account connection — для каждой конфигурации local provider,
  которая открывается в account mode;
- TLS private key — только если TLS завершается самим binary, а не reverse proxy.

SQLite password отсутствует. Provider credentials нельзя хранить открытым
текстом в YAML или логах; composition root разрешает их через тот же secret
resolver. Отсутствующий условный secret делает запуск соответствующего модуля
ошибкой, а не включает небезопасный fallback.

### 2.6. Запуск и graceful shutdown

Startup выполняется fail-fast до открытия listener:

1. разобрать и валидировать config и secret references;
2. настроить structured logger без secret values;
3. открыть SQLite, применить только известные migrations;
4. создать Auth, stores и `OwnerScopeAuthorizer`;
5. собрать allowlist provider modules и hooks;
6. создать VFS Core, actor-bound hook runtime, Auth session adapter и остальные
   transport adapters;
7. проверить cross-config invariants и только затем установить readiness;
8. запустить один `http.Server` и разрешённые background workers.

При `SIGINT`/`SIGTERM` runtime сначала снимает readiness и прекращает принимать
новые запросы, затем вызывает `http.Server.Shutdown` с
`server.shutdown_timeout`, дожидается in-flight requests/hooks, останавливает
workers и provider pool и последней закрывает БД. После timeout выполняется
принудительное закрытие и возвращается ошибка. Повторный shutdown идемпотентен.
Ошибка любого обязательного worker отменяет корневой context и запускает тот же
shutdown. `log.Fatal` и `os.Exit` ниже `main` запрещены, поскольку они пропускают
defer/shutdown.

## 3. Последствия

- Demo-команды остаются источником примеров, но не зависимостью production.
- Первый срез не поддерживает sharing, anonymous site и cross-scope access.
- Owner-only authorizer сознательно грубее будущего ACL, но не открывает доступ
  шире владения scope и может быть заменён одним компонентом.
- No-op lifecycle допустим только потому, что ACL rules ещё отсутствуют; это не
  означает реализацию ADR-003.
- Один HTTP server упрощает lifecycle; optional WebDAV является route adapter,
  а не отдельным process lifecycle.
- Реализация требует вынести старый `internal/app.ServerStart` из production
  пути, но не требует переносить его handlers.

## 4. Критерии реализации

ADR можно отметить реализованным только когда:

1. `cmd/server` собирается из allowlist выше и не импортирует legacy/debug/shared;
2. в transitive production graph нет `allowAll` и dev ACL bypass;
3. чужой scope запрещён во VFS HTTP, site HTTP и WebDAV до вызова provider;
4. Auth actor сохраняется в hooks и каждом `BoundVFS` вызове;
5. invalid config/secret приводит к отказу до listen;
6. интеграционный тест подтверждает порядок graceful shutdown;
7. demo seed/fallback actor не исполняются основной командой.
