# Практический план реализации ADR-007

> Статус: рабочий план, не описание готовой реализации.  
> Дата: 30 сентября 2026 года.  
> Архитектурное решение: [ADR-007: HTML Provider](adr/VFS_V2_HTML_PROVIDER_DECISION_RU.md).  
> Клиентский контракт: [контракт HTML-редактора](HTML_EDITOR_CONTRACT_RU.md).  
> Зависимые решения: [ADR-003: ACL lifecycle](adr/ACL_LIFECYCLE_ARCHITECTURE_RU.md), [ADR-005: scope resolution](adr/VFS_V2_SCOPE_RESOLUTION_DECISION_RU.md), [ADR-008: VFS hooks](adr/VFS_V2_SERVER_HOOKS_DECISION_RU.md).

## 1. Цель и способ поставки

Цель — реализовать ADR-007 небольшими проверяемыми инкрементами, не создавая
прямых зависимостей HTML Provider от Auth, ACL, Scopes Provider, файловых
providers или их хранилищ.

Поставка делится на четыре результата:

| Результат | Что можно продемонстрировать | Что ещё не обещается |
| --- | --- | --- |
| R0: доменное ядро | SQLite Store и операции дерева проходят unit-тесты | VFS-проекция и физический content |
| R1: editor vertical slice | Page metadata, `model.xml`, `layout.xml` и `source.html` работают через VFSv2 | Публичный сайт и публикации |
| R2: публичный MVP ADR-007 | Versioned template, publication manifest, `/`, `/_static`, sitemap и robots | Hooks и полная ACL lifecycle recovery |
| R3: production hardening | Реальный ACL, lifecycle, reconciliation и вывод legacy HTML routes | Необязательные blocks/hooks, если они поставляются отдельно |

Каждый инкремент должен завершаться тестами и рабочим VFS-сценарием. Не следует
сначала реализовывать все таблицы, затем все handlers и только в конце собирать
сквозной путь.

## 2. Фактическая исходная точка

На момент составления плана в репозитории уже есть:

- VFS Core, `BoundVFS` и повторный вход в Core с тем же actor;
- `providersdk` с typed collections, JSON/bytes documents и `Control` commands;
- HTTP VFS adapter для `Stat`, `ReadDir`, file operations и `Control`;
- `shared` provider как пример actor-bound делегирования;
- Scopes Provider и SQLite-хранилища scope/connection;
- общая классификация ошибок VFS;
- отдельная VFSv2-сборка в `cmd/vfsv2webdav`.

Существенные пробелы:

- provider key `html` и его Store отсутствуют;
- `cmd/vfsv2webdav` использует allow-all delegate authorizer и
  `NoopResourceLifecycle`;
- основной сервер в `internal/app/server.go` использует legacy VFS, прямые
  `api/handlers/HTML` и файловую раздачу `data/HTML/frontend`;
- текущая ошибка VFS передаёт только общий `kind`, а editor contract требует
  доменные коды и актуальные revision в conflict-ответе;
- нет production-композиции VFSv2, которую одновременно используют API,
  Site HTTP Adapter и WebDAV;
- ADR-003, ADR-005 и ADR-008 не завершены.

Это означает, что R1 можно реализовать и проверить независимо, но объявлять его
production-ready до R3 нельзя.

## 3. Неизменяемые границы реализации

На всех этапах действуют следующие правила:

1. HTML Provider располагается в `internal/vfs/v2/providers/html` и владеет
   только своим доменом и таблицами `html_*`.
2. Изоляция данных выполняется по `ProviderConnection.ID`; один HTML connection
   представляет один site.
3. Связь с physical content хранится только как канонический VFS URI.
4. Проверка существования и любое чтение/изменение physical content выполняются
   только через `BoundVFS` из request context.
5. Actor не принимается в JSON payload и не заменяется service principal.
6. HTML Provider не импортирует пакеты `local`, `shared`, Auth, ACL management,
   Scopes Store или legacy VFS.
7. `Page.ID` остаётся provider-local ссылкой; ACL identity — полный logical URI.
8. Удаление Page metadata не удаляет physical file.
9. Hooks не входят в зависимости HTML Provider.
10. Site HTTP Adapter читает опубликованный сайт через VFSFrontend, а не через
    HTML Store или filesystem.

Архитектурный тест должен запрещать нежелательные imports в пакете provider-а.

## 4. Пакеты и файлы

Предлагаемая структура:

```text
internal/vfs/v2/providers/html/
├── definition.go          provider key, config, factory
├── provider.go            VFS tree/projection only
├── model.go               domain entities and enums
├── commands.go            public Control DTO
├── store.go               Store interfaces
├── sqlite_store.go        schema and SQLite implementation
├── site_service.go        initialization and site settings
├── page_service.go        page/tree invariants and revisions
├── binding_service.go     publisher roots and canonical URI validation
├── editor.go              model.xml and layout.xml codecs
├── template_service.go    immutable template packages and allowlist
├── publication_service.go state machine and manifest snapshots
├── public_projection.go   /public resources
└── errors.go              typed domain errors

internal/vfs/v2/adapters/sitehttp/
├── handler.go
└── handler_test.go

internal/vfs/v2test/
└── html_frontend_test.go
```

Файлы можно объединять, пока пакет мал, но границы Store, domain service,
VFS projection и HTTP adapter должны сохраниться. Provider не должен содержать
SQL внутри route handlers.

## 5. Последовательность инкрементов

### Инкремент 0. Зафиксировать исполнимый контракт

До основной реализации нужно закрыть четыре контрактных пробела отдельным
небольшим PR:

1. Перевести ADR-007 из `Предложено` в `Принято` после архитектурного review.
   Сам факт появления этого плана статус решения не меняет.
2. Определить прямую bootstrap-команду HTML connection. Рекомендуемый вариант:

   ```text
   Control(html@site[scope]:///, "initialize", payload)
   ```

   Connection сначала создаётся и помечается ready через Scopes Provider, затем
   actor с правом `x` инициализирует Site. Повтор той же команды с теми же
   параметрами идемпотентен; несовместимый повтор возвращает conflict.
3. Зафиксировать provider config. Для первой версии он должен быть пустым или
   содержать только нейтральные лимиты; owner, scope и site identity не должны
   дублироваться в config JSON.
4. Расширить безопасный HTTP error contract доменными `code` и `details`, не
   заставляя adapter импортировать HTML Provider. Подходящий общий контракт:

   ```go
   type ErrorDetails interface {
       PublicCode() string
       PublicDetails() map[string]any
   }
   ```

   HTTP adapter по-прежнему определяет status по `vfs.ErrorKind`, а безопасные
   details извлекает через общий интерфейс. Так можно вернуть
   `page_revision_conflict` и `currentPageRevision`, не раскрывая SQL/URI.

Критерий готовности: bootstrap и error payload описаны одинаково в ADR,
editor contract и тестах HTTP adapter-а.

### Инкремент 1. Store и доменные модели (R0)

Добавить `html.InitDB`, `NewSQLiteStore` и минимальные таблицы:

```text
html_sites
html_publisher_roots
html_pages
html_page_types
html_page_search_tags
html_editor_layouts
html_site_seo
```

Сразу предусмотреть поля template selection и nullable
`active_publication_id`, но таблицы template/publication можно добавить в их
инкрементах.

Обязательные ограничения SQLite:

- `html_sites.connection_id` уникален;
- `page_key` уникален внутри site;
- отдельные unique indexes для root slug и `(site_id, parent_id, slug)`, потому
  что SQLite не считает два `NULL` одинаковыми;
- parent и theme/block links проверяются в локальной транзакции;
- нет foreign keys на Auth, ACL, scopes и таблицы других providers;
- удаление Page не переиспользует его integer ID;
- все timestamps и revision changes происходят внутри той же транзакции, что и
  изменение данных.

Store API должен принимать `context.Context` и явный `connectionID/siteID`.
Публичные методы Store не должны принимать actor или принимать решение о
доступе.

Тесты:

- повторный `InitDB` безопасен;
- два connections изолированы;
- constraints не позволяют cross-site parent;
- rollback сохраняет прежние revisions;
- root/sibling slug uniqueness работает и для `NULL parent_id`;
- types/tags нормализуются без дубликатов.

### Инкремент 2. PageService и ревизии (R0)

Реализовать `PageService`, который является единственной точкой изменения
страниц. Сначала поддержать:

- `create`;
- `update`;
- `move`;
- `delete` с `reject`, `cascade`, `promote_children`;
- `set-content`;
- `set-types`, `set-search-tags` можно добавить в том же PR либо сразу после
  первого vertical slice.

Все команды используют строгий JSON decoder и reject unknown fields.

Правила транзакций:

- page revision меняется при functional изменении страницы;
- tree revision меняется только при изменении parent/order/create/delete;
- model revision меняется при любом изменении, видимом в `model.xml`;
- проверки expected revision и запись выполняются в одной транзакции;
- порядок siblings полностью нормализуется сервером;
- `beforeId`, `afterId`, `first`, `last` взаимоисключающие;
- cycle detection выполняется до записи;
- cascade удаляет metadata одним локальным transaction и не вызывает VFS.

Тестировать таблицей все инварианты из раздела 24 ADR-007, особенно indirect
cycle, stale revisions и promote-children.

### Инкремент 3. Минимальная VFS-проекция

Собрать provider через `providersdk.Definition` и typed tree. На этом этапе
проецируются:

```text
/
├── site.json
├── tree.json
├── editor/
│   ├── model.xml
│   └── layout.xml
├── publishers/
└── pages/
    └── <page-key>/
        ├── info.json
        └── source.html
```

Команды регистрируются на `/`, `/publishers`, `/pages` и
`/pages/<page-key>` через `providersdk.Command`. `model.xml` и `tree.json`
формируются из Store и не имеют Replace handler. `info.json` в первой версии
read-only; functional write выполняется через `Control update`, чтобы не
изобретать conditional PUT вне согласованного контракта.

`Stat` и `ReadDir` не должны раскрывать ресурс, который не существует в
HTML Store. Provider instance хранит только immutable dependencies и connection
metadata; request actor берётся только из context.

Тесты:

- provider laws из `providertest`;
- route listing;
- read-only `model.xml` возвращает unsupported/permission на запись;
- Control неизвестной командой возвращает unsupported;
- один provider instance безопасен для параллельных requests разных actors.

### Инкремент 4. Publisher roots и actor-bound content delegation

Реализовать `register-root` и `set-content` в следующем порядке:

1. `common.CastURI` и сохранение только canonical string;
2. обязательный explicit scope, равный scope HTML connection;
3. segment-aware containment target внутри зарегистрированного root;
4. `BoundVFS.Stat` с request context;
5. проверка ожидаемого типа target;
6. локальная запись binding только после успешного Stat.

Нельзя проверять root строковым `strings.HasPrefix`: `/site/a` не должен
совпадать с `/site/ab`. Сравниваются provider, connection, scope и очищенные
path segments.

`source.html` делегирует `OpenFile` непосредственно в `BoundVFS`. Возвращаемый
file не буферизуется HTML Provider и сохраняет семантику commit/abort target
provider-а. Ошибки ACL/backend передаются как классифицированные VFS errors;
недоступный ранее сохранённый URI может быть представлен как `broken_binding`.

Интеграционный тест должен использовать recording authorizer и fake physical
provider и доказать две независимые проверки:

```text
r/w logical html URI
    -> provider
    -> r/w physical URI с тем же actor
```

Отдельно проверить outer allow + target deny, backend deny после ACL allow и
отсутствие вызова target при невалидном root.

### Инкремент 5. Editor model и layout (R1)

Реализовать deterministic codec `model.xml`:

- страницы сортируются по domain order, затем по ID как tie-breaker;
- connections используют `from-id`/`to-id`;
- schema/tree/model revisions всегда присутствуют;
- одинаковое состояние даёт одинаковые bytes.

Для `layout.xml` реализовать bounded Replace:

- запрет `DOCTYPE`, DTD, external entities и XInclude до разбора;
- строгий allowlist элементов/атрибутов;
- лимиты на документ, количество nodes/connections и длины значений;
- уникальный `page-id`, существующий в том же site;
- finite numeric coordinates и допустимые размеры/view;
- compare-and-swap по `layout-revision`;
- нормализацию XML перед сохранением.

R1 считается готовым после сквозного теста через настоящий VFS Core и HTTP
adapter:

```text
initialize site
-> register physical root
-> create page with source URI
-> read tree.json and model.xml
-> write/read layout.xml
-> read and replace source.html through BoundVFS
-> stale page/tree/layout revision returns 409 with domain code
```

### Инкремент 6. Регистрация в рабочей VFSv2-сборке

В `cmd/vfsv2webdav/main.go`:

- вызвать `html.InitDB(db)`;
- создать общий SQLite Store;
- зарегистрировать `html.Definition(store)` в `providersdk.Catalog`;
- добавить test fixture/seed только за явным флагом, без скрытого создания
  production site;
- расширить `cmd/vfsv2webdav/main_test.go` проверкой регистрации.

После этого вынести композицию registry/pool/frontend из команды в
переиспользуемый application package. Один и тот же VFSFrontend должен
использоваться HTTP VFS adapter-ом, WebDAV и будущим Site HTTP Adapter-ом.
Не создавать отдельный VFS Core внутри HTML Provider или Site adapter-а.

R1 после этого можно демонстрировать из CLI/HTTP, но в документации он всё ещё
помечается как ACL-free development slice.

### Инкремент 7. Versioned application templates

Добавить таблицы metadata template package, asset allowlist и provider-owned
blob storage. Предпочтительный первый вариант — content-addressed blobs внутри
домена HTML Provider; bytes не должны попадать в metadata rows.

`Control(/templates, "install", ...)` выполняет:

1. строгую валидацию key/version;
2. безопасную распаковку с лимитами количества файлов и общего размера;
3. запрет absolute path, `..`, symlink и duplicate normalized paths;
4. проверку, что entrypoint и каждый asset существуют;
5. digest каждого файла и всего manifest;
6. атомарную регистрацию immutable key/version;
7. отказ перезаписывать существующую версию.

Начальный package строится из явного manifest для `data/HTML/frontend`.
Generator source/binary, zip, swap files, случайные SVG-копии и каталоги
`data/HTML/block` не должны попадать в allowlist.

VFS-проекция `/templates/<key>/<version>/manifest.json` и `/files/...` читает
только зарегистрированные assets. Наличие файла рядом с package не делает его
доступным.

### Инкремент 8. Themes, SEO и blocks

Этот инкремент допускается разделить на два PR:

- `ThemeService`, `/themes`, default/page theme и проверка same-site links;
- `BlockService`, `/blocks`, source/view binding, template/root block links и
  `resource_in_use` при удалении.

`config/robots.txt` хранится как HTML metadata document. Theme/block physical
URIs проходят ту же root/scope/`BoundVFS` проверку, что Page source. Нельзя
переиспользовать cached successful Stat как право на последующее чтение.

Blocks не должны задерживать публикацию прямых `Page.SourceURI`, если продукту
сначала нужен page-only public MVP. В этом случае blocks поставляются сразу
после R2, а ADR/реестр честно отмечают частичную реализацию.

### Инкремент 9. Publication state machine

Добавить:

```text
html_publications
html_publication_resources
html_operations
```

Минимальные состояния:

```text
preparing -> validating -> ready -> activating -> active
          \-> failed
```

Операция получает client operation ID. Повтор того же ID возвращает прежний
результат или продолжает незавершённую операцию и не создаёт вторую публикацию.

Подготовка manifest:

- фиксирует tree/page metadata, public paths, theme и robots snapshot;
- фиксирует application template key/version, site-local manifest URI и digest;
- сохраняет точные physical URIs;
- проверяет каждый URI через `BoundVFS` с исходным actor;
- не удерживает SQL transaction во время внешних VFS-вызовов;
- записывает progress после каждого идемпотентного шага;
- переключает `active_publication_id` одной короткой локальной транзакцией
  только после полной проверки.

Reconciliation повторяет только безопасные шаги и никогда не активирует
неполный manifest. Изменение bytes по physical URI после публикации остаётся
явно задокументированной ответственностью публикатора.

### Инкремент 10. `/public` и Site HTTP Adapter (R2)

HTML Provider проецирует active publication:

```text
/public/manifest.json
/public/sitemap.xml
/public/robots.txt
```

Site HTTP Adapter находится вне provider-а и принимает готовый VFSFrontend,
site URI resolver и actor policy. Он не получает HTML Store.

Порядок маршрутов production server-а:

1. `/api/*` и служебные routes;
2. `/_static/<key>/<version>/*`;
3. site asset/public routes;
4. SPA route fallback только для допустимого site route;
5. обычный 404.

`/_static` проверяет active publication, точное совпадение key/version и asset
allowlist. Неизвестный static asset никогда не получает `index.html`.
Entrypoint получает revalidation cache policy; versioned assets — digest ETag и
immutable cache.

После прохождения parity-тестов legacy `http.FileServer`, `LoadTemplatePage` и
`/api/HTML` сначала выключаются feature flag-ом, затем удаляются отдельным PR.
До этого момента нельзя направлять часть site traffic напрямую в filesystem, а
часть через VFS: режим выбирается целиком для конкретного deployment/site.

### Инкремент 11. Production authorization и lifecycle (R3)

Этот этап зависит от фактической реализации ADR-003 и ADR-005:

- заменить allow-all authorizer реальным ACL evaluator;
- удалить `NoopResourceLifecycle` из защищённой production-композиции;
- выдать bootstrap grants через ACL Provider/VFS, не через HTML Store;
- проверить права отдельно на scope entry, logical HTML URI и physical URI;
- подключить create/delete logical resources к durable lifecycle;
- добавить reconciliation broken bindings и publication operations;
- выполнить fault-injection между VFS side effect и локальной фиксацией шага.

ADR-007 нельзя отмечать как полностью реализованный, пока основной production
server использует allow-all/noop или legacy обход для защищённых HTML ресурсов.

### Инкремент 12. Необязательные hooks ADR-008

После появления Hook Runtime зарегистрировать через его публичный SDK:

- `create-site`;
- `create-page-with-content`;
- `delete-page-and-source`;
- `publish-site`.

Hooks вызывают только actor-bound VFS. Они не получают `html.Store`,
`PageService` или прямой ACL management service. Тест частичного сбоя должен
показывать завершённые шаги и безопасный retry с idempotency key.

Отсутствие этого инкремента не блокирует R2: прямой VFS-контракт обязан
оставаться самодостаточным.

## 6. Разбиение на PR

Рекомендуемый размер review:

| PR | Содержание | Зависит от | Завершает |
| --- | --- | --- | --- |
| 0 | Contract gaps: initialize и structured errors | — | исполнимый контракт |
| 1 | Models, schema, SQLite Store | PR 0 | основа R0 |
| 2 | PageService и domain tests | PR 1 | R0 |
| 3 | VFS projection и commands | PR 2 | logical resources |
| 4 | Roots, bindings, BoundVFS delegation | PR 3 | physical content |
| 5 | model/layout XML и HTTP integration | PR 4 | R1 |
| 6 | registry/runtime composition | PR 5 | runnable R1 |
| 7 | template package и `/templates` | PR 6 | static source |
| 8 | themes/SEO, при необходимости blocks | PR 6 | publication inputs |
| 9 | publication state machine и `/public` | PR 7, PR 8 | active snapshot |
| 10 | Site HTTP Adapter и legacy cutover | PR 9 | R2 |
| 11 | ACL/lifecycle/reconciliation | ADR-003/005 | R3 |
| 12 | hooks | ADR-008 | optional UX |

PR не должен одновременно добавлять Store, весь provider, public HTTP adapter и
удалять legacy routes: такой diff невозможно надёжно проверить по доменным и
безопасностным границам.

## 7. Стратегия тестирования

### 7.1. Unit

- Store constraints и transactions;
- PageService invariants/revisions;
- canonical URI и segment containment;
- deterministic JSON/XML/manifest codecs;
- layout parser и template unpacker adversarial inputs;
- publication transitions и retry.

### 7.2. Provider contract

- общий `providertest` harness;
- `Stat`/`ReadDir` согласованы;
- unsupported operations стабильны;
- writes используют commit/abort;
- cancellation не публикует частичную запись.

### 7.3. Core integration

- реальный VFS Core, resolver и pool;
- recording Authorizer проверяет action/ref/actor;
- fake physical provider доказывает повторный ACL pass;
- два HTML connections в одном scope и одинаковые page keys не смешиваются;
- target другого scope и prefix collision отклоняются.

### 7.4. HTTP integration

- VFS HTTP endpoints и `Control` payload limits;
- 400/403/404/409/501 без утечки внутренних ошибок;
- conflict code и current revision;
- Site HTTP MIME, ETag, cache headers, route precedence и 404 static;
- encoded traversal, double encoding и absolute paths.

### 7.5. Fault injection

- target Stat прошёл, локальный commit упал;
- manifest validation прервалась посередине;
- activation повторилась после process restart;
- target исчез между validation и public read;
- lifecycle callback упал после local mutation.

## 8. Проверки перед слиянием каждого PR

Минимальный набор:

```bash
go test ./internal/vfs/v2/...
go test ./pkg/vfs/...
go test ./cmd/vfsv2webdav
go test ./...
go vet ./...
```

Для изменений schema дополнительно нужен тест upgrade с предыдущей схемы и
повторного запуска migration. Для concurrency/revision logic — целевые тесты с
`-race`. Для template/public HTTP — golden manifest и security corpus.

## 9. Наблюдаемость

Логи и метрики должны содержать operation, provider, connection ID, result,
duration и безопасный domain error code. Нельзя логировать raw HTML, template
package bytes, credentials или полный private URI без redaction policy.

Минимальные метрики:

- HTML commands по result/code;
- revision conflicts;
- broken bindings;
- delegated VFS latency/errors;
- publication transitions, retries и reconciliation lag;
- static allowlist misses и rejected traversal.

## 10. Условия изменения статуса ADR

Реестр `docs/adr/README.md` обновляется только по факту рабочего кода:

- после PR 1–2: `В процессе`, с точным указанием только Store/domain core;
- после R1: `В процессе`, editor vertical slice без public publication и
  production ACL;
- после R2: `В процессе`, если ACL/lifecycle или production cutover не завершены;
- `Реализовано` — только после R3 и прохождения критерия завершения MVP из
  ADR-007 в production-композиции.

Hooks ADR-008 не являются условием статуса `Реализовано`, если весь прямой
контракт ADR-007 завершён. Blocks могут быть вынесены после page-only R2 только
при явном уточнении scope ADR и реестра; молча считать их реализованными нельзя.

## 11. Ближайший практический шаг

Первым кодовым PR должен быть не весь provider, а связка PR 0 + каркас PR 1:

1. согласовать `initialize` и structured conflict details;
2. создать пакет `internal/vfs/v2/providers/html`;
3. добавить schema `html_sites`, `html_publisher_roots`, `html_pages`,
   `html_editor_layouts`;
4. доказать connection isolation и transactional revisions тестами;
5. не регистрировать provider в production composition до появления хотя бы
   одного сквозного provider test.

После этого PR 2–5 дают короткий путь до демонстрируемого R1 без зависимости от
hooks, blocks, publication и незавершённого ACL lifecycle.
