# План реализации Blocks для ADR-007

> Связанное решение: [ADR-007: HTML Provider](adr/VFS_V2_HTML_PROVIDER_DECISION_RU.md).  
> Статус: реализовано; Block Store, VFS-проекция и actor-scoped merge каталога покрыты тестами.  
> Граница: ACL как подсистема, её правила, management API и lifecycle в этот
> инкремент не входят.

## 1. Результат инкремента

HTML Provider предоставляет site-local библиотеку Blocks. Block — отдельный
логический ресурс с неизменяемым `block_key` и каноническим URI
`html@site[scope]:///blocks/<block-key>`. Он хранит только metadata и ссылку на
физический bundle; файловый provider продолжает владеть файлами bundle.

После завершения доступны:

```text
html@site[site-acme]:///
└── blocks/
    ├── tree.json
    └── <block-key>/
        └── meta.json
```

Поддерживаются типы:

- `ui-component`: полный bundle `content.md`, `style.css`, `script.js`;
- `content`: только `content.md`; наличие `style.css` или `script.js` является
  ошибкой контракта.

`blocks/tree.json` является одним versioned документом организации библиотеки:
папки, вложенность, порядок и ссылки на `block_key`. Он не является вторым
адресом блока, не изменяет `bundle_root_uri`, visibility или права доступа.
Клиент сначала читает дерево, затем лениво читает `meta.json` нужного блока и
обращается к указанному физическому URI через VFS.

Page не получает обязательной ссылки на Block. В этом инкременте не появляются
composition-модель, серверный renderer, публикация блоков или анализ
HTML/Markdown.

## 2. Явная граница без ACL

Не реализовывать в рамках Blocks:

- Authorizer, ACL Store, grant/revoke, ACL Provider, ACL lifecycle и миграцию
  правил при изменении URI;
- новые ACL actions или специальные правила доступа для Blocks;
- попытку заменить ACL локальным `visible_to`.

Существующая HTML visibility остаётся provider-owned existence projection:
Block без подходящей записи не существует для actor при list, lookup и чтении
`tree.json`. Это не авторизация и не открывает его physical bundle.

`BoundVFS` сохраняется обязательной границей: создание и изменение привязки
bundle выполняются только через actor-bound VFS. Пока ACL policy отсутствует,
это сохраняет правильный путь вызова и позволит VFS Core применять ACL позднее
без изменения BlockService. Нельзя заменять этот путь прямым доступом к чужому
filesystem/store или проверкой прав внутри HTML Provider.

## 3. Что добавить

### 3.1. Данные и миграция

Добавить migration schema v5 в `internal/vfs/v2/providers/html/sqlite_store.go`:

```text
html_blocks
  id, site_id, block_key, name, type, publisher_subject_key,
  bundle_root_uri, revision, created_at, updated_at

html_block_trees
  site_id, revision, document_json, updated_at
```

Ограничения:

- `UNIQUE(site_id, block_key)`;
- допустимые `type`: `ui-component`, `content`;
- `revision >= 1`;
- один tree document на site;
- FK на site с `ON DELETE CASCADE`;
- trigger очистки `html_node_visibility` для удалённого Block;
- индекс для list по `(site_id, block_key)`.

JSON дерева хранится нормализованным в provider Store. При создании site можно
создавать пустой документ `{ "revision": 1, "folders": [] }` либо считать его
виртуальным до первой записи; выбранный вариант должен быть одинаков для read,
replace и тестов. Предпочтителен явный пустой документ: он даёт стабильную
revision с первого чтения.

В `model.go` добавить `Block`, `BlockTree` и входные типы. В `store.go` добавить
узкие методы `CreateBlock`, `BlockByKey`, `ListBlocks`, `UpdateBlock`,
`DeleteBlock`, `ReadBlockTree`, `ReplaceBlockTree`. Методы не принимают actor и
не выполняют авторизацию.

### 3.2. Доменный сервис

Добавить `block_service.go` и тесты. Его обязанности:

1. Нормализовать и валидировать immutable `block_key`, name и type.
2. Проверять optimistic `revision` metadata при update/delete.
3. Создавать Block и initial `visible_to` в одной SQLite-транзакции; пустой
   список запрещён.
4. Удалять metadata и visibility, но никогда physical bundle.
5. Валидировать новое дерево до записи: JSON shape, revision, уникальность
   folder key, отсутствие циклов, уникальность каждого `block_key`, а также
   существование и принадлежность каждого referenced block данному site.
6. Выполнять CAS для `blocks/tree.json`; при устаревшей revision возвращать
   `conflict` без частичного изменения.

Для дерева нужны отдельные DTO/codec, а не `map[string]any`, чтобы формат был
детерминированным, проверяемым и не принимал неизвестную семантику.

### 3.3. Проверка physical bundle

Расширить `binding_service.go` методом уровня `ValidateBlockBundle` или общим
`ValidateBundle` с явным вариантом контракта. Он получает `BoundVFS`, site,
scope и URI, и проверяет:

- URI каноничен и лежит под active publisher root того же site/scope;
- root принадлежит publisher, который сохраняется в Block metadata;
- target — каталог;
- для `ui-component` существуют ровно обязательные contract files
  `content.md`, `style.css`, `script.js`;
- для `content` существует `content.md`, а `style.css` и `script.js` отсутствуют.

Проверка не кеширует успешный `Stat` как право последующего чтения, не читает
файлы напрямую и не выполняет `script.js`. Файлы сверх трёх контрактных не
делают Block невалидным и не публикуются HTML Provider.

### 3.4. VFS-контракт

В `command_dto.go` добавить:

```text
Control(/blocks, "create", CreateBlockInput)
Control(/blocks/<key>, "update", UpdateBlockInput)
Control(/blocks/<key>, "delete", DeleteBlockInput)
Control(/blocks/<key>, "set-visibility", SetVisibilityInput)
Read    (/blocks/<key>/meta.json) -> BlockDocument
Read    (/blocks/tree.json)       -> BlockTreeDocument
Replace (/blocks/tree.json)       -> BlockTreeDocument
```

`CreateBlockInput` содержит key, name, type, bundle root и `visible_to`.
`UpdateBlockInput` не позволяет изменить key; при смене type или bundle снова
запускается `ValidateBlockBundle`. `DeleteBlockInput` требует expected block
revision. `BlockDocument` возвращает metadata, canonical `bundle_root_uri`,
revision, timestamps и `visible_to`.

В `provider.go` смонтировать `blocks` через тот же `sdk.CollectionResources`,
что и pages. Для lookup/list использовать только `visibleBlocks`; прямой lookup
невидимого ключа возвращает `not_found`. При чтении `tree.json` сервис удаляет
из результата невидимые blocks и пустые folders, сохраняя порядок остальных.
Replace дерева проверяет visibility только для того, что actor может адресовать:
ссылка на неизвестный или невидимый ему block должна завершаться `not_found`, а
не раскрывать его существование.

Дополнить `VisibilityService` методами `VisibleBlocks` и `BlockVisible`; для
Blocks нет родительской visibility-цепочки, как у Page.

### 3.5. Ошибки, документация и demo

Добавить ошибки `ErrBlockNotFound`, `ErrBlockRevisionConflict`,
`ErrBlockTreeRevisionConflict`, `ErrInvalidBlockType`, `ErrInvalidBlockTree` и
маппинг в существующие VFS kinds (`not_found`, `conflict`,
`invalid_argument`, `failed_precondition`).

Обновить demo `cmd/vfsv2html`: зарегистрировать content publisher root, создать
минимум один `ui-component` и один `content` block через публичный VFS-контракт,
затем показать чтение `/blocks/tree.json`. Demo не должен обращаться к SQLite
Store напрямую и не должен встраивать Blocks в Page bundle.

## 4. Что не добавлять и что удалить

### Не добавлять

- таблицу `page_blocks`, `BlockID` в Page и Page→Block FK;
- глобальный `resource_id`, registry blocks или ACL-идентификатор помимо
  canonical URI;
- логическую проекцию `content.md`, `style.css`, `script.js` под
  `html@...:///blocks/<key>/`;
- importer всей директории `data/HTML/block`, auto-discovery bundle-ов или
  публикацию любого найденного файла;
- копирование block bytes в HTML Store, template package или `/public`;
- изменение frontend runtime для обязательной загрузки всех blocks;
- direct SQL/файловый доступ к чужому provider вместо `BoundVFS`.

### Удалить или не переносить

В production-коде сейчас нет реализованного Block slice, поэтому удалять
рабочую функциональность не требуется. Удалению/исключению подлежат только
устаревшие или будущие черновые подходы:

- любые DTO, UI-код или планы, предполагающие обязательную Page→Block
  composition, сохраняемый список blocks в Page или удаление Block по ссылкам
  Page;
- предположение, что перемещение в папке меняет URI/ключ Block;
- идеи `ContentService`, которому принадлежат одновременно blocks и assets,
  если он начинает смешивать доменное metadata и файловые байты: назвать и
  реализовать узкий `BlockService`;
- старый `source_uri` нельзя удалять из миграционной истории прямо сейчас:
  schema v2 ещё нужна для upgrades. После официального прекращения поддержки
  legacy DB его можно удалить отдельной совместимой migration/релизной задачей,
  но не в Block slice;
- каталоги `data/HTML/block/**` остаются demo/source assets и не становятся
  Store-записями автоматически. Ненужные legacy assets можно удалять только
  отдельной задачей после проверки, что их не использует demo или frontend.

## 5. Последовательность PR

1. **Store и модели.** Migration v5, модели, Store CRUD/CAS, cleanup trigger,
   unit-тесты транзакций и migration с v4 базы.
2. **Доменный BlockService.** Validation metadata/tree, optimistic revisions,
   delete semantics, unit-тесты без VFS.
3. **Physical binding.** Обобщить bundle validation, добавить type-specific
   проверки через fake `BoundVFS`; проверить wrong scope/root, missing files и
   запрет JS/CSS у `content`.
4. **VFS projection.** `/blocks`, `meta.json`, `tree.json`, Control/Replace,
   provider tests list/lookup/not-found/error mapping.
5. **Visibility.** Actor-filtered list, direct lookup, filtered tree and empty
   folder pruning; это существующая HTML projection, не ACL.
6. **Demo и документация.** Создание Blocks только через BoundVFS/public VFS,
   README demo, ADR-007 и `docs/adr/README.md` с точным статусом реализации.

Каждый PR должен быть independently runnable и не требовать реализации ACL.
После PR 4 Block API уже пригоден для интеграции; PR 5 обязателен до заявления
о завершённости ADR Block slice.

## 6. Приёмочные проверки

1. `ui-component` создаётся только с тремя обязательными файлами; `content` с
   CSS/JS отклоняется.
2. Bundle другого site/scope или вне registered root не привязывается.
3. Создание без `visible_to` не оставляет metadata без visibility.
4. `block_key` не меняется update-командой; изменение type/bundle повторно
   проверяет физический target.
5. Invalid/cyclic tree, duplicate key и key не этого site не сохраняются.
6. Stale tree/block revision возвращает conflict и не изменяет актуальные
   данные.
7. Перемещение в tree не меняет `block_key`, `bundle_root_uri` и visibility.
8. Невидимый block отсутствует в `ReadDir`, `tree.json` и при direct lookup;
   видимость не предоставляет чтение physical URI.
9. Delete удаляет metadata/visibility и не удаляет physical каталог.
10. Вызовы создания и проверки bundle используют BoundVFS; тест не допускает
    обращение к другому provider Store или filesystem напрямую.

## 7. Критерий завершения

Инкремент завершён, когда все API из раздела 3.4 работают с версионированным
Store, type-specific bundle validation и actor-filtered visibility; тесты из
раздела 6 проходят; demo использует публичный VFS-контракт. На этом этапе
реестр ADR может говорить «Block Store и VFS-проекция реализованы, ACL и
publication не входят в данный slice». Он не должен объявлять ADR-007 целиком
реализованным.
