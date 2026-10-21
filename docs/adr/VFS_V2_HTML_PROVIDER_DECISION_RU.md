# ADR-007: HTML Provider как метадоменная проекция файлов сайта

> Статус: предложенное целевое архитектурное решение, не описание готовой реализации.  
> Статус реализации на 21 октября 2026 года: в процессе; schema v4 зарегистрирована как `provider/html` в централизованном migration runner с совместимым импортом прежней `html_schema_migrations`. Реализованы provider-local модели, миграции `source_uri` → `bundle_root_uri`, legacy visibility и immutable application templates, `PageService`, typed VFS-проекция, `initialize`, publisher roots, безопасный `create` и обязательная node visibility для всех уже проецируемых сущностей (`site`, `publisher`, `page`). Создание metadata и initial visibility атомарно; поддержаны `all`, `guest`, exact trusted actor, optimistic revisions, фильтрация lookup/list/`tree.json` и скрытие поддерева невидимого parent. Через actor-bound `BoundVFS` при создании проверяются каталог bundle и обязательные `content.md`, `style.css`, `script.js`; `info.json` возвращает канонический `bundle_root_uri`, а physical source читается напрямую через VFS Core. Editor slice предоставляет actor-filtered read-only `editor/model.xml` и writable `editor/layout.xml`: реализованы детерминированные codecs, XML security/limits, сохранение layout невидимых страниц, атомарный Store CAS и публичный `layout_revision_conflict`. Template slice предоставляет атомарный `Control(/templates, "install", ...)`, content-addressed blobs, строгий manifest allowlist и read-only VFS-проекцию `/templates/<key>/<version>/{manifest.json,files/...}`. Application-level builder безопасно собирает reviewed allowlist `default-spa/10` из `data/HTML/frontend`, запрещает symlink/traversal и устанавливает package через публичный VFS в demo bootstrap. Общий Hook SDK/Registry/Runtime foundation из ADR-008 реализован отдельно от HTML-домена; HTML `providersdk.Module` регистрирует read-only `get-static` и `get-page` вместе с provider factory и создаёт site bindings при открытии connection. Adapter вызывает hooks через canonical site URI и key, не зная внутренних binding keys. `get-static` выбирает последнюю установленную версию bound template key, читает только manifest-listed asset через actor-bound VFS, проверяет фактические size/SHA-256 и возвращает content с HTTP metadata. Demo Site HTTP slice выдаёт точный `/` и unversioned `/_static/*` через `get-static`, а остальные browser paths передаёт `get-page`; тот разрешает одно- и многосегментную цепочку slug по actor-filtered `tree.json`, возвращает SPA entrypoint и actor-filtered bootstrap (`site_uri`, `site_name`, page metadata и `bundle_root_uri`) только для существующей Page и 404 для неизвестного маршрута. Adapter безопасно встраивает bootstrap в HTML и пересчитывает response ETag; browser runtime больше не повторяет `get-page` и не читает отдельно `site.json`/`info.json`, а сразу параллельно загружает три physical bundle-файла. Demo seed создаёт `/demo` с отдельным physical bundle; `/` сохраняет прежнее site-приложение. Bundle обычной страницы `demo` подключает рабочую панель управления site settings, страницами и physical bundles через публичные VFS-контракты. Новая страница наследует `visible_to` сайта: поэтому на публичном сайте она сразу видна guest readers. Unversioned static использует ETag с обязательной revalidation, без `immutable`. Filesystem/FileServer не используется; универсальный Hook HTTP endpoint также реализован. Active publication, поиск, publication/sitemap, production-регистрация, реальный ACL и lifecycle ещё отсутствуют. Отдельный `cmd/vfsv2html` предоставляет проверяемую demo-композицию.
>
> Исправление от 21 октября 2026 года: упоминания site/resource bindings в
> предыдущем статусе устарели и заменены ADR-008. Hooks не прикрепляются к
> connection или одному URI: `get-static` и `get-page` получают `site_uri` и
> `template_key` в typed input и выполняют требуемые VFS-вызовы тем же actor.
> Дата решения: 24 сентября 2026 года.  
> Уточнено 26 сентября 2026 года: прямой VFS-контракт отделён от общих VFS hooks; добавлены режимы удаления поддерева, позиционные anchors и стратегия конфликтов редактора.  
> Уточнено 29 сентября 2026 года: editor connections переведены на provider-local page IDs; добавлены versioned application templates, manifest-разрешённая статика и правила выдачи корня сайта. 3 октября 2026 года физическая модель Page/Block уточнена до bundle из `content.md`, `style.css`, `script.js`; отдельного `content.html` нет, HTML-фрагменты хранятся внутри Markdown. 4 октября 2026 года добавлена обязательная provider-owned проекция видимости узлов: без подходящей записи сущность не существует для actor, а ACL независимо ограничивает допустимые действия. 6 октября 2026 года VFS-проекция упрощена: HTML Provider публикует только metadata со ссылкой `bundle_root_uri`, не создаёт логические представления файлов bundle и не делегирует их чтение или запись.
> Связанные документы: [практический план реализации](../VFS_V2_HTML_PROVIDER_IMPLEMENTATION_PLAN_RU.md), [контракт HTML-редактора](../HTML_EDITOR_CONTRACT_RU.md), [серверные хуки VFSv2](VFS_V2_SERVER_HOOKS_DECISION_RU.md), [Shared Provider](VFS_V2_SHARED_PROVIDER_DECISION_RU.md), [scope resolution](VFS_V2_SCOPE_RESOLUTION_DECISION_RU.md), [ACL lifecycle](ACL_LIFECYCLE_ARCHITECTURE_RU.md), [текущая реализация VFSv2](../VFS_V2_IMPLEMENTATION_RU.md), [концепция ACLv2](../ACL_V2_CONCEPT_RU.md).

## 1. Контекст

Система должна представлять HTML-сайт как логическую структуру страниц, блоков,
публикаторов и публикаций. При этом содержимое страниц, блоков и assets уже может
находиться в разных файловых VFS-провайдерах:

```text
local@alice[site-acme]:///website/pages/home/{content.md,style.css,script.js}
s3@bob[site-acme]:///content/blocks/footer/{content.md,style.css,script.js}
```

HTML Provider не должен становиться ещё одним обязательным файловым backend и не
должен знать внутреннее устройство `local`, S3, CAS или любого другого
провайдера. Его задача — владеть HTML-доменом:

- метаданными сайта;
- деревом страниц;
- метаданными страниц и блоков;
- привязками логических ресурсов к физическим VFS-ресурсам;
- процессом подготовки и активации публикаций.

Файловые провайдеры продолжают владеть физическими каталогами и байтами. ACL
остаётся единственным системным компонентом, принимающим внутреннее решение о
доступе. VFS Core разрешает URI, применяет ACL и маршрутизирует каждую операцию.

## 2. Решение

Принимается следующая модель:

```text
Метаданные и дерево сайта       = HTML Provider
Физические страницы и assets   = произвольные файловые providers
Адрес физического ресурса       = канонический VFS URI
Системная ACL-идентичность      = канонический VFS URI
Межпровайдерный вызов           = actor-bound BoundVFS
Права                           = ACL
Публикация                      = manifest ссылок на файлы публикаторов
```

Изменять HTML-домен можно двумя способами:

```text
прямой путь   = клиент вызывает ресурсы и команды HTML Provider через VFS
сценарный путь = клиент вызывает зарегистрированный VFS hook, который выполняет
                 несколько обычных VFS-операций от того же actor
```

Прямой VFS-контракт является основным и самодостаточным. Hook упрощает
составной пользовательский сценарий, но не становится обязательной частью HTML
Provider, не получает доступ к его Store и не заменяет доменные команды.

Для каждого сайта создаётся отдельный scope. В scope находится одно логическое
HTML-подключение сайта и одно или несколько файловых подключений публикаторов:

```text
scope: site-acme
│
├── html@site
│   ├── дерево и метаданные
│   └── публикации
│
├── local@alice
│   └── физические файлы Alice
│
├── s3@bob
│   └── физические файлы Bob
```

Количество и тип файловых подключений не являются частью контракта HTML
Provider. Один публикатор может иметь один или несколько зарегистрированных
корней в любом файловом provider.

## 3. Архитектурные границы

| Компонент | Ответственность |
| --- | --- |
| Auth | Устанавливает доверенного `actor` |
| ACL | Разрешает действие actor над каноническим URI |
| VFS Core | Разрешает scope и connection, применяет ACL, вызывает provider |
| HTML Provider | Владеет HTML-метаданными, деревом и публикациями |
| Файловый provider | Владеет физическим деревом и байтами |
| Scopes Provider | Владеет scope и конфигурацией подключений |
| Hook Registry/Runtime | Хранит и исполняет необязательные составные VFS-сценарии |
| HTTP Hook Adapter | Преобразует HTTP-вызов в обращение к независимому Hook Runtime |

HTML Provider не должен:

- читать таблицы, Store или backend другого provider;
- импортировать внутренний пакет другого provider для выполнения его операций;
- обращаться к `local`, S3, CAS или внешнему backend напрямую;
- получать Auth service или ACL management service;
- выполнять внутреннюю операцию от имени владельца, системного actor или
  `service:html-provider` вместо actor исходного запроса;
- считать регистрацию публикатора или строки metadata разрешением доступа;
- вводить глобальный `resource_id` для страниц и блоков;
- добавлять HTML-специфичные виды правил в универсальную ACL-модель;
- строить общую SQL-транзакцию со Store файлового, Scopes или ACL Provider.

HTML Provider может:

- хранить собственные внутренние ID;
- хранить канонические URI чужих ресурсов как доменные ссылки;
- обращаться к целевому ресурсу через `BoundVFS`;
- выполнять собственную доменную валидацию после ACL `allow`;
- хранить локальную проекцию внешних метаданных, не используя её как право;
- вести идемпотентные многошаговые операции и reconciliation.

Hook Runtime находится за границей HTML-домена. Он может вызывать публичные
ресурсы HTML Provider, файловых providers, Scopes Provider и ACL Provider только
через actor-bound VFS. HTML Provider не импортирует Hook Runtime, не регистрирует
HTTP routes и не знает, была ли его команда вызвана напрямую клиентом или
внутри hook-сценария.

## 4. Идентичность и адресация

Системной идентичностью любого ресурса является канонический VFS URI:

```text
html@site[site-acme]:///pages/home/info.json
local@alice[site-acme]:///website/pages/home/content.md
```

Первый URI адресует metadata HTML Provider, второй — физический файл файлового
provider. HTML Provider не создаёт параллельный URI для байтов source. Клиент
получает `bundle_root_uri` из metadata и обращается к дочерним physical URI через
VFS Core; доступ к `info.json` не предоставляет доступ к физическим файлам.

HTML Provider может использовать числовые ID, `page_key` и `block_key` внутри
своего домена. Они:

- нужны для связей в собственном Store;
- могут использоваться как стабильные сегменты логического пути;
- не становятся глобальными идентификаторами;
- не передаются ACL отдельно от полного URI;
- не связываются с inode, artifact ID или внутренним ID файлового provider.

В первой версии `page_key` и `block_key` после создания неизменяемы. Название,
slug и положение в дереве изменяются без переименования логического URI. Это
уменьшает зависимость MVP от ещё не реализованного ACL lifecycle.

## 5. Доменная модель

### 5.1. Site

`Site` описывает логический сайт одного HTML connection:

```go
type Site struct {
    ID                  int64
    Name                string
    OwnerSubjectKey     string
    BaseURL             string
    ApplicationTemplateKey     string
    ApplicationTemplateVersion string
    DefaultThemeID      *int64
    ActivePublicationID *int64
    TreeRevision        int64
    ModelRevision       int64
    VisibilityRevision  int64
}
```

`ID` является внутренним ключом HTML Store. `OwnerSubjectKey` — доменные
метаданные владения и не заменяет ACL-проверку. `BaseURL` используется при
построении публичных URL и `sitemap.xml`. Выбранный application template
описывается отдельно и определяет корневой HTML shell и его статический runtime.

### 5.2. PublisherRoot

`PublisherRoot` регистрирует область физического хранения публикатора:

```go
type PublisherRoot struct {
    ID                  int64
    SiteID              int64
    PublisherSubjectKey string
    RootURI             string
    Purpose             string
    Status              string
}
```

Начальные назначения `Purpose`:

```text
content
assets
publication
```

Регистрация корня означает, что HTML-домен разрешает создавать привязки к
ресурсам внутри этого корня. Она не предоставляет actor ACL-права на корень или
его содержимое.

### 5.3. Page

`Page` является узлом навигационного дерева и логическим HTML-ресурсом:

```go
type Page struct {
    ID                  int64
    SiteID              int64
    ParentID            *int64
    PageKey             string
    Slug                string
    Title               string
    Note                 string
    Description          string
    Status               string
    Position            int
    ThemeID              *int64
    PublisherSubjectKey string
    BundleRootURI           string
    TemplateBlockID     *int64
    RootBlockID         *int64
    Revision             int64
    CreatedAt            time.Time
    UpdatedAt            time.Time
}
```

Для MVP страница ссылается через `BundleRootURI` на физический каталог. Ссылка
возвращается в `info.json` и не превращается в отдельное файловое представление
HTML Provider. В физическом каталоге
обязательны три именованных артефакта контракта: `content.md`, `style.css`
и `script.js`. `content.md` является единственным источником контента и может
содержать inline HTML-фрагменты; отдельного `content.html` нет. Поля
template/root позволяют позднее использовать композицию из блоков без изменения
модели дерева.

Значение полей:

| Поле | Семантика |
| --- | --- |
| `PageKey` | Неизменяемый ключ страницы внутри HTML Provider |
| `Slug` | Англоязычный сегмент публичного URL |
| `Title` | Обычное отображаемое название |
| `Note` | Короткое пояснение для редакторов |
| `Description` | Подробное описание для редактора и поиска |
| `Status` | Редакционное состояние страницы |
| `Position` | Порядок среди детей одного parent |
| `ThemeID` | Выбранная тема либо default theme сайта |

Отношения между страницами используют `Page.ID`, а не `Title`, `Name`, `Slug`
или `PageKey`. В Store parent хранится как `ParentID`; в editor model и layout
связи также ссылаются на provider-local page ID. Переименование страницы,
изменение key-подобного отображаемого имени или slug не должно перепривязывать
connections.

`PageKey` остаётся частью логического VFS URI `/pages/<page-key>` и удобным
стабильным именем ресурса. `Page.ID` остаётся локальным значением HTML Provider,
не становится ACL identity и не используется за пределами scope сайта без
явного контекста этого сайта.

Page ID не переиспользуется после удаления в пределах одного site. Экспорт,
импорт или клонирование сайта может назначить новые IDs; такая операция обязана
переписать `ParentID` и все layout-ссылки по таблице соответствия. Поэтому ID
является устойчивой ссылкой внутри работающего сайта, но не переносимым
межсайтовым идентификатором.

Типы страницы и поисковые теги являются множествами и хранятся отдельно:

```text
html_page_types(page_id, type)
html_page_search_tags(page_id, tag)
```

Тип описывает семантический класс страницы, например `landing`, `catalog`,
`product` или `article`. Поисковые теги используются для поиска и не заменяют
тип страницы.

Начальные статусы:

```text
draft
ready
hidden
archived
```

`published` не хранится как вручную изменяемый статус. Страница считается
опубликованной, если она входит в активный publication manifest. Это исключает
рассинхронизацию между статусом строки и активной публикацией.

Публичный маршрут строится из `Slug` страницы и её предков. Slug уникален среди
siblings. Изменение slug или parent меняет публичный маршрут, но не меняет
логический URI `/pages/<page-key>`.

### 5.4. Block

`Block` является самостоятельным логическим ресурсом:

```go
type Block struct {
    ID                  int64
    SiteID              int64
    BlockKey            string
    Name                string
    Kind                string
    PublisherSubjectKey string
    BundleRootURI           string
}
```

Начальные виды блока:

```text
template
content
layout
widget
fragment
```

Для Block действует тот же физический bundle-контракт, что и для Page:
`content.md`, `style.css`, `script.js`. `meta.json` содержит ссылку на корень
bundle, а операции над файлами выполняются по physical URI. Результат просмотра
или публикации является отдельным
производным артефактом публикации, а не четвёртым редактируемым файлом bundle.

### 5.5. Publication

```go
type Publication struct {
    ID          int64
    SiteID      int64
    Key         string
    Status      string
    CreatedBy   string
    ManifestURI string
    ErrorCode   string
}
```

Публикация фиксирует снимок дерева и набор канонических URI файлов, уже
подготовленных в подключениях публикаторов. HTML Provider не создаёт отдельное
централизованное файловое подключение публикаций.

### 5.6. Theme

Тема является metadata-ресурсом HTML Provider и ссылается на физические файлы
оформления:

```go
type Theme struct {
    ID            int64
    SiteID        int64
    ThemeKey      string
    Name          string
    StylesheetURI string
    TemplateURI   string
}
```

CSS и шаблоны физически остаются в connections публикаторов. HTML Provider
проверяет и читает их по каноническим URI через `BoundVFS`. Если `Page.ThemeID`
не задан, применяется `Site.DefaultThemeID`.

### 5.7. ApplicationTemplate и статический runtime

`ApplicationTemplate` описывает корневой HTML shell приложения сайта и
разрешённый набор его статических файлов. Это не `Theme`: тема оформляет
страницы сайта, а application template запускает клиентское приложение,
подключает основной CSS/JavaScript и общие библиотеки.

Логическое определение template содержит:

```text
template key
version
entrypoint, обычно index.html
asset manifest
MIME type каждого asset
cache policy
optional compatibility aliases
```

Для MVP template устанавливается как доверенный versioned package в connection
конкретного сайта. После установки его manifest и файлы доступны в этом же
connection под `/templates/<template-key>/<version>/`. HTML Provider выдаёт
только assets из allowlist manifest и не публикует произвольный каталог
процесса.

Пакет устанавливает actor, имеющий право изменять templates этого сайта:
обычно создатель сайта или назначенный администратор. Начальный системный
template устанавливается тем же способом во время bootstrap сайта. Manifest
приходит вместе с package, HTML Provider валидирует его и регистрирует версию.
Установленная версия immutable: изменение файлов требует новой версии, а выбор
версии для публичного сайта вступает в силу только через публикацию.

Site хранит выбранные `ApplicationTemplateKey` и
`ApplicationTemplateVersion`. Версия фиксируется явно, чтобы обновление
серверного package не меняло работающий сайт без управляемого переключения.
При публикации key/version сохраняются в publication manifest. Публичный
entrypoint и runtime берутся из активного manifest, поэтому изменение draft
настроек Site не меняет работающий сайт до следующей публикации.

Текущий проект фактически содержит начальный template package:

```text
entrypoint
  index.html

runtime
  js/app.js
  js/vfsv2.js
  css/style.css

vendor libraries
  js/markdown-it.min.js

assets
  img/favicon.png
  img/icons.svg
  SVG sprites
  foundation-icons CSS и font files
```

В `data/HTML/frontend` одновременно присутствуют служебные файлы: generator
source, generator binary, zip-архив, копии SVG и swap-файл. Они не должны
попадать в публичную статику. Доступ определяется manifest allowlist, а не
фактом нахождения файла рядом с `index.html`.

### 5.8. EditorLayout

Визуальное состояние редактора дерева хранится как отдельный версионированный
XML-документ:

```go
type EditorLayout struct {
    SiteID        int64
    SchemaVersion int
    Revision      int64
    XML           []byte
    UpdatedAt     time.Time
}
```

Layout XML является источником истины только для координат, размеров, вида узлов
и визуальной геометрии connections. Доменная структура, функциональные поля и
сами отношения parent/child остаются в таблицах HTML Provider.

Второй документ, `model.xml`, не хранится как независимый источник истины. Он
формируется из актуальной доменной модели при чтении и является строго read-only.
Все функциональные изменения проходят через публичные ресурсы и команды HTML
Provider, которые внутри сходятся в одном доменном сервисе страниц. Прямые
клиенты и VFS hooks используют один контракт и одинаковые инварианты.

### 5.9. SiteSEO

```go
type SiteSEO struct {
    SiteID     int64
    RobotsText string
    UpdatedAt  time.Time
}
```

`robots.txt` является конфигурационным документом HTML-домена и может храниться
в HTML Store. Он не считается содержимым страницы или asset публикатора.

### 5.10. NodeVisibility

Каждая доменная сущность, проецируемая HTML Provider как VFS-узел, имеет явный
набор получателей видимости. Запись видимости отвечает только на вопрос
«существует ли этот узел в представлении данного actor» и не предоставляет
права выполнить над ним действие.

```go
type NodeVisibility struct {
    SiteID      int64
    NodeKind    string
    NodeKey     string
    AudienceKey string
    CreatedAt   time.Time
}
```

`NodeKind` и `NodeKey` являются provider-local ссылкой на сущность. Они не
становятся системной идентичностью ресурса: для ACL ею остаётся полный
канонический VFS URI. Начальные `NodeKind`:

```text
site
page
block
theme
publisher
publication
```

`AudienceKey` поддерживает:

```text
all       любой actor, включая guest
guest     только неаутентифицированный actor
user:17   точный доверенный subject текущего actor
```

Другие типы subject допускаются только тогда, когда они присутствуют в
доверенном request context. HTML Provider не вызывает Auth service, не читает
его таблицы и не вычисляет членство в группах самостоятельно. До появления
такого kernel-контракта group selectors не принимаются.

Узел видим, если существует хотя бы одна запись, подходящая actor. Если
подходящей записи нет, HTML Provider ведёт себя так, будто сущность для actor не
существует: `Stat`, `OpenFile`, `ReadDir`, document lookup и `Control` по этому
узлу возвращают `not_found`. Это правило применяется не только при формировании
списка и не может быть обойдено угадыванием `page_key` или `block_key`.

Документы metadata, принадлежащие сущности, наследуют её visibility. Например,
`info.json` страницы не требует отдельной строки и недоступен, если Page не
видна actor. Physical `content.md`, `style.css` и `script.js` не входят в эту
проекцию: их доступ определяет ACL файловых URI. Каталоги-коллекции `/pages`,
`/blocks` и аналогичные показывают только видимых потомков.

Для дерева Page действует дополнительное правило: Page эффективно видима,
только если подходят записи самой Page и каждого её предка. Невидимый parent
скрывает всё поддерево; HTML Provider не переподвешивает видимых потомков и не
раскрывает их как корневые страницы.

Создание сущности и её начального набора visibility выполняется одной локальной
транзакцией. Команда создания обязана получить непустой `visible_to`; неявного
добавления `all` или `guest` нет. Изменение набора выполняется отдельной
идемпотентной командой `set-visibility` с optimistic revision. Для миграции
существующих данных безопасный default — записи для owner сайта и publisher
сущности; `all` и `guest` появляются только по явному решению.

## 6. Собственное хранилище HTML Provider

HTML Provider использует собственный Store. Для первой реализации рекомендуется
SQLite со следующими логическими таблицами:

```text
html_sites
html_publisher_roots
html_pages
html_page_types
html_page_search_tags
html_node_visibility
html_blocks
html_themes
html_editor_layouts
html_site_seo
html_publications
html_publication_resources
html_operations
```

Назначение таблиц:

| Таблица | Содержимое |
| --- | --- |
| `html_sites` | Название, владелец, выбранный application template и активная публикация |
| `html_publisher_roots` | Публикатор и зарегистрированные канонические root URI |
| `html_pages` | Дерево, page metadata и physical bundle root URI |
| `html_page_types` | Семантические классы страниц |
| `html_page_search_tags` | Теги страниц для поиска |
| `html_node_visibility` | Явная provider-owned проекция: какие subject selectors видят доменный узел |
| `html_blocks` | Block metadata и physical bundle root URI |
| `html_themes` | Темы и ссылки на физические stylesheet/template |
| `html_editor_layouts` | Layout XML, визуальные параметры и layout revision |
| `html_site_seo` | Содержимое `robots.txt` и SEO-настройки сайта |
| `html_publications` | Состояния и результаты публикаций |
| `html_publication_resources` | Снимок logical path и target URI публикаторов |
| `html_operations` | Состояния идемпотентных многошаговых операций |

`html_operations` хранит только операции самого HTML-домена, например
подготовку и активацию публикации. Состояния выполнения универсальных VFS hooks
принадлежат Hook Runtime и его Execution Store; HTML Provider не читает и не
изменяет это хранилище.

Минимальная схема visibility projection:

```sql
CREATE TABLE html_node_visibility (
    site_id       INTEGER NOT NULL,
    node_kind     TEXT NOT NULL,
    node_key      TEXT NOT NULL,
    audience_key  TEXT NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (site_id, node_kind, node_key, audience_key),
    FOREIGN KEY (site_id) REFERENCES html_sites(id) ON DELETE CASCADE
);
```

Store не делает join с Auth или ACL и не хранит здесь действия `r/w/x`.
Domain service проверяет, что `(node_kind, node_key)` адресует сущность того же
site, и каскадно очищает её visibility при удалении. Для каждой существующей
сущности требуется хотя бы одна запись; отсутствие подходящей actor записи
означает невидимость, а не разрешение по умолчанию.

Байты application templates не сохраняются в metadata-таблицах. Установленный
пакет принадлежит connection сайта и проецируется HTML Provider под
`/templates/<key>/<version>`. Реализация может держать package bytes в своём
blob-хранилище либо делегировать чтение на зарегистрированный package URI, но
это внутренняя деталь provider: его канонический VFS-адрес остаётся site-local.

Таблицы HTML Provider не содержат байты HTML, CSS, JavaScript, изображений и
других assets. Они не имеют foreign key на таблицы Auth, ACL, Scopes или
файловых providers. `connection.ID` или эквивалентный локальный ключ используется
для изоляции данных разных HTML connections.

Schema v2 заменяет доменное поле `source_uri` на `bundle_root_uri`. Для legacy
пути `.../home.html` metadata backfill вычисляет root `.../home`; старый столбец
остаётся временной деталью совместимости и не публикуется в DTO. Эта SQL-миграция
не переносит чужие физические байты: если legacy deployment уже содержит
файлы, создание каталога, перенос содержимого в `content.md` и создание
`style.css`/`script.js` выполняются отдельной actor-bound VFS-операцией с
повторной ACL-проверкой, после чего reconciliation подтверждает bundle.

Schema v3 добавляет `html_sites.visibility_revision` и
`html_node_visibility`. Миграция создаёт записи только для owner сайта и
publisher соответствующей сущности; она намеренно не выдаёт `all` или `guest`.

Основные ограничения:

- `page_key` уникален внутри сайта;
- `block_key` уникален внутри сайта;
- slug уникален среди соседних страниц;
- parent страницы принадлежит тому же сайту;
- template и root block принадлежат тому же сайту;
- theme принадлежит тому же сайту;
- канонические URI сохраняются после разбора и нормализации;
- обычное изменение metadata не меняет owner или publisher;
- создание сущности и начальных visibility entries атомарно;
- `all` и `guest` никогда не добавляются миграцией или командой неявно;
- удаление metadata не удаляет физический target.

## 7. VFS-проекция

Site connection содержит только данные конкретного сайта:

```text
html@site[site-acme]:///
├── site.json
├── tree.json
├── config/
│   └── robots.txt
├── editor/
│   ├── model.xml
│   └── layout.xml
├── templates/
│   └── <template-key>/
│       └── <version>/
│           ├── manifest.json
│           └── files/
│               └── ...
├── themes/
│   └── <theme-key>/
│       └── info.json
├── publishers/
│   └── <publisher-key>/
│       └── roots.json
├── pages/
│   └── <page-key>/
│       └── info.json
├── blocks/
│   └── <block-key>/
│       └── meta.json
├── publications/
│   └── <publication-key>/
│       ├── status.json
│       └── manifest.json
└── public/
    ├── manifest.json
    ├── sitemap.xml
    ├── robots.txt
    └── ...
```

Виртуальные документы:

- `site.json` формируется из `Site`;
- `tree.json` формируется из эффективно видимых actor строк `html_pages`;
- `editor/model.xml` формируется из актуальной доменной модели и не хранится как
  параллельный источник истины;
- `editor/layout.xml` хранит нормализованное визуальное состояние редактора;
- `templates` содержит единственную site-local проекцию установленных пакетов
  шаблонов; отдельная копия в `public` не создаётся;
- `config/robots.txt` является редактируемой SEO-конфигурацией сайта;
- `info.json` и `meta.json` формируются из metadata и содержат канонический
  `bundle_root_uri` физического каталога;
- файлы bundle не проецируются под `html@...`: клиент читает и изменяет их по
  physical URI через обычный VFS Core и ACL;
- `public` проецирует только активную публикацию;
- `public/sitemap.xml` генерируется из guest-visible части активного publication manifest;
- `public/robots.txt` возвращает robots snapshot активной публикации.

Изменения доменной структуры выполняются через типизированные команды `Control`.
Это не добавляет новых ACL actions: команда защищается обычным действием `x` на
каноническом URI команды или управляющего каталога.

Примеры команд:

```text
Control(/publishers, "register-root", payload)
Control(/pages, "create", payload)
Control(/pages/<page-key>, "update", payload)
Control(/pages/<page-key>, "move", payload)
Control(/pages/<page-key>, "delete", payload)
Control(/pages/<page-key>, "set-visibility", payload)
Control(/blocks, "create", payload)
Control(/blocks/<block-key>, "update", payload)
Control(/blocks/<block-key>, "set-visibility", payload)
Control(/templates, "install", payload)
Control(/, "publish", payload)
```

Обычный `Delete` логического ресурса, если будет поддержан, удаляет только
metadata HTML Provider. Для страницы с детьми он должен требовать явно
выбранную доменную семантику либо возвращать `resource_in_use`. Удаление
физического source является отдельной явной операцией над его URI.

### 7.1. Выдача корня сайта и статики шаблона

Template package имеет один канонический VFS-адрес в connection конкретного
сайта:

```text
html@site[site-acme]:///templates/
└── <template-key>/
    └── <version>/
        ├── manifest.json
        └── files/
            └── ...
```

Копия `public/_static` не создаётся. Publication manifest хранит site-local
`template_manifest_uri` и digest. Поэтому manifest, entrypoint и assets
существуют в VFS один раз — под `/templates` этого сайта.

VFS root site connection остаётся каталогом доменных ресурсов. Его нельзя
одновременно трактовать как байты `index.html`. Преобразование браузерного URL
в канонический template URI выполняет внешний Site HTTP Adapter:

```text
GET https://example.com/
  -> Read html@site[site-acme]:///public/manifest.json
  -> template_manifest_uri
  -> Read html@site[site-acme]:///templates/default-spa/1/files/index.html

GET https://example.com/_static/js/app.js
  -> list html@site[site-acme]:///templates/default-spa
  -> select last installed version
  -> Read html@site[site-acme]:///templates/default-spa/<latest>/files/js/app.js
```

Для `/` и `/_static/*` adapter использует последнюю установленную версию
application template с key из typed input site adapter-а. В entrypoint ссылки на
собственный runtime используют prefix `/_static/`. Такой namespace отделяет
системный SPA runtime от пользовательских маршрутов `/about`, `/catalog` и
assets публикаторов. Поскольку внешний URL не versioned, ответы требуют
revalidation по ETag и не получают `immutable` cache policy.

Текущая реализация проекта ведёт себя как SPA:

```text
extensionless path или *.html -> data/HTML/frontend/index.html
/js/app.js                    -> data/HTML/frontend/js/app.js
/css/style.css                -> data/HTML/frontend/css/style.css
/img/...                      -> data/HTML/frontend/img/...
/static/...                   -> тот же frontend-каталог через FileServer
```

Целевой provider не должен сохранять два неявных способа доступа ко всему
каталогу. Template manifest явно сопоставляет старые необходимые файлы новому
публичному namespace:

```text
/_static/js/app.js
/_static/js/vfsv2.js
/_static/vendor/markdown-it.min.js
/_static/css/style.css
/_static/img/favicon.png
/_static/img/icons.svg
/_static/fonts/...
```

При миграции можно временно объявить aliases `/js`, `/css`, `/img` и `/static`
в manifest конкретного template. Они не являются универсальной частью HTML
Provider и не дают доступ к файлам, отсутствующим в allowlist.

Перед первой упаковкой текущий frontend нужно привести к одному base path:
`index.html` сейчас использует `/js`, `/css` и `/img`, `app.js` содержит
`./static/img/icons.svg`, а загрузчик Markdown использует
`/js/markdown-it.min.js`. Template build либо меняет эти ссылки на
`/_static/...`, либо manifest временно объявляет точные aliases для
них. Общий fallback на весь каталог для совместимости запрещён.

Правила разрешения публичного HTTP-запроса:

1. API и служебные server routes обрабатываются до Site HTTP Adapter.
2. Зарезервированный `/_static/` разрешается только через manifest последней
   установленной версии template, выбранной typed input site adapter-а; отсутствующий asset
   возвращает `404`, а не SPA entrypoint.
3. Явный опубликованный asset разрешается через active publication manifest.
4. `/` и существующий публичный маршрут страницы возвращают template entrypoint
   в SPA-режиме либо готовый page artifact в server-rendered режиме.
5. Неизвестный маршрут возвращает `404`; наличие точки или расширения не должно
   само по себе открывать файл server filesystem.

Отсутствие Page является ожидаемым результатом разрешения, а не отказом hook
runtime: `get-page` завершается успешно с `found=false`. Site HTTP Adapter
преобразует такой output в HTTP 404. При явном `Accept: text/html` ответом
служит простая HTML-страница; API-клиент получает JSON `page_not_found`.
Выбор representation выполняется по `Accept`, а не по `User-Agent`, и ответ
содержит `Vary: Accept`. Ошибкой выполнения hook
остаются только невалидный input и сбои чтения, декодирования или доступа.

До реализации active publication ограниченный demo Site HTTP slice считает
публично активным только status `ready`. `draft`, `hidden` и `archived`, а также
любой descendant неактивного parent, разрешаются как `found=false` без раскрытия
существования metadata. Это временная preview/public policy demo, а не замена
целевого publication manifest.

Если active publication отсутствует, публичный HTTP-root возвращает состояние
`not_found`/«site is not published». Draft template можно читать прямо по его
site-local URI `/templates/...` в авторизованном preview, но он не становится
публичным автоматически.

Provider возвращает корректный MIME type из manifest или безопасной таблицы по
расширению. `index.html` получает короткий cache policy либо `no-cache`, потому
что выбор template или активной публикации может измениться. Версионированные
assets могут получать долгий `Cache-Control: public, immutable` и ETag по
содержимому.

Runtime template, vendor libraries и пользовательская статика имеют разные
владельцы:

| Вид | Где находится | Как публикуется |
| --- | --- | --- |
| Application runtime | `/templates` в connection сайта | Site HTTP Adapter читает site-local template URI |
| Vendor library runtime | Внутри того же versioned template package | Через его manifest |
| Theme CSS/template | В connection публикатора | URI в HTML metadata и publication manifest |
| Site assets | В connection публикатора | URI в publication manifest |
| Block/plugin content | В файловом provider либо будущем library provider | Только через явную регистрацию и VFS |

Каталоги `data/HTML/block/plugin` и `data/HTML/block/pages` текущего проекта не
должны автоматически становиться публичной статикой. Их script/style/content
являются библиотекой блоков или содержимым и должны получить собственные
логические ресурсы и manifest, а не открытый file-server prefix.

## 8. Создание scope и подключений

HTML Provider не может создать собственный scope или connection прямой записью
в таблицы VFS. Начальный bootstrap выполняется application-level orchestration
через публичные VFS-контракты владеющих providers:

```text
1. Создать scope сайта через Scopes Provider.
2. Создать файловые connections публикаторов.
3. Создать html@site в scope сайта.
4. Настроить начальные ACL-права через ACL Provider.
5. Инициализировать metadata сайта и его явный `visible_to` в HTML Provider.
```

Рекомендуемый внешний интерфейс такого сценария — зарегистрированный
`create-site` hook согласно ADR-008. Hook последовательно вызывает публичные
VFS-контракты и сохраняет исходного actor. Сам HTML Provider не создаёт scope,
connection или ACL и не получает прямой доступ к их Store.

## 9. Регистрация корня публикатора

Пример команды:

```text
Control(
    html@site[site-acme]:///publishers,
    "register-root",
    {
        "publisher_subject_key": "user:17",
        "root_uri": "local@alice[site-acme]:///website",
        "purpose": "content",
        "visible_to": ["user:17"]
    }
)
```

HTML Provider:

1. Получает actor из доверенного request context.
2. Разбирает `root_uri` как канонический URI.
3. Проверяет, что target находится в scope текущего сайта.
4. Вызывает `BoundVFS.Stat` с тем же actor.
5. Проверяет, что target является каталогом.
6. Применяет локальные ограничения дубликатов и purpose.
7. Сохраняет регистрацию в собственном Store.

Проверка `publisher_subject_key` через прямой Auth service запрещена. Если
существование subject необходимо подтвердить, используется публичный ресурс
владеющего домена через `BoundVFS` либо проверка выполняется в orchestration до
вызова HTML Provider.

## 10. Создание страницы и блока

Физический bundle создаётся в файловом подключении до регистрации логического
ресурса:

```text
MKDIR local@alice[site-acme]:///website/pages/home
PUT local@alice[site-acme]:///website/pages/home/content.md
PUT local@alice[site-acme]:///website/pages/home/style.css
PUT local@alice[site-acme]:///website/pages/home/script.js

Control(
    html@site[site-acme]:///pages,
    "create",
    {
        "page_key": "home",
        "slug": "home",
        "title": "Главная",
        "bundle_root_uri":
            "local@alice[site-acme]:///website/pages/home",
        "visible_to": ["user:17"]
    }
)
```

Это прямой низкоуровневый сценарий: клиент сам выполняет несколько независимых
VFS-операции. Он полезен для CLI, импорта, отладки и клиентов, которым нужен
полный контроль над каждым шагом.

Пользовательский интерфейс может вместо этого вызвать зарегистрированный hook
`create-page-with-content`. Такой hook:

```text
1. Создаёт каталог bundle и три обязательных файла по URI выбранного публикатора.
2. Вызывает create страницы в HTML Provider.
3. При необходимости сохраняет начальное положение блока в layout.
4. Возвращает созданную страницу и новые revisions.
```

Hook выполняет те же публичные VFS-операции и не записывает напрямую в HTML
Store. Если второй шаг не выполнен после успешного создания файла, execution
остаётся частично завершённым и может быть повторено идемпотентно. Bundle нельзя
считать автоматически удалённым: безопасная компенсация должна быть явным
шагом конкретного hook-сценария.

При регистрации HTML Provider:

1. Канонизирует `bundle_root_uri`.
2. Проверяет совпадение scope.
3. Находит зарегистрированный root, содержащий target URI.
4. Безопасно проверяет принадлежность по сегментам канонического пути, а не по
   строковому prefix.
5. Вызывает `BoundVFS.Stat` с исходным actor.
6. Проверяет, что root является каталогом, а `content.md`, `style.css` и
   `script.js` существуют и являются файлами. Каждая проверка идёт отдельным
   `BoundVFS.Stat` с исходным actor.
7. Сохраняет metadata в локальной транзакции.

Строка регистрации не предоставляет доступ к target. Если actor не имеет права
на физический URI, внутренняя VFS-операция завершается отказом.

После чтения `info.json` клиент строит URI нужного файла относительно
`bundle_root_uri` и обращается к файловому provider напрямую через VFS Core:

```text
PUT local@alice[site-acme]:///website/pages/home/content.md
```

HTML Provider не участвует в этой операции, не буферизует байты и не создаёт
второй ACL-ресурс для того же файла. Фиксация, abort и ошибки записи остаются
ответственностью файлового provider и общих контрактов VFS. Доступ к metadata
страницы и доступ к physical bundle проверяются независимо на их канонических
URI.

## 11. Дерево страниц

Дерево строится только из metadata HTML Provider:

```text
Page.ParentID
Page.Position
Page.Slug
Page.Title
```

Каталоги файловых providers не определяют дерево сайта. Перемещение физического
файла также не перемещает страницу в навигационном дереве.

Правила первой версии:

- parent существует и принадлежит тому же сайту;
- page не может быть parent самой себе;
- page нельзя переместить под собственного потомка;
- новая страница добавляется последней среди siblings;
- позиции siblings после create, move и delete нормализуются;
- sibling slug уникален;
- удаление страницы с детьми требует явного режима `reject`, `cascade` или
  `promote_children`;
- изменение parent и position выполняется одной локальной транзакцией;
- `tree.json` загружает страницы сайта и собирает дерево в памяти;
- перед сборкой `tree.json` отбрасываются Page без подходящей visibility entry
  и поддеревья под невидимым parent;
- удаление страницы не удаляет её физический source.

Перемещение страницы внутри навигационного дерева не меняет логический URI
`/pages/<page-key>` и поэтому не требует переноса ACL-правил этого URI.

### 11.1. Функциональные поля страницы

Функциональные поля влияют на маршрутизацию, содержимое, поиск и публикацию:

```text
PageKey
Slug
Title
Note
Description
Types
SearchTags
ThemeID
Status
Position
```

Они хранятся в нормализованной доменной модели HTML Provider. Редакторский XML
ссылается на страницу по provider-local `Page.ID`, но не является
самостоятельным источником Title, Description, Theme или BundleRootURI.

### 11.2. Два XML-документа редактора

Редактор использует два документа с разной семантикой:

```text
editor/model.xml  = read-only проекция дерева и базовых данных
editor/layout.xml = сохраняемое визуальное состояние редактора
```

`model.xml` при каждом чтении строится из актуального HTML Store:

```xml
<site-model
  schema-version="1"
  tree-revision="45"
  model-revision="91"
>
  <nodes>
    <page id="142" key="home" title="Главная"
          description="Основная страница сайта" />
    <page id="157" key="catalog" title="Каталог"
          description="Каталог продукции" />
  </nodes>
  <connections>
    <connection kind="parent" from-id="142" to-id="157" order="0" />
  </connections>
</site-model>
```

Документ содержит только:

- provider-local ID страницы;
- неизменяемый `PageKey`;
- title и description;
- parent connections по provider-local ID и порядок;
- tree revision и model revision.

ID в документе не становится глобальной идентичностью и не используется ACL
отдельно от канонического URI. Owner, slug, status, theme, types, tags, physical
URI, ACL, connection config и секреты в `model.xml` не входят.

`model.xml` является строго read-only. Попытка открыть его для записи или
заменить должна возвращать `unsupported`. Все изменения выполняются через
централизованный интерфейс страниц.

`layout.xml` хранится постоянно:

```xml
<site-layout schema-version="1" layout-revision="12">
  <nodes>
    <node page-id="142" x="120" y="80" width="240" height="120"
          view="expanded" />
    <node page-id="157" x="420" y="80" width="240" height="120"
          view="collapsed" />
  </nodes>
  <connections>
    <connection from-id="142" to-id="157" bend-x="360" bend-y="140" />
  </connections>
</site-layout>
```

Layout хранит только координаты, размеры, visual mode и геометрию существующих
connections. `page-id`, `from-id` и `to-id` ссылаются на IDs из того же
`model.xml`. Запись connection в layout не создаёт отношение parent/child.
После изменения дерева устаревшая геометрия игнорируется и удаляется при
нормализации.

### 11.3. Централизованный интерфейс страниц

Редактор, обычная форма, API, CLI, import и hooks используют один публичный
VFS-контракт HTML Provider. Ни один из этих клиентов не обращается к HTML Store
напрямую.

Через VFS полные данные страницы читаются из:

```text
html@site[site-acme]:///pages/<page-key>/info.json
```

Операции разделяются по их семантике:

| Операция | Назначение | Revision |
| --- | --- | --- |
| Read `info.json` | Получить полные функциональные данные страницы | Возвращает page revision |
| Replace `info.json` | Заменить разрешённые функциональные поля | Ожидаемая page revision |
| `create` | Создать страницу и включить её в дерево | Ожидаемая tree revision |
| `move` | Сменить parent или порядок | Ожидаемая tree revision |
| `delete` | Удалить страницу по явно выбранному режиму | Ожидаемая tree revision |
| `set-visibility` | Атомарно заменить явный набор audience selectors | Ожидаемая visibility revision |
| Replace `layout.xml` | Сохранить только визуальное состояние | Ожидаемая layout revision |

`info.json` можно сделать заменяемым документом для обычных полей. Provider
обязан игнорировать или отклонять попытку изменить через него `ID`, `PageKey`,
`ParentID`, `Position`, owner, publisher и revisions. Изменение структуры через
замену JSON запрещено: структура меняется только доменными командами.

Тот же update может быть представлен командой `Control`, если единый механизм
условной записи документов ещё не реализован в VFS. Это транспортная форма, а
не другой доменный контракт.

Основные команды:

```text
Control(/pages, "create", payload)
Control(/pages/<page-key>, "update", payload)
Control(/pages/<page-key>, "move", payload)
Control(/pages/<page-key>, "delete", payload)
Control(/pages/<page-key>, "set-types", payload)
Control(/pages/<page-key>, "set-search-tags", payload)
Control(/pages/<page-key>, "set-theme", payload)
Control(/pages/<page-key>, "set-visibility", payload)
```

После успешной команды следующий `model.xml` автоматически отражает изменения,
если они относятся к дереву, title или description.

Под «изменить metadata напрямую» в этом ADR понимается Replace или Control по
каноническому URI HTML Provider. Прямая запись в SQLite, repository или
PageService из HTTP adapter, hook runtime или другого provider-а запрещена.

### 11.4. Структурные операции

Создание, перемещение, изменение порядка и удаление дерева должны выражать одно
пользовательское намерение одной доменной командой. Frontend не должен
раскладывать удаление ветки на последовательность удаления каждого ребёнка.

Удаление поддерживает явные режимы:

| Режим | Поведение |
| --- | --- |
| `reject` | Вернуть `resource_in_use`, если существуют дети |
| `cascade` | Удалить страницу и всё её поддерево одной локальной транзакцией |
| `promote_children` | Удалить страницу, перенести детей к её parent и нормализовать порядок |

Ни один режим не удаляет физические source, theme или asset-файлы. Сценарий,
который должен удалить и metadata, и физический файл, оформляется отдельным
явным hook и показывает это действие пользователю.

Для перемещения клиент задаёт логическое положение относительно соседей:

```text
parentId = 210
afterId  = 205
```

Также допустимы `beforeId`, `first` и `last`. Все ID должны принадлежать тому же
site. HTML Provider самостоятельно
вычисляет числовой `Position` и нормализует siblings одной локальной
транзакцией. Переданный одновременно `beforeId` и `afterId` отклоняется.

### 11.5. Revisions

Используются независимые revisions:

```text
tree-revision   = create/delete/move/order
model-revision  = любое изменение данных, попадающих в model.xml
page-revision   = функциональные поля конкретной страницы
layout-revision = visual state
visibility-revision = наборы audience selectors узлов site
```

Structural-команда принимает ожидаемую tree revision. Изменение страницы
принимает её ожидаемую page revision. Layout сохраняется со своей revision.
`set-visibility` принимает ожидаемую site visibility revision. Конфликт
возвращает актуальную revision и не перезаписывает новое состояние.

Изменение title/description повышает page revision и model revision. Изменение
parent/position повышает tree revision и model revision. Изменение status,
theme или tags повышает page revision, но не обязано повышать model revision,
поскольку эти поля отсутствуют в `model.xml`.

Revision является условием записи, а не идентификатором страницы. Например,
`expectedPageRevision = 18` означает: применить изменение только в том случае,
если текущая версия страницы всё ещё равна 18.

При конфликте ответ должен содержать:

- стабильный код конфликта;
- ожидаемую и текущую revision;
- текущие значения затронутого ресурса либо URI, по которому их можно прочитать;
- сведения, достаточные frontend-у для повторной загрузки.

Frontend не удаляет локально введённые данные после конфликта. Он сохраняет
форму или локальную операцию, читает актуальное состояние и предлагает
повторить либо скорректировать изменение. Автоматическое трёхстороннее слияние
не требуется для MVP.

### 11.6. Открытие редактора

При открытии редактор:

1. Читает `editor/model.xml`.
2. Читает `editor/layout.xml`.
3. Объединяет функциональные nodes с визуальным состоянием.
4. При выборе страницы читает `/pages/<page-key>/info.json`.
5. Недостающим layout nodes назначает начальные координаты.
6. Игнорирует layout nodes удалённых или невидимых actor страниц.

Изменения через любой другой интерфейс отражаются в следующем чтении
`model.xml`. Перезаписывать layout при каждом внешнем изменении не требуется.

### 11.7. Изменения из редактора

Редактор не сохраняет `model.xml`. Например, изменение parent выполняется:

```text
Control(
    /pages/catalog,
    "move",
    {
        "parentId": 142,
        "first": true,
        "expectedTreeRevision": 45
    }
)
```

Изменение title и description выполняется через `update` с ожидаемой page
revision. Удаление всегда является явной командой; отсутствие страницы в
прочитанном или локальном XML ничего не удаляет.

Layout сохраняется независимо:

```text
PUT /editor/layout.xml
```

HTML Provider проверяет XML security, schema version, layout revision,
координаты и ссылки на существующие Page IDs. Неудача сохранения layout не
откатывает уже выполненную функциональную команду.

Для MVP предпочтительна модель «одно пользовательское намерение — одна
операция». Перетаскивание страницы вызывает `move`, удаление ветки вызывает
один `delete` с выбранным режимом, изменение формы страницы вызывает один
`update`. Редактор может сразу показать результат оптимистически, но считает
его сохранённым только после успешного ответа.

Это избавляет от обязательной серверной editing session и от необходимости
держать транзакцию всё время, пока пользователь открыт редактор.

### 11.8. Роль VFS hooks в HTML-редакторе

Hook применяется, когда одно действие пользователя требует нескольких
публичных VFS-операций. Рекомендуемые сценарии:

| Hook | Возможные шаги |
| --- | --- |
| `create-site` | Создать scope, connections, HTML site metadata и начальные ACL |
| `create-page-with-content` | Создать physical bundle, создать Page, записать начальный layout |
| `clone-page` | Скопировать physical bundle допустимым VFS-механизмом и создать новую Page |
| `delete-page-and-bundle` | Явно удалить Page и отдельно удалить physical bundle |
| `publish-site` | Проверить targets, подготовить manifest и активировать публикацию |

Hooks регистрируются через общий Hook SDK и выполняются независимым Hook Runtime
согласно ADR-008. Они не являются методами PageService и не находятся внутри
HTML Provider.

Прямой путь и hook-путь должны приводить к одному доменному поведению:

```text
прямой клиент -> VFS -> HTML Provider

клиент -> Hook Adapter -> Hook Runtime -> actor-bound VFS -> HTML Provider
```

HTML Provider не различает эти источники вызова. В обоих случаях VFS Core
проверяет ACL, а provider применяет одинаковые инварианты и revisions.

### 11.9. Сохранение нескольких локальных изменений

Редактор может позволить пользователю накопить локальный список действий,
например переместить одну страницу, переименовать другую и удалить третью.
Локальный draft принадлежит frontend-у и не делает `model.xml` изменяемым.

Для MVP доступны два способа сохранения:

1. Frontend последовательно вызывает обычные VFS-команды.
2. Frontend вызывает hook, который выполняет ту же последовательность на
   сервере и возвращает результат каждого шага.

Hook уменьшает число сетевых round trips, но сам по себе не превращает
несколько VFS-вызовов в одну транзакцию. При ошибке он должен вернуть:

- какие операции завершились;
- на какой операции произошёл отказ;
- стабильный код причины;
- можно ли безопасно повторить execution;
- актуальные revisions, если причиной стал конфликт.

Frontend удаляет локальную операцию только после подтверждённого успеха. Для
повторного запуска используется тот же idempotency key.

Если реальное использование покажет, что несколько изменений HTML-дерева
обязаны применяться строго целиком, HTML Provider может получить отдельную
пакетную доменную команду. Только она способна проверить набор изменений и
зафиксировать его одной транзакцией собственного Store. Hook сможет вызвать эту
команду, но не заменит её атомарность.

Универсальная команда `save-everything`, смешивающая дерево, layout, физические
файлы, ACL и публикацию, в MVP не вводится. Эти данные имеют разных владельцев,
разные revisions и разные границы отказа.

## 12. Блоки и композиция

Block хранит metadata и ссылку на физический source. HTML Provider не извлекает
граф вложенности из HTML и не выводит права одного блока из содержимого другого.

Page может явно ссылаться на:

```text
TemplateBlockID
RootBlockID
```

Перед назначением HTML Provider проверяет существование блоков внутри того же
сайта. Блок нельзя удалить, если он используется известной HTML Provider
ссылкой template/root. Ссылки внутри произвольного HTML в эту проверку не входят.

Каждый фактически открываемый логический блок и каждый target URI проходят свои
VFS/ACL-проверки.

## 13. Владение и авторизация

Система различает:

```text
владелец сайта
публикатор логического ресурса
владелец физического connection
actor текущего запроса
```

`OwnerSubjectKey` и `PublisherSubjectKey` являются metadata HTML-домена. Они
нужны для отображения, workflow и локальных инвариантов, но не являются
параллельной системой авторизации.

Назначение этих понятий:

| Понятие | Что означает | Чего не предоставляет |
| --- | --- | --- |
| Владелец сайта | Кто создал сайт или отвечает за него в HTML-домене | Автоматический доступ ко всем URI |
| Публикатор страницы | Кто предоставил или сопровождает её physical content | Право читать connection другого владельца |
| Владелец connection | Кто управляет physical storage через владеющий provider | Право изменять HTML-дерево |
| Actor | Кто выполняет текущую операцию | Права без отдельного решения ACL |

Передача отображаемого владельца сайта является отдельной доменной операцией и
не переносит ACL автоматически. Полный workflow передачи владения, если он
потребуется, оформляется hook-сценарием: он изменяет ACL через публичный ACL
Provider, а затем обновляет metadata HTML Provider. Частичный сбой такого
workflow хранится и восстанавливается Hook Runtime согласно ADR-008.

Правильная последовательность любой защищённой операции:

```text
Auth устанавливает actor
    ↓
VFS Core проверяет ACL логического HTML URI
    ↓
HTML Provider проверяет node visibility текущего actor
    ↓
HTML Provider выполняет остальную доменную валидацию
    ↓
BoundVFS сохраняет того же actor
    ↓
VFS Core проверяет ACL target URI
    ↓
target provider выполняет собственную валидацию
```

ACL `deny` нельзя расширить metadata-проверкой. ACL `allow` не отменяет отказ
HTML-домена или target backend.

Node visibility и ACL не взаимозаменяемы:

```text
нет visibility entry  -> узел не существует для actor (`not_found`)
есть visibility entry -> узел входит в его HTML-проекцию, но ещё не разрешён
ACL deny              -> операция запрещена независимо от visibility
ACL allow             -> provider всё ещё может отказать по visibility/domain/backend
```

Visibility entry не содержит действий и не может предоставить `r`, `w` или
`x`. ACL не создаёт visibility entry и само по себе не заставляет HTML Provider
показывать сущность. Команда `set-visibility` сначала проходит обычную ACL
проверку `x` своего канонического URI, затем меняет только provider-owned
проекцию.

Удаление или деактивация публикатора:

- запрещает новые привязки по правилам HTML-домена;
- не удаляет физические файлы;
- не удаляет автоматически существующие страницы и блоки;
- не отзывает ACL напрямую;
- может запускать отдельный авторизованный workflow отзыва через ACL Provider и
  `BoundVFS`.

## 14. Рабочий bundle и результат просмотра

Рабочий bundle Page и Block имеет фиксированный контракт:

```text
<bundle-root>/
├── content.md
├── style.css
└── script.js
```

`content.md` хранит Markdown и при необходимости inline HTML-фрагменты.
Самостоятельного `content.html` или редактируемого `view.html` в bundle нет.
Все три файла принадлежат файловому provider и имеют только свои physical URI.
HTML Provider хранит ссылку на корень каталога, но не проецирует файлы под
`html@...` и не участвует в их чтении или записи.

Если preview строится чтением закрытого физического bundle, actor должен иметь
право прочитать необходимые файлы этого bundle. Поэтому схема:

```text
allow r html page metadata
deny r physical content.md
```

не позволяет клиенту прочитать source или построить из него preview. Для source
всегда требуется отдельное разрешение на physical URI.

Просмотр без доступа к рабочему bundle достигается отдельным производным
артефактом, который публикация сохраняет в разрешённом файловом подключении:

```text
рабочий BundleRootURI  -> закрытые content.md/style.css/script.js
publication resource  -> подготовленный публичный HTML/CSS/JS
```

## 15. Публикация

HTML Provider не копирует содержимое в отдельное connection. Публикаторы заранее
размещают готовые к публикации файлы в собственных файловых connections, а
публикация фиксирует дерево и точный набор их канонических URI.

Пример:

```text
local@alice[site-acme]:///published/release-17/pages/home.html
s3@bob[site-acme]:///published/release-17/blocks/footer.html
```

Пути `/published/release-17` являются соглашением конкретных публикаторов, а не
обязательной структурой файлового provider. HTML Provider хранит только ссылки.

Состояния операции:

```text
pending -> validating -> ready -> active
                        └──────-> failed
```

Прямая команда HTML Provider выполняет доменную часть публикации:

1. Actor вызывает `Control(html root, "publish", payload)`.
2. HTML Provider создаёт operation ID и запись `pending`.
3. Фиксирует локальный снимок дерева, metadata и visibility revision.
4. Выбирает только эффективно видимые actor сущности и target URI их
   производных publication-ресурсов.
5. Через `BoundVFS.Stat` проверяет каждый target с тем же actor.
6. Сохраняет неизменяемый manifest ссылок в HTML Store.
7. Проверяет полноту manifest.
8. Переводит publication в `ready`.
9. Локальной транзакцией переключает `ActivePublicationID`.
10. Переводит publication в `active`.

Внешний `publish-site` hook может дополнить эту операцию подготовкой файлов,
проверкой пользовательского ввода и настройкой публичных ACL-ресурсов. Он не
подменяет publication state machine HTML Provider: создание и переключение
manifest остаются операциями владельца HTML-домена.

Actor должен иметь ACL-права:

- `x` на логическую команду публикации;
- `r` на каждый URI, включаемый в публикацию;
- `x` на необходимые scopes согласно модели VFS.

HTML Provider не выполняет публикацию от привилегированного service principal.

Публикация не анализирует HTML для поиска зависимостей. В MVP в manifest
включаются:

- явно выбранные Page и Block view URI;
- явно зарегистрированные asset roots;
- снимок функционального дерева и metadata;
- темы опубликованных страниц;
- значения типов и поисковых тегов;
- snapshot `robots.txt` и данные для `sitemap.xml`.
- application template key/version и список требуемых runtime assets.
- visibility selectors каждого опубликованного узла, чтобы активная публикация
  сохраняла ту же проекцию и не расширяла аудиторию.

Координаты, режим collapsed/expanded и revision редактора в публикацию не входят.

Публикатор отвечает за согласованность HTML и относительных asset-ссылок внутри
своего root. HTML Provider не объединяет каталоги разных публикаторов и не
переписывает их внутренние ссылки автоматически.

## 16. Согласованность публикации

Общей транзакции между HTML Store и файловыми providers нет. Публикация является
идемпотентной state machine валидации и активации manifest:

- `operation_id` стабильно идентифицирует повтор команды;
- повтор шага заново проверяет зафиксированные target URI;
- неполный manifest никогда не становится active;
- недоступный target переводит операцию в `failed` либо оставляет её
  доступной для безопасного retry;
- прежняя active publication продолжает обслуживаться;
- переключение active publication выполняется только после успешной проверки
  всех ссылок.

HTML Provider не гарантирует неизменность байтов по одному только URI. Если
публикатор изменит или удалит файл после активации, опубликованное представление
изменится или станет broken. Для стабильного релиза публикатор должен использовать
неизменяемый versioned URI либо backend revision, закреплённую в URI/публичном
контракте файлового provider. HTML Provider не создаёт такую версию вместо него.

## 17. Публичное представление

Раздел `/public` проецирует только активную публикацию:

```text
html@site[site-acme]:///public/manifest.json
html@site[site-acme]:///public/pages/home.html
```

HTML Provider разрешает путь через manifest активной публикации и обращается к
target URI в подключении соответствующего публикатора через `BoundVFS` с actor
запроса.

Для гостевого просмотра ACL должна отдельно разрешать:

- вход в scope сайта;
- чтение логического `/public` URI;
- чтение соответствующего физического URI публикатора.

Настройка публичных ACL-правил выполняется через ACL Provider. Если workflow
публикации автоматизирует этот шаг, он вызывает ACL Provider через `BoundVFS` с
actor публикации и хранит возвращённый URI управляющего ACL-ресурса для
идемпотентного отката. Прямой ACL management service в HTML Provider запрещён.

### 17.1. Sitemap

`public/sitemap.xml` генерируется из активного publication manifest, а не из
текущего чернового дерева. Полный URL строится из `Site.BaseURL` и цепочки slug.

Публичный sitemap является guest-проекцией: в него попадают только Page,
эффективно видимые для `guest` (`guest` или `all` на самой Page и всех её
предках). Аутентифицированная actor-specific проекция sitemap, если она
предоставляется редактору, фильтруется тем же алгоритмом для этого actor и не
используется как общий SEO sitemap.

В sitemap включается страница, которая:

- входит в активную публикацию;
- имеет подходящие visibility entries для выбранной аудитории на всей цепочке
  Page → ancestors;
- не имеет статуса `hidden` или `archived`;
- имеет корректный публичный маршрут;
- разрешена publication metadata для индексирования.

Минимальная запись содержит:

```xml
<url>
  <loc>https://example.com/catalog/product</loc>
  <lastmod>2026-09-24T12:00:00Z</lastmod>
</url>
```

`priority` и `changefreq` не входят в MVP. Изменение draft-дерева не изменяет
sitemap до активации следующей публикации.

### 17.2. Robots.txt

Редактируемый `robots.txt` хранится в HTML Store как конфигурация сайта и
доступен по логическому URI:

```text
html@site[site-acme]:///config/robots.txt
```

При публикации его текущая версия сохраняется в publication manifest. Публичный
ресурс:

```text
html@site[site-acme]:///public/robots.txt
```

возвращает snapshot активной публикации. Черновое изменение `robots.txt` не
меняет публичный файл до следующей публикации.

Документ ограничивается по размеру, хранится как UTF-8 и заменяется целиком.
HTML Provider может генерировать строку:

```text
Sitemap: <BaseURL>/sitemap.xml
```

из `Site.BaseURL`. Robots управляет поведением поисковых роботов, но не является
механизмом контроля доступа и не заменяет ACL.

## 18. Scope resolution

Явный scope разрешается независимо от actor, после чего VFS Core проверяет `x`
на ресурсе scope согласно ADR-005. Знание `site-acme` и наличие metadata не
предоставляют доступ.

До внедрения ADR-005 и настоящего ACL evaluator разработка HTML Provider ведётся
с явным тестовым Authorizer. Cross-user и публичный доступ нельзя считать
защищёнными в production-сборке с allow-all authorizer или owner-фильтром внутри
ScopeResolver.

## 19. ACL lifecycle и изменения URI

ACL привязан к каноническим URI. Create, rename, move и delete логического или
физического ресурса должны согласовываться с ACL lifecycle согласно ADR-003.

Текущий `ResourceLifecycleSink` не реализует durable journal, generation,
tombstone и recovery. Поэтому MVP устанавливает ограничения:

- `page_key` и `block_key` не переименовываются;
- удалённый logical key не переиспользуется автоматически;
- навигационный move меняет parent/position, но не логический URI;
- физический rename делает сохранённую привязку broken до явного обновления;
- обновление binding требует проверки нового target URI через `BoundVFS`;
- HTML Provider не делает вид, что может автоматически отследить внешнее
  перемещение без provider change feed;
- production-защита create/delete остаётся ограниченной до внедрения lifecycle.

## 20. ReadDir, Stat и раскрытие metadata

`Stat` и `ReadDir` сначала проходят через VFS Core и ACL запрошенного URI. HTML
Provider не получает Authorizer и не повторяет ACL-проверку самостоятельно.
После ACL `allow` provider обязательно применяет собственную node visibility
projection к текущему trusted actor.

`ReadDir(/pages)` не возвращает все строки `html_pages`: он возвращает только
эффективно видимые Page. `Stat(/pages/<key>)`, lookup `info.json` и команды
страницы выполняют ту же проверку, поэтому скрытый key нельзя обнаружить прямым
запросом. Отсутствие visibility entry представляется как `not_found`, а
не как отдельная ошибка, раскрывающая существование сущности.

Текущей проверки ACL только на каталог недостаточно для разграничения действий
над каждым ребёнком, но это не отменяет provider visibility-фильтрацию имён.
При последующем обращении к возвращённому дочернему URI VFS Core отдельно
проверяет его ACL. Таким образом, листинг требует одновременно ACL `r` каталога
и visibility entries детей, а чтение ребёнка — его visibility entry и ACL `r`
его собственного канонического URI.

`tree.json`, `editor/model.xml`, поисковые результаты и другие агрегаты строятся
из того же отфильтрованного набора. Они не могут использовать нефильтрованный
Store query как способ обойти visibility.

Actor-dependent документы нельзя складывать в общий публичный cache. Их cache
key/ETag включает site visibility revision и идентификатор аудитории; ответы
помечаются private либо отдаются через cache, разделённый по trusted actor.

Закрытые поля owner, physical URI и внутренние ID не должны попадать в публичные
виртуальные документы без явной необходимости. Логи не содержат source,
connection config, auth headers и control payload с секретами.

## 21. Ошибки

Минимальные доменные ошибки:

```text
not_found
already_exists
invalid_parent
cycle_detected
duplicate_slug
invalid_slug
invalid_page_status
invalid_theme
invalid_target_uri
target_outside_site_scope
target_outside_publisher_root
resource_in_use
invalid_delete_mode
invalid_position_anchor
invalid_editor_layout
invalid_visibility_audience
tree_revision_conflict
visibility_revision_conflict
page_revision_conflict
layout_revision_conflict
publication_conflict
publication_incomplete
broken_binding
template_not_found
invalid_template_manifest
static_asset_not_found
```

ACL-ошибки остаются ошибками VFS/ACL. HTML Provider не преобразует
`permission_denied` в allow и не раскрывает существование target дополнительным
сообщением.

## 22. Этапы реализации MVP

### Этап 1. Каркас и metadata Store

- Зарегистрировать provider key `html`.
- Создать модели Site, PublisherRoot, Page, Theme, EditorLayout и SiteSEO.
- Реализовать собственный SQLite Store.
- Изолировать данные по HTML connection.
- Добавить `site.json` и пустой `tree.json`.
- Добавить функциональные поля Page, типы и поисковые теги.

### Этап 2. Publisher roots и страницы

- Реализовать `register-root`.
- Валидировать URI и совпадение scope.
- Проверять root через `BoundVFS.Stat`.
- Реализовать `create/update/move/delete` страницы.
- Добавить `reject`, `cascade` и `promote_children` для удаления.
- Добавить позиционирование через `beforeId`, `afterId`, `first` и `last`.
- Реализовать построение `tree.json`.

### Этап 2.1. Обязательная node visibility projection

- Добавить `html_node_visibility` и `Site.VisibilityRevision`.
- Требовать непустой `visible_to` при создании каждой доменной сущности.
- Реализовать `set-visibility` с optimistic revision и атомарной заменой набора.
- Поддержать `all`, `guest` и точный trusted subject actor.
- Применять одну проверку visibility в lookup, `Stat`, `ReadDir`, `OpenFile` и
  `Control`; отсутствие записи возвращает `not_found`.
- Фильтровать `tree.json`, `editor/model.xml`, поиск, publication manifest и
  sitemap тем же сервисом, включая правило невидимого parent.
- Добавить безопасную миграцию существующих сущностей для owner/publisher без
  неявной выдачи `all` или `guest`.
- Разделить actor-dependent cache по subject и visibility revision.

### Этап 3. Визуальный редактор и SEO

- Добавить read-only `editor/model.xml` с tree/model revisions.
- Добавить сохраняемый `editor/layout.xml` с независимой layout revision.
- Реализовать безопасный XML parser и allowlist схемы.
- Генерировать parent connections из ParentID/Position.
- Сохранять в layout только координаты, view и visual geometry.
- Реализовать единый доменный сервис и публичные VFS-команды страниц.
- Разрешить Replace `info.json` только для изменяемых функциональных полей с
  ожидаемой page revision либо оставить эквивалентный `update` Control до
  появления общего conditional-write контракта.
- Поддержать внешние изменения дерева без обязательной записи через редактор.
- Добавить Theme Store и `/themes`.
- Добавить `BaseURL` и редактируемый `config/robots.txt`.
- Реализовать генератор sitemap на тестовом publication manifest.

### Этап 3.1. Application template и статический runtime

- Добавить установку immutable versioned template package в connection сайта.
- Реализовать `Control(/templates, "install", ...)`: проверить права actor,
  manifest, целостность package и отсутствие уже существующей key/version.
- Зафиксировать manifest entrypoint, runtime, vendor libraries, icons и fonts.
- Не включать в manifest generator binaries, source helpers, архивы, swap-файлы
  и случайные копии assets из текущего frontend-каталога.
- Добавить site fields application template key/version.
- Спроецировать package один раз в `/templates/<key>/<version>` connection
  сайта.
- Сохранять site-local template manifest URI и digest в publication manifest.
- Реализовать Site HTTP Adapter: `/` читает entrypoint из site-local template
  URI, `/_static/` читает только manifest asset последней установленной версии,
  неизвестный asset возвращает `404`.
- Возвращать MIME и ETag; unversioned entrypoint и static требуют revalidation.

### Этап 4. Прямой доступ к source через physical VFS URI

Отдельная реализация в HTML Provider не требуется. `info.json`/`meta.json`
возвращают `bundle_root_uri`, а клиент читает и записывает `content.md`,
`style.css`, `script.js` напрямую через VFS Core. HTML Provider не создаёт для
них routes, не вызывает `OpenFile` и не дублирует ошибки файлового provider.

### Этап 5. Блоки

- Добавить Block Store и `/blocks`.
- Реализовать source/view binding.
- Добавить template/root связи страницы.
- Запретить удаление явно используемого блока.

### Этап 6. Публикация

- Реализовать state machine и operation ID.
- Проверять опубликованные URI через `BoundVFS`.
- Создавать неизменяемый manifest ссылок и дерева.
- Фиксировать функциональные page metadata, theme и robots snapshot.
- Генерировать `public/sitemap.xml` из активного manifest.
- Активировать только полный manifest.
- Проецировать active publication в `/public`.

### Этап 7. Интеграция с VFS hooks

- Не делать Hook Runtime зависимостью HTML Provider.
- Через Hook SDK зарегистрировать `create-site` и
  `create-page-with-content` после появления ADR-008 в коде.
- Добавить `publish-site` только для внешней orchestration; publication state
  machine оставить в HTML Provider.
- Обеспечить одинаковые результаты доменных команд при прямом и hook-вызове.
- Проверить частичный сбой между созданием physical bundle и Page metadata.
- Не блокировать базовый MVP HTML Provider отсутствием Hook Runtime: все
  доменные операции остаются доступны напрямую через VFS.

### Этап 8. Реальная авторизация и lifecycle

- Завершить необходимые части ADR-005.
- Подключить настоящий ACL evaluator.
- Настроить права scope, HTML metadata URI и physical target URI.
- Интегрировать create/delete с ACL lifecycle.
- Добавить reconciliation broken bindings и публикаций.

## 23. Первая рабочая итерация

Первый сквозной результат должен выполнять сценарий:

```text
1. Bundle уже существует:
   local@alice[site-acme]:///website/pages/home/
   ├── content.md
   ├── style.css
   └── script.js

2. Alice регистрирует root:
   local@alice[site-acme]:///website

3. Alice создаёт Page metadata с bundle root URI и явным
   `visible_to: ["user:17"]`. HTML Provider через `BoundVFS` проверяет
   каталог и каждый из трёх обязательных файлов, а Page и visibility entries
   сохраняет одной локальной транзакцией.

4. HTML Provider повышает tree/model/visibility revisions.

5. tree.json и сформированный editor/model.xml возвращают страницу home.

6. editor/layout.xml принимает визуальную позицию страницы независимо от
   functional model, а попытка записать model.xml возвращает unsupported.

7. Клиент получает `bundle_root_uri` из `info.json` и читает файлы напрямую:
   local@alice[site-acme]:///website/pages/home/content.md
   local@alice[site-acme]:///website/pages/home/style.css
   local@alice[site-acme]:///website/pages/home/script.js

8. VFS Core проверяет исходного actor и ACL каждого physical URI; HTML Provider
   в файловой операции не участвует.
```

В эту итерацию не входят blocks, themes, sitemap, renderer, публикация, внешний
HTTP endpoint, автоматическое создание scope и полноценный ACL lifecycle.

## 24. Тесты готовности

### Домен и Store

1. Page создаётся только внутри существующего сайта.
2. Parent из другого сайта запрещён.
3. Прямой и косвенный цикл запрещены.
4. Slug уникален среди siblings.
5. Позиции нормализуются после move/delete.
6. Режим `reject` не удаляет страницу с детьми.
7. Режим `cascade` удаляет всё поддерево одной локальной транзакцией и не
   удаляет физические source-файлы.
8. Режим `promote_children` переносит детей к parent удаляемой страницы и
   нормализует порядок.
9. Используемый template/root block не удаляется.
10. Неизвестный status или theme отклоняется.
11. Types и SearchTags сохраняются без дубликатов.

### Node visibility

1. Создание сущности без непустого `visible_to` отклоняется.
2. Создание сущности и visibility entries фиксируется или откатывается вместе.
3. `all` показывает узел и authenticated actor, и guest; `guest` — только guest.
4. Точная запись `user:17` не показывает узел другому actor.
5. Отсутствующая запись делает `Stat`, direct lookup, file access и `Control`
   неотличимыми от отсутствующей сущности.
6. `ReadDir` не раскрывает key невидимого узла даже при ACL `r` каталога.
7. ACL `deny` запрещает действие при наличии visibility entry.
8. ACL `allow` не показывает узел без visibility entry.
9. Невидимый parent исключает всё поддерево из `tree.json` и `model.xml`.
10. Guest sitemap содержит только опубликованные Page, видимые через `guest`
    или `all` на всей цепочке предков.
11. Изменение visibility повышает `VisibilityRevision` и инвалидирует только
    соответствующие actor-dependent projections.
12. Миграция legacy-данных не создаёт `all` или `guest` неявно.

### Визуальный редактор

1. `model.xml` формируется из актуальных доменных таблиц.
2. `model.xml` не хранится как независимый источник истины и не принимается на запись.
3. `layout.xml` сохраняет только visual state.
4. Изменения через API отражаются в следующем `model.xml` без записи редактором.
5. DTD, external entities и XInclude запрещены в обоих документах.
6. Неизвестный Page ID в layout отклоняется или удаляется при нормализации.
7. Повторяющийся layout node отклоняется.
8. Устаревшая tree revision отклоняет move/order command.
9. Устаревшая page revision отклоняет functional update.
10. Устаревшая layout revision отклоняет сохранение layout.
11. Изменение parent выполняется только централизованной командой.
12. Изменение layout не меняет ParentID, Position и functional metadata.
13. Удаление выполняется только явной командой.
14. Неуспешное сохранение layout не откатывает функциональную команду.
15. Delete `cascade` не требует отдельных клиентских команд для потомков.
16. Delete `promote_children` сохраняет дерево без циклов и нормализует siblings.
17. Move через `beforeId` или `afterId` вычисляет Position на стороне provider-а.
18. Revision conflict не удаляет локальный draft frontend-а.
19. Parent connections в `model.xml` используют `from-id`/`to-id`, а не title,
    slug или key.
20. Layout nodes используют `page-id`; переименование страницы не разрывает
    сохранённые координаты и геометрию connections.

### Прямые операции и hooks

1. Каждая операция HTML Provider доступна напрямую через VFS без Hook Runtime.
2. Hook вызывает HTML Provider только через actor-bound VFS.
3. Прямой вызов и тот же вызов из hook применяют одинаковые revisions и
   доменные ограничения.
4. Hook Runtime не получает HTML Store или PageService.
5. Частичный сбой hook возвращает завершённые и неуспешные шаги.
6. Повтор с тем же idempotency key не создаёт второй physical bundle или Page.
7. Hook из нескольких VFS-вызовов не объявляется атомарным.
8. Пакетная атомарность, если она появится, завершается одной командой и
   транзакцией HTML Provider.

### Application template и публичная статика

1. Запрос `/` через Site HTTP Adapter возвращает entrypoint версии template из
   active publication manifest.
2. `/_static/js/app.js` возвращает asset из последней установленной версии
   site-local `/templates/<key>/<version>` с JavaScript MIME.
3. Vendor library возвращается только если явно перечислена в manifest.
4. Отсутствующий static asset возвращает `404`, а не `index.html`.
5. Попытка запросить `..`, абсолютный filesystem path или encoded traversal
   отклоняется.
6. Файл, существующий в package directory, но отсутствующий в manifest, не
   читается.
7. Generator binary, `.go`, `.zip`, swap-файл и случайная копия SVG из текущего
   frontend-каталога недоступны.
8. Unversioned asset и entrypoint получают ETag и требуют revalidation без
   immutable cache policy после установки новой версии template.
9. Site assets и theme files продолжают читаться из connections публикаторов;
   application template читается из `/templates` connection сайта.
10. Каталоги библиотек blocks/plugins не публикуются автоматически.

### URI и границы providers

1. Неканонический или повреждённый URI отклоняется.
2. Target другого scope отклоняется доменной политикой сайта.
3. Target вне зарегистрированного root отклоняется.
4. Path prefix collision не проходит проверку принадлежности.
5. HTML Provider использует только `BoundVFS` для target.
6. Actor внутренней операции совпадает с actor исходного запроса.
7. ACL deny на target не обходится outer ACL allow.
8. Backend deny после ACL allow возвращается клиенту.

### Публикация

1. Успешно проверенный manifest становится active.
2. Недоступный URI не переключает active publication.
3. Неполный manifest не становится active.
4. Повтор operation ID идемпотентен.
5. Manifest сохраняет точные URI всех публикаторов.
6. Изменение файла по опубликованному URI отражается в выдаче и явно считается
   ответственностью публикатора.
7. Sitemap строится только из активного manifest.
8. Hidden и archived страницы не попадают в sitemap.
9. Публичный robots соответствует snapshot активной публикации.
10. Координаты и view редактора не попадают в publication manifest.

## 25. Отклонённые варианты

### 25.1. Хранить HTML в таблицах HTML Provider

Отклонено как обязательная модель. Это привязывает HTML-домен к одному backend и
дублирует файловые возможности VFS. Допустим только отдельный будущий файловый
provider, если он сам владеет таким способом хранения.

### 25.2. Читать backend другого provider напрямую

Отклонено как нарушение доменной границы и обход VFS/ACL.

### 25.3. Использовать service principal для чтения target

Отклонено. HTML Provider должен сохранять actor исходного запроса. Иначе
логическая проекция превращается в механизм повышения привилегий.

### 25.4. Использовать внутренний ID как ACL identity

Отклонено. Системной идентичностью остаётся канонический URI, а согласованность
при его изменении обеспечивает ACL lifecycle.

### 25.5. Строить дерево сайта из каталогов публикаторов

Отклонено. Файловая организация и навигационная структура являются разными
моделями. Один и тот же backend не должен навязывать структуру сайта.

### 25.6. Централизованно копировать файлы в connection публикаций

Отклонено. Опубликованные файлы остаются в подключениях публикаторов. HTML
Provider фиксирует manifest канонических URI и не становится владельцем второго
набора физических файлов.

### 25.7. Поместить hooks внутрь HTML Provider

Отклонено. Hooks являются общей возможностью VFS application-слоя и могут
собирать сценарии из нескольких providers. HTML Provider предоставляет
доменные ресурсы и команды, но не владеет registry, runtime или HTTP-интерфейсом
hooks.

### 25.8. Сохранять весь сайт одной универсальной командой

Отклонено для MVP. Дерево, layout, physical files, ACL и публикации принадлежат
разным моделям, имеют разные revisions и разные границы атомарности. Одна
команда `save-everything` скрыла бы частичные сбои и создала ложное ожидание
распределённой транзакции.

### 25.9. Создавать серверную editing session на время работы редактора

Отклонено для MVP. Длительная session потребовала бы хранить server-side draft,
управлять сроком жизни, блокировками и восстановлением. Редактор хранит
несохранённые действия локально, а сервер принимает законченные доменные
операции с revisions.

### 25.10. Строить видимость HTML-узлов только из ACL

Отклонено. ACL отвечает на вопрос, разрешено ли действие над известным
каноническим URI, но не является источником пользовательской HTML-проекции.
ACL `allow` не должен автоматически добавлять Page в навигацию, `tree.json`,
editor model или sitemap. Источником существования узла для аудитории является
`html_node_visibility`; ACL остаётся обязательным независимым ограничителем
действий и не может быть расширен этой таблицей.

## 26. Последствия

Положительные последствия:

- HTML Provider не зависит от конкретного физического backend;
- метаданные и дерево имеют одного доменного владельца;
- файлы разных публикаторов могут находиться в разных providers;
- каждая междоменная операция повторно проходит VFS и ACL;
- публикация может объединять файлы из нескольких подключений без копирования;
- замена файлового provider не требует изменения логической модели сайта;
- прямой VFS-контракт работает без конкретного frontend и без Hook Runtime;
- общие пользовательские сценарии можно добавлять hooks без изменения границ
  HTML Provider;
- связи editor model и layout не ломаются при изменении title, slug или key;
- статический runtime сайта имеет versioned allowlist и не раскрывает весь
  каталог приложения.
- явная visibility projection не позволяет ACL `allow` автоматически раскрыть
  не включённый в аудиторию доменный узел;
- `tree.json`, editor model, publication и sitemap используют один источник
  истины о видимости.

Цена решения:

- клиенту нужны отдельные права на HTML metadata URI и physical URI source;
- клиент обязан корректно разрешать фиксированные имена файлов относительно
  канонического `bundle_root_uri`;
- view закрытого source требует отдельного файла, подготовленного публикатором;
- публикация нуждается в state machine и reconciliation;
- стабильность байтов публикации зависит от неизменности URI публикатора;
- внешнее перемещение физического файла может сломать binding;
- до реализации ACL lifecycle нельзя обещать полную устойчивость rename/delete;
- bootstrap сайта требует orchestration нескольких providers;
- hook из нескольких операций требует идемпотентности и явной обработки
  частичных результатов;
- локальный draft редактора остаётся ответственностью frontend-а;
- установка template package и Site HTTP Adapter требуют отдельного
  версионирования и тестирования;
- экспорт и импорт сайта обязаны переписывать provider-local page IDs в layout.
- каждый actor-dependent aggregate требует фильтрации и раздельного cache key;
- изменение visibility получает собственную revision и увеличивает число
  provider-local записей;
- отсутствие visibility entry возвращается как `not_found`, поэтому диагностика
  для администратора должна выполняться через отдельный разрешённый management view.

## 27. Критерий завершения MVP

MVP считается работоспособным, когда выполняется сквозной сценарий:

```text
создать scope сайта
    -> подключить html@site
    -> зарегистрировать файловый root публикатора
    -> загрузить физическую страницу
    -> зарегистрировать Page metadata и явный visible_to
    -> построить отфильтрованное для actor дерево
    -> получить model.xml из актуальной доменной модели
    -> применить functional изменения напрямую через VFS
    -> отдельно сохранить visual layout.xml
    -> получить bundle_root_uri из Page metadata
    -> прочитать source напрямую через physical VFS URI
    -> получить корневой entrypoint по template URI активной публикации
    -> получить app.js, CSS и разрешённые libraries через browser /_static
    -> создать manifest URI файлов публикаторов
    -> активировать публикацию
    -> получить guest-filtered sitemap.xml и robots.txt активной публикации
    -> получить опубликованные файлы из подключений публикаторов
```

Все межпровайдерные обращения в этом сценарии проходят через `BoundVFS` с
исходным actor. Ни одна metadata-запись сама по себе не предоставляет право
доступа. Visibility entry включает узел только в provider projection, а
разрешённые действия по-прежнему определяет ACL.

После реализации ADR-008 тот же сценарий может дополнительно использовать
hooks `create-site`, `create-page-with-content` и `publish-site`. Это улучшает
пользовательский интерфейс, но не является условием работоспособности основного
контракта HTML Provider.
