# Контракт HTML-редактора и страниц

> Статус: целевой контракт для реализации MVP.  
> Дата: 24 сентября 2026 года.  
> Уточнено 26 сентября 2026 года: добавлены режимы удаления поддерева, позиционные anchors, сохранение локального draft при конфликте и необязательный путь через VFS hooks.  
> Уточнено 29 сентября 2026 года: связи model/layout переведены на page ID; описаны application template, корневой entrypoint и manifest-разрешённая статика.
> Уточнено 3 октября 2026 года: Page и Block используют bundle из `content.md`, `style.css`, `script.js`; HTML-вставки хранятся внутри Markdown, отдельного `content.html` нет.
> Уточнено 4 октября 2026 года: каждый доменный узел имеет явный `visibleTo`; без подходящей записи он не существует в actor-проекции, а ACL независимо ограничивает действия.
> Уточнено 6 октября 2026 года: HTML Provider возвращает `bundleRootUri` только как ссылку в `info.json`; файлы bundle не проецируются под `html@...`, редактор обращается к их physical VFS URI напрямую.
> Архитектурное решение: [ADR-007: HTML Provider](adr/VFS_V2_HTML_PROVIDER_DECISION_RU.md).  
> Составные сценарии: [ADR-008: серверные хуки VFSv2](adr/VFS_V2_SERVER_HOOKS_DECISION_RU.md).  
> Транспорт: [HTTP API VFSv2](VFS_V2_HTTP_ENDPOINT_MAP_RU.md).

## 1. Назначение

Документ описывает, какие ресурсы и команды вызывает визуальный редактор сайта.
Он рассчитан на разработчика frontend или backend, которому не требуется знать
внутреннее устройство HTML Store.

Редактор работает с HTML Provider и файловыми providers только через VFSv2.
Доменный путь:

```text
Editor
  -> HTTP VFS adapter
  -> VFS Core
  -> ACL
  -> HTML Provider
  -> его доменные сервисы
```

Для составного действия редактор может вызвать Hook HTTP Adapter. Независимый
Hook Runtime затем выполняет те же actor-bound VFS-операции; прямого доступа к
доменным сервисам или Store HTML Provider он не получает.

Transport и редактор не обращаются к таблицам HTML Provider напрямую.

## 2. Основная модель

Редактор использует три группы ресурсов:

```text
model.xml   = read-only дерево и базовые данные всех страниц
layout.xml  = изменяемое визуальное расположение блоков
page API    = чтение и изменение полной информации конкретной страницы
```

| Ресурс | Можно читать | Можно записывать | Назначение |
| --- | --- | --- | --- |
| `/editor/model.xml` | Да | Нет | Дерево, ID, key, title, description |
| `/editor/layout.xml` | Да | Да | X/Y, размеры, вид и геометрия линий |
| `/pages/<key>/info.json` | Да | Условно | Полные функциональные данные страницы; Replace только изменяемых полей с revision |
| `<bundleRootUri>/content.md` | Да | Да при наличии прав | Markdown-контент с возможными inline HTML-вставками в файловом provider |
| `<bundleRootUri>/style.css` | Да | Да при наличии прав | CSS страницы в файловом provider |
| `<bundleRootUri>/script.js` | Да | Да при наличии прав | JavaScript страницы в файловом provider |
| Page commands | — | Да | Создание, изменение, move, delete и visibility |

`model.xml` и `info.json` формируются из одного доменного источника истины.
Редактор никогда не сохраняет изменённый `model.xml` обратно.
Все доменные операции доступны напрямую через VFS. Для действия, состоящего из
нескольких VFS-операций, frontend может вызвать зарегистрированный server hook.

## 3. Адрес сайта

Примеры используют HTML connection:

```text
html@site[site-acme]:///
```

В HTTP-запросе канонический URI полностью URL-encoded:

```text
/api/v2/vfs/read?uri={url-encoded-canonical-uri}
```

Для краткости ниже показаны VFS URI и операции без повторения URL-encoding.

## 4. Открытие редактора

### 4.1. Получить модель

```text
GET /api/v2/vfs/read
URI html@site[site-acme]:///editor/model.xml
```

Ответ:

```xml
<site-model
  schema-version="1"
  tree-revision="45"
  model-revision="91"
>
  <nodes>
    <page
      id="142"
      key="home"
      title="Главная"
      description="Основная страница сайта"
    />
    <page
      id="157"
      key="catalog"
      title="Каталог"
      description="Каталог продукции"
    />
  </nodes>

  <connections>
    <connection
      kind="parent"
      from-id="142"
      to-id="157"
      order="0"
    />
  </connections>
</site-model>
```

Поля:

| Поле | Значение |
| --- | --- |
| `id` | Внутренний стабильный ID страницы в HTML Provider |
| `key` | Неизменяемый ключ страницы внутри сайта |
| `title` | Название для блока редактора |
| `description` | Описание для блока или подсказки |
| `from-id/to-id` | Provider-local IDs parent и child |
| `order` | Порядок child среди детей parent |
| `tree-revision` | Версия структуры дерева |
| `model-revision` | Версия всего содержимого этого model.xml |

ID не является ACL-идентичностью. ACL работает с полным каноническим URI.
Связи не используют title, slug, name или key. Поэтому переименование страницы
не требует перестраивать connections. ID действителен только внутри текущего
сайта и переписывается при импорте или клонировании сайта.

Запись `model.xml` не поддерживается:

```text
PUT html@site[site-acme]:///editor/model.xml
-> unsupported
```

### 4.2. Получить layout

```text
GET /api/v2/vfs/read
URI html@site[site-acme]:///editor/layout.xml
```

Ответ:

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

Layout содержит только визуальные данные. Изменение connection в layout не
перемещает страницу в дереве.

### 4.2.1. Исполнимые ограничения XML schema v1

Оба документа сериализуются детерминированно без XML declaration. `model.xml`
группирует Page по parent, внутри группы сортирует по domain position и затем
по provider-local ID; parent connections сортируются по parent ID, order и
child ID. XML-значения всегда экранируются стандартным XML-кодеком.

Для `layout.xml` действуют следующие начальные пределы:

| Ограничение | Значение |
| --- | --- |
| Максимальный размер документа | 256 KiB |
| Максимальное количество nodes | 10 000 |
| Максимальное количество connections | 20 000 |
| Максимальная длина значения атрибута | 4 KiB |
| Диапазон координат и bend points | от -10 000 000 до 10 000 000 |
| Максимальная width/height | 1 000 000; значение должно быть положительным |
| Допустимый `view` | `expanded`, `collapsed` |

Разрешены только корневой `site-layout`, контейнеры `nodes` и `connections`,
элементы `node` и `connection`, а также показанные выше атрибуты schema v1.
XML namespaces, comments, processing instructions, `DOCTYPE`, DTD, external
entities, XInclude, текстовое содержимое и неизвестные элементы или атрибуты
отклоняются. `bend-x` и `bend-y` передаются только вместе. Повторяющиеся
`page-id` и пары `from-id`/`to-id` отклоняются.

Проверка существования Page ID, принадлежности тому же site и эффективной
видимости actor выполняется Editor/Layout service после синтаксического разбора,
а не XML-кодеком.

Чтение `layout.xml` возвращает только visual state эффективно видимых actor
страниц. Replace заменяет только эту видимую часть: состояние существующих
невидимых страниц сохраняется внутри HTML Provider, а ссылки на уже удалённые
Page очищаются при нормализации. Переданный клиентом ID невидимой страницы
обрабатывается так же, как несуществующий, без раскрытия её наличия.

### 4.3. Объединить документы

Редактор связывает документы по provider-local page ID:

```text
model page id="142"
        +
layout node page-id="142"
        =
визуальный блок страницы home
```

Если новая страница отсутствует в layout, редактор назначает ей начальные
координаты. Layout-записи удалённых страниц игнорируются.

## 5. Получить полные данные страницы

При выборе блока редактор читает:

```text
GET /api/v2/vfs/read
URI html@site[site-acme]:///pages/home/info.json
```

Ответ:

```json
{
  "id": 142,
  "key": "home",
  "revision": 18,
  "parentId": null,
  "position": 0,
  "slug": "home",
  "title": "Главная",
  "note": "Основная страница",
  "description": "Подробное описание",
  "status": "ready",
  "types": ["landing"],
  "searchTags": ["главная", "компания"],
  "theme": "main",
  "bundleRootUri": "local@alice[site-acme]:///pages/home"
}
```

`revision` нужно запомнить. При изменении страницы редактор возвращает её как
`expectedPageRevision`.

## 6. Что такое revision

Revision — обычное целое число, которое увеличивается после изменения. Оно
защищает от незаметной перезаписи чужой работы.

Пример:

```text
Редактор A прочитал page revision 5.
Редактор B прочитал page revision 5.
Редактор B сохранил страницу -> revision стала 6.
Редактор A пытается сохранить expectedPageRevision=5.
Сервер видит current=6 и возвращает conflict.
```

`expectedPageRevision` означает: «примени изменение, только если страница всё
ещё той версии, которую я редактировал». Редактор не придумывает это значение, а
берёт его из `info.json`.

Используются четыре независимые revision:

| Revision | Когда меняется | Откуда клиент её получает |
| --- | --- | --- |
| `treeRevision` | Create, delete, move, изменение order | `model.xml` |
| `modelRevision` | Изменилось что-либо, отображаемое в `model.xml` | `model.xml` |
| `pageRevision` | Изменились функциональные данные одной страницы | `info.json` |
| `layoutRevision` | Изменился визуальный layout | `layout.xml` |

Независимые revision позволяют одновременно менять описание страницы и
расположение другого блока без ложного конфликта.

## 7. Общий формат Control

Доменная команда вызывается через VFS:

```http
POST /api/v2/vfs/control?uri={encoded-uri}&command={command}
Content-Type: application/json

{payload}
```

HTTP adapter передаёт command и тело HTML Provider как непрозрачные байты.
HTML Provider валидирует JSON и выполняет PageService.

## 8. Создать страницу

```text
URI     html@site[site-acme]:///pages
Command create
```

Payload:

```json
{
  "key": "contacts",
  "parentId": 142,
  "last": true,
  "slug": "contacts",
  "title": "Контакты",
  "note": "",
  "description": "Контактная информация",
  "status": "draft",
  "types": ["content"],
  "searchTags": ["контакты"],
  "theme": "main",
  "bundleRootUri": "local@alice[site-acme]:///pages/contacts",
  "visibleTo": ["user:17"],
  "expectedTreeRevision": 45
}
```

Ответ:

```json
{
  "id": 166,
  "key": "contacts",
  "pageRevision": 1,
  "treeRevision": 46,
  "modelRevision": 92,
  "visibilityRevision": 8
}
```

Сервер проверяет:

- уникальность key;
- parent и отсутствие цикла;
- позицию;
- уникальность slug среди siblings;
- status и theme;
- bundle root URI и зарегистрированный root публикатора;
- непустой и допустимый набор `visibleTo`;
- доступ actor к каталогу и трём обязательным файлам через `BoundVFS.Stat`.

## 9. Изменить основные поля

```text
URI     html@site[site-acme]:///pages/contacts
Command update
```

```json
{
  "expectedPageRevision": 1,
  "title": "Связаться с нами",
  "note": "Страница контактов",
  "description": "Телефоны, адрес и форма связи",
  "slug": "contact-us",
  "status": "ready"
}
```

Передаются только изменяемые поля. Не переданные поля сохраняют прежнее
значение. `id`, `key`, owner и publisher этой командой не меняются.

Ответ:

```json
{
  "pageRevision": 2,
  "modelRevision": 93
}
```

## 10. Переместить страницу

Перетаскивание структурной connection вызывает доменную команду, а не запись
`model.xml` или `layout.xml`:

```text
URI     html@site[site-acme]:///pages/contacts
Command move
```

```json
{
  "parentId": 210,
  "afterId": 205,
  "expectedTreeRevision": 46
}
```

Ответ:

```json
{
  "treeRevision": 47,
  "modelRevision": 94
}
```

Вместо `afterId` допустимы `beforeId`, `first` или `last`. Сервер проверяет parent,
отсутствие цикла и sibling slug, затем сам вычисляет и нормализует числовые
позиции. Одновременная передача нескольких position anchors отклоняется.

## 11. Удалить страницу

Удаление всегда является явной командой:

```text
URI     html@site[site-acme]:///pages/contacts
Command delete
```

```json
{
  "expectedPageRevision": 2,
  "expectedTreeRevision": 47,
  "mode": "cascade"
}
```

Отсутствие страницы в локальном XML ничего не удаляет. Поддерживаются режимы:

| Mode | Результат |
| --- | --- |
| `reject` | Страница с детьми возвращает `resource_in_use` |
| `cascade` | Страница и всё поддерево удаляются одной транзакцией HTML Provider |
| `promote_children` | Дети переносятся к parent удаляемой страницы |

Ни один режим не удаляет физические HTML-файлы публикаторов. Для этого нужен
отдельный явно выбранный составной сценарий.

## 12. Изменить типы, теги и тему

### Типы

```text
Command set-types
```

```json
{
  "expectedPageRevision": 2,
  "types": ["content", "contacts"]
}
```

### Поисковые теги

```text
Command set-search-tags
```

```json
{
  "expectedPageRevision": 3,
  "tags": ["контакты", "телефон", "адрес"]
}
```

### Тема

```text
Command set-theme
```

```json
{
  "expectedPageRevision": 4,
  "theme": "corporate"
}
```

Каждая успешная команда возвращает новую `pageRevision`. Массивы типов и тегов
нормализуются и сохраняются без дубликатов. Theme должна существовать в том же
сайте.

## 13. Ссылка на физический bundle

`bundleRootUri` передаётся при `create` страницы и возвращается в её
`info.json`. В MVP ссылка после создания неизменяема; отдельной команды
`set-bundle` нет. При создании HTML Provider:

1. Канонизирует URI.
2. Проверяет scope сайта.
3. Проверяет зарегистрированный root публикатора.
4. Проверяет через `BoundVFS.Stat` с исходным actor, что root является каталогом.
5. Отдельно проверяет обязательные файлы `content.md`, `style.css`, `script.js`.
6. Сохраняет каноническую ссылку в Page metadata.

Metadata-запись сама по себе не предоставляет доступ к физическому ресурсу.

## 14. Прочитать или изменить файлы bundle

Чтение:

```text
GET /api/v2/vfs/read
URI local@alice[site-acme]:///pages/contacts/content.md
```

Полная замена:

```text
PUT /api/v2/vfs/file
URI local@alice[site-acme]:///pages/contacts/content.md
Body <Markdown bytes, возможно с inline HTML>
```

Аналогично читаются и полностью заменяются `style.css` и `script.js`. Редактор
получает `bundleRootUri` из `info.json`, безопасно добавляет фиксированное имя и
вызывает physical URI через обычный VFS API. HTML Provider в файловой операции
не участвует. VFS Core проверяет ACL физического URI. Отдельного `content.html`
в контракте нет.

## 15. Сохранить layout

```text
PUT /api/v2/vfs/file
URI html@site[site-acme]:///editor/layout.xml
```

Тело:

```xml
<site-layout schema-version="1" layout-revision="12">
  <nodes>
    <node page-id="142" x="120" y="80" width="240" height="120"
          view="expanded" />
    <node page-id="166" x="480" y="200" width="240" height="120"
          view="collapsed" />
  </nodes>
</site-layout>
```

HTML Provider проверяет:

- XML schema version;
- отсутствие DTD, external entities и XInclude;
- `layout-revision`;
- координаты, размеры и view;
- существование Page ID.

Текущий HTTP PUT возвращает `204 No Content`. После успеха клиент считает
revision увеличенной на один либо перечитывает `layout.xml`.

Layout не может изменить parent, position, title, status, theme или содержимое
страницы.

## 16. Конфликты

### Page conflict

```json
{
  "error": {
    "code": "page_revision_conflict",
    "message": "page was changed",
    "currentPageRevision": 6
  }
}
```

Действие редактора: сохранить введённые пользователем значения локально,
перечитать `info.json`, показать актуальные значения и повторить изменение
после подтверждения пользователя. Получение конфликта не очищает форму.

### Tree conflict

```json
{
  "error": {
    "code": "tree_revision_conflict",
    "message": "site tree was changed",
    "currentTreeRevision": 48
  }
}
```

Действие редактора: сохранить локальную операцию, перечитать `model.xml` и
перестроить дерево. Пользователь может повторить перемещение или удалить
локальную операцию после сравнения с актуальным деревом.

### Layout conflict

```json
{
  "error": {
    "code": "layout_revision_conflict",
    "message": "editor layout was changed",
    "currentLayoutRevision": 14
  }
}
```

Действие редактора: перечитать `layout.xml`. Автоматическое объединение
координат не входит в MVP.

## 17. Остальные ошибки

| Code | Значение | Действие клиента |
| --- | --- | --- |
| `invalid_argument` | Некорректный payload | Показать ошибку поля |
| `permission_denied` | Недостаточно ACL-прав | Не повторять без изменения прав |
| `not_found` | Страница, parent, theme или target отсутствует | Обновить данные |
| `already_exists` | Key или sibling slug уже существует | Предложить другое значение |
| `cycle_detected` | Move создаёт цикл | Отменить соединение |
| `resource_in_use` | Выбран `delete mode=reject` для страницы с детьми либо используется блок | Показать зависимости или предложить другой режим |
| `invalid_delete_mode` | Неизвестный режим удаления | Не выполнять удаление |
| `invalid_position_anchor` | Некорректные beforeId/afterId/first/last | Вернуть блок в прежнее положение |
| `invalid_editor_layout` | Layout XML не прошёл валидацию | Не заменять локальный layout молча |
| `unsupported` | Операция не поддерживается, например запись model.xml | Не повторять операцию |
| `broken_binding` | Каталог bundle или обязательный файл перемещён, удалён или недоступен | Показать, что сохранённая source-ссылка больше невалидна |

## 18. ACL-действия

| Операция | Действие ACL |
| --- | --- |
| Читать `model.xml` | `r` |
| Читать `layout.xml` | `r` |
| Сохранять `layout.xml` | `w` |
| Читать `info.json` | `r` |
| Create/update/move/delete и остальные команды | `x` на URI команды |
| Читать `content.md`, `style.css`, `script.js` | `r` на physical URI конкретного файла |
| Записывать `content.md`, `style.css`, `script.js` | `w` на physical URI конкретного файла |

Право на `info.json` не предоставляет право на физический файл под
`bundleRootUri`. Редактор выполняет отдельный VFS-запрос, и VFS Core проверяет
его actor и ACL непосредственно для physical URI.

### 18.1. Domain visibility

ACL `allow` сам по себе не добавляет страницу в HTML-проекцию. Редактор видит
Page только при наличии подходящей provider-owned visibility entry:

```text
all      все actors, включая guest
guest    только неаутентифицированный actor
user:17  точный trusted actor
```

Без записи Page отсутствует в `/pages`, `tree.json`, `model.xml`, direct lookup
и командах; ответ — `not_found`. `info.json` наследует visibility Page, а
невидимый parent скрывает поддерево. Physical файлы bundle не наследуют domain
visibility и защищаются ACL собственных URI. Команда `set-visibility` требует
ACL `x` и expected visibility revision, но её результат не предоставляет
`r/w/x`.

## 19. Прямые операции и VFS hooks

Прямой путь является основным контрактом:

```text
Editor -> HTTP VFS adapter -> VFS Core -> ACL -> HTML Provider
```

Для составного действия редактор может использовать hook:

```text
Editor -> Hook HTTP adapter -> Hook Runtime -> actor-bound VFS
       -> HTML Provider и другие providers
```

Подходящие сценарии:

| Hook | Назначение |
| --- | --- |
| `create-site` | Создать scope, connections, metadata сайта и начальные ACL |
| `create-page-with-content` | Создать physical bundle, Page и начальный layout |
| `delete-page-and-bundle` | Явно удалить metadata и отдельно physical bundle |
| `publish-site` | Подготовить и запустить составной сценарий публикации |

Hook вызывает те же VFS-ресурсы и команды, что доступны frontend-у напрямую.
Он не обращается к HTML Store и не меняет правила revisions.

Несколько VFS-вызовов внутри hook не являются одной транзакцией. При частичном
сбое ответ должен перечислить завершённые и неуспешные шаги. Frontend хранит
локальные операции до подтверждённого успеха и повторяет execution с тем же
idempotency key.

Строгая атомарность нескольких изменений дерева возможна только через одну
будущую пакетную команду HTML Provider. В MVP универсальная команда
`save-everything` не используется.

## 20. Полный рабочий цикл редактора

```text
Открыть редактор
    -> GET model.xml
    -> GET layout.xml
    -> объединить по page ID

Выбрать страницу
    -> GET pages/<key>/info.json
    -> запомнить pageRevision

Изменить поля
    -> Control update/set-types/set-theme/...
    -> передать expectedPageRevision
    -> сохранить новую pageRevision

Переместить страницу
    -> Control move
    -> передать expectedTreeRevision
    -> получить новую treeRevision/modelRevision

Удалить ветку
    -> Control delete mode=cascade
    -> одна команда удаляет всё поддерево

Изменить визуальное расположение
    -> PUT layout.xml
    -> передать layoutRevision внутри XML

Получить внешние изменения
    -> повторно GET model.xml или info.json

Выполнить составной сценарий
    -> вызвать зарегистрированный hook
    -> сохранить локальные операции до полного подтверждения
```

## 21. Что редактор не должен делать

- Сохранять или изменять `model.xml`.
- Считать layout connection структурной связью страниц.
- Удалять страницу из-за отсутствия узла в XML.
- Формировать actor, owner или ACL-права из клиентских данных.
- Обращаться к физическому provider в обход VFS Core или использовать его для
  доменной операции. Прямой VFS-доступ к source-файлам по `bundleRootUri`
  является штатной файловой операцией, а не обходом HTML Provider.
- Повторять конфликтующую запись без перечитывания актуальной revision.
- Считать ID страницы глобальной ACL-идентичностью.
- Считать успешные первые шаги hook доказательством успеха всего сценария.
- Ожидать транзакционного rollback от нескольких межпровайдерных VFS-вызовов.

## 22. Минимальный контракт MVP

Для первого рабочего редактора достаточно:

1. Read-only `model.xml`.
2. Read/write `layout.xml`.
3. Чтения `pages/<key>/info.json` и изменения разрешённых полей через Replace
   с revision либо эквивалентный `update` Control.
4. Команд `create`, `update`, `move`, `delete`, `set-visibility`.
5. Получения `bundleRootUri` из `info.json` и чтения/полной замены
   `content.md`, `style.css`, `script.js` по physical VFS URI.
6. `treeRevision`, `pageRevision`, `layoutRevision` и `visibilityRevision`.
7. Обработки `permission_denied`, `not_found`, `conflict`, `unsupported`.
8. Read-only application template manifest и entrypoint.
9. Выдачи разрешённой template static из `/templates` connection сайта через
   browser route `/_static`.

Hook Runtime не является обязательной зависимостью первого HTML MVP. После
реализации ADR-008 hooks добавляют удобные составные сценарии, не меняя прямой
контракт редактора с HTML Provider.

Types, search tags, themes, публикацию и автоматическое обновление редактора можно
подключать после первого сквозного сценария без изменения базовой схемы.

## 23. Application template и публичная статика

> Статус на 20 октября 2026 года: provider-side package storage и VFS-проекция
> реализованы. Установка принимает только явный список файлов, нормализует пути,
> вычисляет SHA-256 каждого asset/package/manifest и сохраняет новую key/version
> атомарно и неизменно. Reviewed directory builder собирает `default-spa/7` из
> `data/HTML/frontend`, отклоняет symlink/traversal и
> устанавливает package через VFS в demo bootstrap. Read-only `get-static`
> объявлен HTML Provider SDK module и получает binding при открытии connection;
> adapter вызывает его по canonical site URI. Hook читает разрешённый asset через
> actor-bound VFS, проверяет size/SHA-256 и возвращает
> bytes вместе с HTTP metadata. Demo Site HTTP Adapter выдаёт точный `/` и
> `/_static/*` через этот hook с MIME/ETag/revalidation headers и 404 без
> static fallback. Остальные browser paths передаются `get-page`, который через
> actor-bound VFS разрешает точную цепочку slug в `tree.json`; существующий путь
> получает SPA entrypoint вместе с actor-filtered bootstrap страницы. Adapter
> безопасно встраивает bootstrap в HTML и пересчитывает ETag, поэтому browser
> runtime сразу читает physical bundle без повторного `get-page` и отдельных
> запросов `site.json`/`info.json`. Неизвестный путь является успешным результатом
> hook с `found=false`, который HTTP Adapter преобразует в 404: простой HTML
> для `Accept: text/html` либо JSON `page_not_found` для API-клиента.
> Пока active publication не реализована, demo HTTP slice публично разрешает
> только страницы со status `ready`; `draft`, `hidden`, `archived` и их дочерние
> маршруты возвращаются как `found=false`.
> Active publication и
> sitemap/robots пока не реализованы.

HTML Provider предоставляет установленный application template один раз внутри
connection конкретного сайта:

```text
html@site[site-acme]:///templates/default-spa/1/manifest.json
html@site[site-acme]:///templates/default-spa/1/files/index.html
html@site[site-acme]:///templates/default-spa/1/files/js/app.js
```

Template package и его manifest загружает actor с правом изменять templates
сайта. Для первого сайта это делает bootstrap, для следующих версий — создатель
сайта или назначенный администратор. HTML Provider валидирует manifest и
устанавливает versioned package целиком. Существующая версия не редактируется:
для изменений устанавливается новая версия.

Установка выполняется доменной командой `install` на
`html@site[site-acme]:///templates`. Источник package может быть встроенным
bootstrap-пакетом или URI файлового provider, но после установки клиент всегда
видит его через site-local `/templates/<key>/<version>` и не обращается к
источнику напрямую.

Пример manifest:

```json
{
  "schema_version": 1,
  "template_key": "default-spa",
  "version": "1",
  "entrypoint": "index.html",
  "package_digest": "...",
  "assets": [
    {"path": "js/app.js", "content_type": "application/javascript; charset=utf-8", "digest": "...", "size": 42509},
    {"path": "js/vfsv2.js", "content_type": "application/javascript; charset=utf-8", "digest": "...", "size": 10320},
    {"path": "vendor/markdown-it.min.js", "content_type": "application/javascript; charset=utf-8", "digest": "...", "size": 123618},
    {"path": "css/style.css", "content_type": "text/css; charset=utf-8", "digest": "...", "size": 5678},
    {"path": "img/favicon.png", "content_type": "image/png", "digest": "...", "size": 14714},
    {"path": "img/icons.svg", "content_type": "image/svg+xml", "digest": "...", "size": 260562}
  ]
}
```

Site publication manifest фиксирует site-local manifest URI и digest:

```json
{
  "applicationTemplate": {
    "key": "default-spa",
    "version": "1",
    "manifestUri": "html@site[site-acme]:///templates/default-spa/1/manifest.json",
    "digest": "sha256:..."
  }
}
```

Целевой Site HTTP Adapter читает active publication manifest. Текущий demo slice
передаёт `site_uri` и `template_key` в typed input `get-static`; browser URL преобразуется во input
hook, который читает тот же site-local template resource через actor-bound VFS:

```text
GET /
  -> html@site[site-acme]:///templates/default-spa/1/files/index.html

GET /_static/js/app.js
  -> html@site[site-acme]:///templates/default-spa/1/files/js/app.js

GET /_static/css/style.css
  -> html@site[site-acme]:///templates/default-spa/1/files/css/style.css
```

`/_static` здесь является только внешним HTTP namespace. Каталога
`/public/_static` в site connection нет: адаптер читает тот же файл прямо из
`/templates`, поэтому второй VFS-ресурс и вторая копия байтов не возникают.

Текущий каталог `data/HTML/frontend` используется только как исходный материал
первого template package. В публичный manifest входят необходимые `index.html`,
`app.js`, `vfsv2.js`, `style.css`, `markdown-it`, icons и fonts. Наличие файла в
этом каталоге само по себе не делает его доступным.

В частности, generator binary, `generate_sprite.go`, zip-архив, swap-файл и
неиспользуемые копии SVG не выдаются. Каталоги `data/HTML/block/pages` и
`data/HTML/block/plugin` также не становятся статикой шаблона автоматически:
это содержимое или библиотека блоков с отдельным жизненным циклом.

Правила выдачи:

1. Template entrypoint последней установленной версии bound template key
   возвращается для `/` и существующего SPA-маршрута.
2. Запрос `/_static/...` никогда не получает fallback `index.html`.
   Key/version во внешнем URL отсутствуют.
3. Asset отсутствует в manifest — возвращается `404`.
4. Path traversal и обращение к filesystem path запрещены.
5. Content-Type берётся из manifest либо безопасной таблицы MIME.
6. Unversioned static получает ETag и требует revalidation без immutable cache.
7. Entrypoint также ревалидируется после установки новой версии template.
8. Theme и пользовательские assets продолжают храниться в connections
   публикаторов и не смешиваются с application runtime.
9. Установка новой версии bound template key сразу делает её источником `/` и
   `/_static/*`; ранее установленная версия остаётся immutable в VFS.
10. Пока ни одной версии bound template key нет, публичный root возвращает 404.
