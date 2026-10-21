# ADR-009: Основная pre-prod сборка и границы server runtime

> Статус решения: принято.  
> Статус реализации: в процессе; `cmd/server` переключён на `internal/serverapp`
> с `.env`/environment конфигурацией, allowlist VFSv2 modules, health и VFS/hooks
> HTTP transport. Durable recovery, site transport и удаление неиспользуемого
> legacy-кода ещё не завершены.
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
        -> system-scope pre-ACL authorizer
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
| Provider module | Объявить provider factory и hooks своего домена | Регистрировать глобальные routes, вызывать чужой store/service или менять actor |
| VFS Core | Разрешить канонический URI, применить authorizer и вызвать provider | Знать HTTP, HTML site routing или provider-specific config |

Composition root зависит от concrete packages. Все остальные зависимости идут к
контрактам внутрь; transport и providers не зависят друг от друга.

### 2.3. Модули первого среза

В основную сборку входят только:

- Auth hooks (`login`, `refresh`, `logout`) и
  middleware, устанавливающий доверенного `vfs.Actor`;
- VFS Core, scope/connection stores, provider pool и no-op lifecycle sink как явно
  временная реализация до ADR-003;
- системный `scopes` provider;
- `local` provider;
- HTML Provider;
- только native hooks `get-static` и `get-page`, зарегистрированные HTML module;
- VFS HTTP adapter;
- VFS hooks HTTP adapter.

Site/preview adapter можно подключить отдельным mount после готовности его
конфигурации. WebDAV и legacy HTTP handlers не входят в production router.

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

Pre-prod использует fail-closed policy, а не `allowAll` и не legacy ACL bypass.
Trusted guest или user может адресовать общий scope `system`; user дополнительно
может адресовать только свой personal scope. Все остальные scope и неизвестный
actor запрещены. Provider после этой проверки может дополнительно сузить доступ,
например Users Provider разрешает профиль только самому user.

`system` и connection `scopes/scopes` создаются VFS migration, а `users/account`
— migration Users Provider. `auth.register` создаёт только personal default
scope через VFS; никаких connections или иных ресурсов в нём не инициализирует.

Anonymous/fallback/system actor для пользовательских HTTP-запросов отсутствует.
Browser получает обычный trusted guest actor. Пока ACLv2 не реализован,
composition root явно передаёт authorizer один public site scope из `SITE_URI`;
это временно даёт guest/user вход и resource access к этому scope, чтобы Site
HTTP adapter мог вызвать HTML hooks и physical publisher bundle через тот же
actor. Router не принимает access-решений. При подключении ACL этот bridge
должен быть заменён grant-ами на site scope, HTML metadata и physical URI.
Междоменная работа HTML hooks выполняется только через переданный `BoundVFS`,
сохраняя того же actor.

Эта политика не является ACLv2 и не хранит grants. При подключении ACL она
целиком заменяется evaluator, а ScopeResolver остаётся чистым механизмом
адресации согласно ADR-005.

### 2.5. Конфигурация и secrets

Production-конфигурация основана на environment. При старте `godotenv.Load`
читает только `.env` (или `APP_ENV_FILE`); process environment имеет приоритет.
`.env` не коммитится, а `.env.example` документирует `HTTP_*`, `DB_PATH`,
`CAS_PATH`, `JWT_*` и cookie settings. Отсутствующий файл допустим; ошибочный
существующий файл или некорректное значение останавливают startup до listen.

Secrets читаются только при старте и никогда не выводятся в лог. Обязательный
secret — `JWT_SECRET` (не менее 32 bytes). Дополнительно обязательны только
включённые возможности:

- bootstrap password администратора — если отдельно включён одноразовый
  bootstrap пользователей;
- credential local account connection — для каждой конфигурации local provider,
  которая открывается в account mode;
- TLS private key — только если TLS завершается самим binary, а не reverse proxy.

SQLite password отсутствует. Provider credentials нельзя хранить открытым
текстом в environment file или логах. Отсутствующий условный secret делает
запуск соответствующего модуля ошибкой, а не включает небезопасный fallback.

### 2.6. Запуск и graceful shutdown

Startup выполняется fail-fast до открытия listener:

1. разобрать и валидировать config и secret references;
2. настроить structured logger без secret values;
3. открыть SQLite, применить только известные migrations;
4. создать Auth, stores и временный system/owner/public-site authorizer;
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
- Первый срез не поддерживает sharing и произвольный cross-scope access.
- Временный authorizer открывает только явно сконфигурированный public site
  scope; это переход к ACL, а не модель grants для production.
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
