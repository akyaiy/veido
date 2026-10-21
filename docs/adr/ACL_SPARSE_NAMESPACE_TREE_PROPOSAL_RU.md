# ADR-006: Разреженное дерево ACL namespace

> Статус решения: предложено, не принято.  
> Статус реализации: не реализовано.  
> Дата предложения: 20 сентября 2026 года.  
> Связанные документы: [ADR-003: ACL lifecycle](ACL_LIFECYCLE_ARCHITECTURE_RU.md), [концепция ACLv2](../ACL_V2_CONCEPT_RU.md), [текущая реализация VFSv2](../VFS_V2_IMPLEMENTATION_RU.md).

До принятия этого ADR действующим решением остаётся ADR-003. Этот документ
предлагает заменить описанное в ADR-003 плоское хранение ACL по полным URI и
массовую материализацию после move на внутреннее разреженное дерево адресов.
Durable journal, fail-closed поведение, идемпотентность и восстановление после
частичных сбоев при этом сохраняются.

## 1. Контекст

VFS обращается к ресурсам по каноническим URI:

```text
local@default[user:alice]:///docs/report.pdf
```

Права могут быть назначены как каталогу, так и отдельным вложенным ресурсам:

```text
/docs
/docs/report.pdf
/docs/team/spec.md
```

Если каждая ACL-запись хранит полный URI, переименование `/docs` в
`/documents` меняет адрес каждой записи внутри поддерева. Есть два основных
способа обработать это:

1. синхронно переписать все затронутые ACL-записи;
2. сохранить mapping старого prefix на новый, читать через overlay и позднее
   выполнить фоновую материализацию.

Первый вариант плохо масштабируется для больших деревьев. Второй позволяет
быстро завершить move, но требует сложного overlay, цепочек mapping,
materializer и compaction.

Предлагаемая модель хранит адрес как дерево сегментов:

```text
namespace root
└── docs                  node_id=10
    ├── report.pdf        node_id=11
    └── team              node_id=12
        └── spec.md       node_id=13
```

Правила ссылаются на `node_id`. При rename каталога меняется имя одного узла,
а при move — его `parent_id`. Узлы потомков и их правила не изменяются.

Дерево является разреженным: ACL не обязан хранить каждый существующий ресурс.
Узлы создаются только там, где они нужны для правил, tombstone, навигации к
другому ACL-узлу или незавершённой lifecycle-операции.

## 2. Цели

Предложение должно обеспечить:

1. Rename и move ACL-поддерева без массового обновления потомков.
2. Динамическое наследование правил по текущей цепочке родителей.
3. Сохранение прямых и внутренних recursive-правил при штатном move.
4. Немедленное переключение внешнего наследования на нового родителя.
5. Защиту от получения старых прав новым объектом по повторно использованному
   адресу.
6. Отсутствие полного зеркала VFS namespace внутри ACL.
7. Независимость универсальной ACL-модели от provider-local ID и backend API.
8. Восстановление после частичного сбоя между provider и ACL.
9. Понятную модель хранения и проверки, которую можно реализовывать поэтапно.

## 3. Что не является целью

Этим решением не вводятся:

- глобальный идентификатор VFS-ресурса;
- обязательный единый идентификатор для разных провайдеров;
- доказательство существования ресурса на основании ACL-узла;
- общая SQL-транзакция между доменами провайдеров и ACL;
- хранение backend ID, inode, ETag, размера или хеша содержимого в ACL;
- автоматическое определение идентичности произвольно изменённого внешнего
  ресурса;
- собственная авторизация внутри провайдера в обход VFS Core и ACL.

## 4. Термины

### 4.1. Канонический URI

Системный адрес, который VFS Core передаёт ACL и провайдеру. Он содержит:

```text
provider + connection + scope + canonical path
```

Пример:

```text
local@default[user:alice]:///docs/report.pdf
```

### 4.2. Namespace root

Корень одного пространства имён ACL, определяемый сочетанием:

```text
provider_key + connection_key + scope_key
```

Разные connections или scopes всегда имеют разные roots, даже если их
внутренние пути совпадают.

### 4.3. ACL path node

Внутренний узел адресного дерева ACL. Он хранит один канонический сегмент и
ссылку на родителя.

`node_id` является приватным ключом ACL-хранилища. Он:

- не входит в канонический URI;
- не возвращается как идентичность VFS-ресурса;
- не передаётся провайдеру;
- не сопоставляется с provider-local ID;
- не объединяет один физический объект, доступный через разные roots;
- используется только для связей между собственными таблицами ACL.

Узел означает, что ACL хранит состояние для данного адреса. Он не означает,
что соответствующий VFS-ресурс существует сейчас или существовал всегда.

### 4.4. Структурный узел

Узел без собственного правила, необходимый для достижения более глубокого
ACL-узла.

Например, если правило есть только на `/docs/team/report.pdf`, ACL всё равно
хранит структурные узлы `/docs` и `/docs/team`.

### 4.5. Tombstone

Удалённый узел, сохраняемый на ограниченное время, чтобы старые правила и
запоздалые операции не применились к новому объекту по тому же адресу.

## 5. Решение

Принять следующую логическую модель:

```text
Публичный адрес ACL       = канонический VFS URI
Внутреннее хранение пути = namespace root + дерево ACL path nodes
Связь правила            = ACL node_id
Rename                   = изменение segment одного узла
Move                     = изменение parent_id и, при необходимости, segment
Delete                   = tombstone старого узла
Recreate                 = новый node_id
Согласованность           = durable lifecycle journal + recovery
```

Дерево хранится отдельно для каждого namespace root. Оно является внутренним
индексом ACL-политики, а не реестром ресурсов всей системы.

## 6. Архитектурные границы

### 6.1. Auth

Auth устанавливает доверенного actor. ACL не принимает `user_id` или группы из
непроверенного клиентского payload.

### 6.2. ACL

ACL:

- разрешает канонический URI в собственном разреженном дереве;
- собирает правила actor и его групп;
- вычисляет наследование;
- принимает окончательное внутреннее решение allow/deny;
- хранит lifecycle journal и tombstone своего namespace;
- не читает внутренние таблицы провайдеров.

### 6.3. VFS Core

VFS Core:

- канонизирует и разрешает адрес;
- сохраняет исходного actor;
- вызывает ACL до защищённой операции;
- маршрутизирует разрешённую операцию провайдеру;
- связывает provider-операцию с ACL lifecycle operation;
- не трактует ACL node как доказательство существования backend-объекта.

### 6.4. Провайдер

Провайдер:

- владеет ресурсом и его доменной моделью;
- проверяет собственные backend constraints после ACL allow;
- может использовать provider-local ID, ETag и revision внутри своего домена;
- не получает ACL repository или ACL management service;
- не назначает права напрямую.

Если провайдеру требуется изменить защищённый ресурс другого домена, он делает
это через actor-bound `BoundVFS`.

## 7. Служебная модель хранения

SQL ниже описывает предполагаемую SQLite-реализацию. Точная миграция может быть
уточнена без изменения логической модели.

### 7.1. Namespace roots

```sql
CREATE TABLE acl_namespace_roots (
    root_id INTEGER PRIMARY KEY AUTOINCREMENT,

    provider_key   TEXT NOT NULL,
    connection_key TEXT NOT NULL,
    scope_key      TEXT NOT NULL,

    state TEXT NOT NULL DEFAULT 'active'
        CHECK (state IN ('active', 'disabled')),

    namespace_revision INTEGER NOT NULL DEFAULT 1,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (provider_key, connection_key, scope_key)
);
```

`namespace_revision` используется для версий, кешей и
определения устаревших вычислений. Он не является идентификатором ресурса.

### 7.2. ACL path nodes

```sql
CREATE TABLE acl_path_nodes (
    node_id INTEGER PRIMARY KEY AUTOINCREMENT,

    root_id   INTEGER NOT NULL,
    parent_id INTEGER,

    segment     TEXT NOT NULL,
    segment_key TEXT NOT NULL,

    state TEXT NOT NULL DEFAULT 'active'
        CHECK (state IN ('active', 'moving', 'deleted')),

    node_revision INTEGER NOT NULL DEFAULT 1,

    created_operation_id TEXT,
    deleted_operation_id TEXT,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (root_id, node_id),

    FOREIGN KEY (root_id)
        REFERENCES acl_namespace_roots(root_id),

    FOREIGN KEY (root_id, parent_id)
        REFERENCES acl_path_nodes(root_id, node_id),

    CHECK (parent_id IS NULL OR parent_id <> node_id)
);
```

Уникальность активного адреса задаётся частичными индексами:

```sql
CREATE UNIQUE INDEX uq_acl_root_child
ON acl_path_nodes(root_id, segment_key)
WHERE parent_id IS NULL AND state = 'active';

CREATE UNIQUE INDEX uq_acl_node_child
ON acl_path_nodes(root_id, parent_id, segment_key)
WHERE parent_id IS NOT NULL AND state = 'active';

CREATE INDEX idx_acl_nodes_parent
ON acl_path_nodes(root_id, parent_id, state);
```

`segment` хранит каноническое представление для восстановления URI.
`segment_key` хранит форму, по которой конкретный namespace сравнивает имена.
При case-sensitive адресации эти значения могут совпадать.

### 7.3. Правила

```sql
CREATE TABLE acl_rules (
    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL,

    subject_key TEXT NOT NULL,
    action TEXT NOT NULL
        CHECK (action IN ('r', 'w', 'x')),
    effect TEXT NOT NULL
        CHECK (effect IN ('allow', 'deny')),

    priority INTEGER NOT NULL DEFAULT 50
        CHECK (priority BETWEEN 1 AND 100),

    recursive INTEGER NOT NULL DEFAULT 0
        CHECK (recursive IN (0, 1)),

    created_by_actor TEXT NOT NULL,
    rule_revision INTEGER NOT NULL DEFAULT 1,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (node_id)
        REFERENCES acl_path_nodes(node_id),

    UNIQUE (node_id, subject_key, action)
);
```

Базовые subject keys:

```text
user:<id>
group:<id>
service:<id>
all
guest
```

Одна строка задаёт одно действие. Изменение allow на deny или обратно является
обновлением существующего правила, а не созданием конфликтующей второй строки.

`priority` задаёт силу правила:

```text
1   = минимальный приоритет
50  = приоритет по умолчанию
100 = максимальный приоритет
```

Приоритет принадлежит правилу, а не пользователю, группе или ACL-узлу. Одно и
то же правило сохраняет свой приоритет при рекурсивном применении к потомкам.

### 7.4. Lifecycle operations

```sql
CREATE TABLE acl_lifecycle_operations (
    operation_id TEXT PRIMARY KEY,

    root_id INTEGER NOT NULL,
    sequence INTEGER NOT NULL,

    kind TEXT NOT NULL CHECK (
        kind IN ('create', 'rename', 'move', 'delete', 'resync')
    ),

    source_node_id INTEGER,
    source_parent_id INTEGER,
    target_parent_id INTEGER,

    old_segment TEXT,
    new_segment TEXT,

    expected_node_revision INTEGER,

    state TEXT NOT NULL CHECK (
        state IN (
            'prepared',
            'provider_committed',
            'acl_committed',
            'aborted',
            'recovery'
        )
    ),

    actor_key TEXT NOT NULL,

    provider_event_id TEXT,
    provider_revision TEXT,
    error_code TEXT,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (root_id)
        REFERENCES acl_namespace_roots(root_id),

    UNIQUE (root_id, sequence)
);
```

Дополнительные индексы нужны для поиска по `provider_event_id`, выборки
незавершённых операций и восстановления порядка событий внутри root.

## 8. Разреженность дерева

ACL не регистрирует каждый VFS-ресурс автоматически.

Допустим, в VFS существуют:

```text
/docs
/docs/a.txt
/docs/b.txt
/docs/archive
/docs/archive/old.txt
```

Если правила назначены только на `/docs` и `/docs/archive/old.txt`, ACL хранит:

```text
root
└── docs
    └── archive
        └── old.txt
```

`a.txt` и `b.txt` отсутствуют в ACL-дереве, но могут получать recursive-права
узла `/docs`.

Узел создаётся, когда требуется хотя бы одно из условий:

- на адрес назначается прямое или recursive-правило;
- узел нужен как родитель более глубокого ACL-узла;
- адрес хранит tombstone;
- адрес участвует в незавершённой lifecycle-операции.

Если путь не имеет правил, потомков, tombstone и незавершённых операций, ACL
может удалить его структурные узлы снизу вверх.

Очистка должна быть консервативной и идемпотентной. В первой реализации она
может выполняться фоновым worker и никогда не должна удалять узел, на который
ссылается журнал или аудит.

## 9. Создание и изменение правил

### 9.1. Grant

Для выдачи права на:

```text
local@default[user:alice]:///docs/team/report.pdf
```

ACL:

1. Получает уже канонизированный `ResourceRef`.
2. Находит root по provider, connection и scope.
3. Разбивает path на канонические сегменты.
4. В одной ACL-транзакции создаёт отсутствующие структурные узлы.
5. Проверяет `priority` в диапазоне 1–100; при отсутствии значения использует
   приоритет 50.
6. Создаёт или обновляет правило конечного узла.
7. Записывает actor, выполнившего изменение.
8. Увеличивает затронутые revisions.

Существование целевого VFS-ресурса проверяется через публичный VFS-контракт.
ACL не читает таблицу или backend целевого провайдера напрямую.

### 9.2. Revoke

Revoke удаляет правило либо создаёт упорядоченную запись об отзыве, если этого
требует аудит. После этого ACL может запустить pruning пустых структурных узлов.

Удаление правила не означает удаление VFS-ресурса.

### 9.3. Управление ACL

Пользовательское управление правилами должно быть представлено ресурсами и
командами ACL Provider. Другой провайдер обращается к ним через `BoundVFS` и
`Control` с исходным actor.

Прямой ACL management service не внедряется в VFS-провайдеры.

## 10. Алгоритм проверки доступа

Для `(actor, action, canonical URI)` ACL выполняет:

1. Проверяет корректность `ResourceRef` и допустимость action.
2. Строит subject keys actor, включая подтверждённые группы.
3. Находит namespace root.
4. Идёт от root по сегментам path через активные узлы.
5. Собирает найденную цепочку ACL-узлов.
6. Если очередного узла нет, прекращает обход: более глубоких узлов в
   корректном разреженном дереве быть не может.
7. На точном узле учитывает правила независимо от `recursive`.
8. На предках учитывает только правила с `recursive=true`.
9. Среди всех применимых правил находит максимальный `priority`.
10. Отбрасывает правила с меньшим приоритетом независимо от глубины их узла.
11. Если среди правил максимального приоритета присутствует хотя бы один deny,
    возвращает deny.
12. Иначе, если среди них присутствует allow, возвращает allow.
13. Если применимых правил нет, возвращает deny либо отдельно определённый
    owner fallback.

Ошибка чтения root, дерева, групп или правил останавливает защищённую операцию.
Инфраструктурная ошибка и обычный deny должны оставаться различимыми для аудита
и наблюдаемости, хотя оба результата являются fail-closed.

### 10.1. Порядок приоритетов

При сравнении применимых правил действует следующий порядок:

```text
1. Применимость subject, action и recursive.
2. Максимальное числовое значение priority.
3. Deny побеждает allow при одинаковом максимальном priority.
```

Глубина узла сама по себе не сильнее числового приоритета. Поэтому прямое
правило цели может быть перекрыто recursive-правилом предка с большим
приоритетом. И наоборот, прямое правило с большим приоритетом может создать
явное исключение из унаследованного правила.

| Применимые правила | Результат |
| --- | --- |
| Родитель: recursive allow, priority 40; цель: deny, priority 60 | Deny цели сильнее |
| Родитель: recursive deny, priority 70; цель: allow, priority 80 | Allow цели сильнее |
| Родитель: recursive allow, priority 90; цель: deny, priority 50 | Allow родителя сильнее |
| Родитель: recursive allow, priority 60; цель: deny, priority 60 | Deny при равном приоритете |
| User allow и group deny с priority 75 | Deny при равном приоритете |

Правило с `recursive=false`, расположенное на предке, не является применимым и
не участвует в сравнении приоритетов. На собственном узле правило применяется
независимо от значения `recursive`.

Приоритет `100` является верхней границей. Поэтому deny с priority 100 нельзя
перекрыть обычным allow: allow 100 имеет тот же уровень, на котором побеждает
deny. Право создавать такие ограничения должно выдаваться осознанно.

### 10.2. Пример наследования

```text
/docs                  recursive allow user:bob    r priority=40
/docs/private          recursive deny  group:staff r priority=60
/docs/private/a.txt    direct allow     user:bob    r priority=80
```

Если Bob входит в `group:staff`:

- `/docs/public.txt` разрешён правилом `/docs`;
- `/docs/private/b.txt` запрещён правилом `/docs/private` с priority 60;
- `/docs/private/a.txt` разрешён прямым правилом файла с priority 80.

Локальное исключение создаётся явно более высоким приоритетом, а не только
положением правила в дереве. `break_inheritance` для базовой модели не нужен.
Если потребуется полностью отбросить все правила предков независимо от их
приоритета, это потребует отдельного архитектурного решения.

## 11. Семантика действий

Базовые действия:

| Тип цели | `r` | `w` | `x` |
| --- | --- | --- | --- |
| Файл | Читать содержимое | Изменять содержимое или метаданные | Выполнять, если поддерживается |
| Каталог | Читать список | Изменять состав каталога | Проходить к потомку |
| Доменная проекция | Читать представление | Изменять через доменную валидацию | Вызывать capability или command |

Операции VFS требуют комбинаций проверок:

| Операция | Проверки |
| --- | --- |
| Чтение файла | `r` на файл и `x` на предках |
| Создание | `w+x` на родительском каталоге |
| Удаление | `w+x` на родительском каталоге |
| Rename/move | `w+x` на старом и новом родителях |
| `Control` | `x` на ресурсе команды |

`ManageACL` не добавляется универсальным битом файла. Управление правами идёт
через защищённые ресурсы ACL Provider.

## 12. Rename

Для rename внутри того же родителя ACL меняет одну запись:

```sql
UPDATE acl_path_nodes
SET segment = ?,
    segment_key = ?,
    node_revision = node_revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE node_id = ?
  AND node_revision = ?
  AND state = 'active';
```

Правила узла и всех потомков остаются привязанными к прежним `node_id`.

До операции проверяются:

- каноничность нового сегмента;
- отсутствие активного sibling с тем же `segment_key`;
- ожидаемая revision;
- отсутствие конфликтующей lifecycle-операции.

## 13. Move внутри одного root

Move меняет родителя корня переносимого ACL-поддерева:

```sql
UPDATE acl_path_nodes
SET parent_id = ?,
    segment = ?,
    segment_key = ?,
    node_revision = node_revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE node_id = ?
  AND node_revision = ?
  AND state = 'active';
```

Если путь нового родителя отсутствует в разреженном дереве, ACL сначала создаёт
необходимую цепочку структурных узлов.

Move запрещается, если:

- target находится внутри переносимого поддерева;
- активный target уже занят;
- source и target относятся к разным roots;
- revision изменилась после prepare;
- пересекающаяся lifecycle-операция ещё не завершена.

После изменения `parent_id`:

- прямые правила всех узлов сохраняются;
- recursive-правила внутри поддерева сохраняются;
- наследование от внешних старых родителей прекращается;
- наследование от внешних новых родителей применяется автоматически.

Массовое обновление URI потомков, prefix overlay и materializer для такого move
не требуются.

## 14. Delete и повторное создание

Delete переводит корень затронутого ACL-поддерева в `deleted`:

```sql
UPDATE acl_path_nodes
SET state = 'deleted',
    deleted_operation_id = ?,
    node_revision = node_revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE node_id = ?
  AND node_revision = ?;
```

Потомки могут оставаться физически связаны со старым узлом для аудита и
retention, но evaluator не проходит через deleted-родителя.

Повторное создание по тому же адресу создаёт новый активный узел:

```text
старый /docs -> node_id=10, state=deleted
новый  /docs -> node_id=27, state=active
```

Старые правила продолжают ссылаться на `node_id=10` и не применяются к новому
узлу.

Если для удаляемого URI и его поддерева в ACL нет ни одного узла, правила
переносить нечему и новый tombstone создавать необязательно. Journal операции
может сохраняться независимо для аудита и дедупликации.

## 15. Create

Разреженная модель не требует создавать ACL node после каждого успешного
создания VFS-ресурса.

Узел создаётся после create, только если:

- bootstrap policy создаёт прямое правило;
- создаётся ACL-управляемый корень;
- адрес уже участвует в lifecycle recovery;
- нужно закрыть неоднозначное состояние fail-closed.

Если автоматические права создателя материализуются для каждого файла, ACL
неизбежно начинает зеркалить весь VFS namespace. Поэтому права создателя должны
быть отдельной продуктовой политикой, а не обязательным свойством дерева.

Возможные политики:

1. owner fallback из доверенных метаданных провайдера;
2. явные bootstrap grants только для выбранных типов ресурсов;
3. recursive grants на пользовательские корни, а не на каждый дочерний объект.

До принятия отдельного решения по владельцу этот ADR не утверждает, что любой
создатель автоматически получает recursive `r/w/x`.

## 16. Cross-root и cross-provider move

Move между разными namespace roots является `copy + delete`:

- target получает новые ACL-узлы;
- старый `node_id` не переносится;
- прямые правила источника не копируются автоматически;
- target наследует правила своего нового root и родителей;
- перенос ACL возможен только как отдельная явная и авторизованная политика.

Это правило применяется и к разным connections одного provider.

## 17. Lifecycle journal и частичные сбои

Дерево делает ACL-часть move дешёвой, но не создаёт общей транзакции с backend.
Поэтому journal остаётся обязательным.

Нормальная последовательность:

```text
1. PREPARED
   Зафиксированы operation_id, actor, source, target и ожидаемые revisions.

2. Provider operation
   VFS Core вызывает provider.

3. PROVIDER_COMMITTED
   Backend подтвердил изменение namespace.

4. ACL tree update
   ACL изменяет segment или parent_id одной транзакцией.

5. ACL_COMMITTED
   Операция полностью согласована.
```

Если provider отказал до commit, операция становится `aborted`, дерево не
меняется.

Если provider commit подтверждён, но обновление ACL не завершилось, операция
становится `recovery`. Затронутый адрес или prefix работает fail-closed до
завершения reconciliation.

Повтор запроса с тем же `operation_id` не создаёт новую операцию и возвращает
текущее состояние существующей.

## 18. Конкурентность

Минимальная защита включает:

- compare-and-swap по `node_revision`;
- монотонный `sequence` внутри namespace root;
- уникальные индексы активных siblings;
- durable fence для source и target незавершённого move;
- запрет циклов дерева;
- идемпотентность по `operation_id` и `provider_event_id`.

Независимые ветви одного root могут изменяться параллельно. Операции должны
сериализоваться, если их source/target пути пересекаются либо одна операция
меняет предка другой.

Проверка отсутствия цикла не должна ограничиваться сравнением непосредственного
родителя: target parent не может быть любым потомком source node.

## 19. Изменения вне VFS

ACL-дерево само по себе не может определить, что внешний backend переименовал
`/a` в `/b`. Для строгой синхронизации нужен устойчивый provider change feed с:

- `event_id`;
- монотонным sequence или cursor;
- old/new provider-local path;
- признаком move дерева;
- provider revision, если она доступна.

Change supervisor добавляет доверенные provider, connection и scope, строит
канонические URI и записывает lifecycle operation.

Provider-local immutable ID может использоваться адаптером для распознавания
rename, но не сохраняется в ACL как идентичность узла.

Если backend не предоставляет надёжный change feed, подключение должно выбрать
один из явно задокументированных режимов:

- запрет namespace-мутаций вне VFS;
- периодическая reconciliation;
- ослабленная гарантия времени согласования.

При неоднозначности ACL не угадывает соответствие узлов и действует fail-closed.

## 20. Канонизация

Без однозначной канонизации одно правило можно обойти через альтернативное имя.
До поиска root и узлов VFS должен учитывать:

- `.` и `..`;
- повторные разделители;
- percent encoding;
- Unicode-нормализацию;
- регистрозависимость backend;
- недопустимые символы;
- symlink, hardlink и provider-specific alias;
- невозможность выхода выше root.

ACL хранит уже канонические `segment` и `segment_key`. Он не должен повторно
изобретать provider-specific правила нормализации.

Если один физический объект намеренно доступен через несколько канонических URI,
эти URI остаются разными ACL-контекстами.

## 21. Проверка backend-версии и TOCTOU

ACL отвечает только за внутреннее решение доступа и revision своей политики.
Провайдер отвечает за то, что после проверки изменяется ожидаемый backend-объект.

Разделение данных:

| Данные | Владелец |
| --- | --- |
| Канонический URI, ACL node/revision, правила | ACL |
| Provider object ID, inode, ETag, object version | Provider |
| Actor и подтверждённые identity-данные | Auth |
| Маршрутизация и порядок ACL/provider вызовов | VFS Core |

ACL allow не отменяет backend deny или конфликт версии.

SHA-256 и HMAC fingerprint не входят в универсальную ACL-схему. Конкретный
провайдер может использовать их для своей reconciliation, если backend не даёт
более сильной версии или immutable ID.

## 22. Аудит и explain

Изменение правила и lifecycle operation должны сохранять:

- actor;
- исходный canonical URI;
- root и node;
- source/target для move;
- operation ID;
- старую и новую revision;
- результат;
- классифицированную ошибку.

ACL Provider должен уметь объяснить решение без раскрытия лишних данных:

```json
{
  "allowed": false,
  "matched_uri": "local@default[user:alice]:///docs/private",
  "matched_subject": "group:staff",
  "action": "r",
  "effect": "deny",
  "priority": 60,
  "recursive": true
}
```

Explain является диагностикой принятого решения, а не отдельным способом
обойти проверку прав на просмотр ACL.

## 23. Производительность

### 23.1. Ожидаемые преимущества

- Rename и move ACL-поддерева требуют изменения одного узла.
- Правила не содержат повторяющиеся длинные URI.
- Индексы правил используют короткий `node_id`.
- Наследование следует уже существующим parent links.
- Нет цепочек prefix mapping на обычном request path.
- Не нужен массовый materializer после каждого move.
- Разреженность ограничивает размер дерева количеством ACL-состояния, а не
  количеством всех VFS-ресурсов.

### 23.2. Стоимость

- URI lookup требует обхода сегментов.
- Полный URI узла приходится восстанавливать по родителям либо кешировать.
- Нужна защита от циклов и конфликтующих move.
- Для внешних изменений всё равно требуется change feed или reconciliation.
- Tombstone и journal требуют retention и фоновой очистки.

В памяти допустим кеш root и дочерних узлов. Он является производным индексом и
должен полностью восстанавливаться из БД. Потеря кеша не меняет решение ACL.

## 24. Влияние на текущую реализацию

На момент предложения:

- `internal/vfs/v2.ACLAuthorizer.Can` разрешает любой запрос;
- `ResourceLifecycleSink` содержит только синхронные post-operation callbacks;
- существует `NoopResourceLifecycle`;
- пакет `internal/acl` реализует legacy groups и строковые permission keys, но не
  resource ACL;
- durable journal, sparse tree evaluator и recovery отсутствуют.

Предлагаемый порядок реализации после принятия ADR:

1. Добавить новый resource ACL package, не смешивая его с legacy permission
   ACL.
2. Добавить миграции roots, nodes, rules и lifecycle journal.
3. Реализовать repository и операции `ResolvePath`, `EnsurePath`, `RenameNode`,
   `MoveNode`, `TombstoneNode`, `PruneEmptyPath`.
4. Реализовать evaluator и заменить allow-all `ACLAuthorizer`.
5. Добавить ACL Provider с `grant`, `revoke`, `list` и `explain` через VFS.
6. Расширить lifecycle contract до prepare/commit/abort/recover.
7. Добавить recovery worker и durable fences.
8. Выполнить ограниченную миграцию существующих прав.
9. Удалить `NoopResourceLifecycle` из защищённых production-сборок.
10. Удалить временные owner/scope bridges после появления эквивалентных правил.

Legacy permissions вроде `html.view.*` и `auth.login` могут временно продолжать
работать отдельно. Их нельзя автоматически переносить в resource ACL без
явного соответствия URI и `r/w/x`.

## 25. Миграция данных

Миграция должна быть разреженной:

1. Создать roots для реально используемых provider/connection/scope.
2. Для каждого переносимого resource rule канонизировать URI.
3. Создать только цепочку узлов, необходимую этому правилу.
4. Не сканировать и не регистрировать все backend-ресурсы.
5. Не переносить provider-local ID в ACL.
6. Сверить результат через shadow evaluator.
7. Сравнить решения старого и нового evaluator на записанном наборе запросов.
8. Включать enforcement по roots или connections поэтапно.

При невозможности однозначно преобразовать старое permission правило оно
остаётся в legacy ACL до отдельного решения.

## 26. Что откладывается

Первая версия намеренно не включает:

- режим `children-only`;
- `break_inheritance`;
- автоматическое копирование ACL между roots;
- автоматический recursive grant создателю каждого ресурса;
- хранение fingerprints содержимого;
- использование ACL tree как каталога существующих ресурсов;
- физическое удаление tombstone без утверждённой retention policy;
- change feed для каждого провайдера до стабилизации VFS lifecycle.

Эти возможности могут быть добавлены отдельными решениями после появления
подтверждённых продуктовых сценариев.

## 27. Альтернативы

### 27.1. Плоские URI и синхронный rewrite

Плюсы:

- простая таблица;
- простой lookup точного URI.

Минусы:

- move большого дерева обновляет много строк;
- длительные блокировки;
- стоимость пропорциональна числу ACL-записей в поддереве.

### 27.2. Плоские URI, overlay и materializer

Это принятое в ADR-003 решение.

Плюсы:

- канонический URI непосредственно хранится в каждом правиле;
- ACL не требует parent-linked tree;
- большой move может завершиться до физического rewrite.

Минусы:

- authoritative overlay становится частью каждой проверки;
- появляются цепочки mapping, compaction и hard limits;
- grant/revoke во время materialization требуют дельт и CAS;
- recovery сложнее объяснить и тестировать.

### 27.3. Полное зеркало VFS namespace в ACL

Плюсы:

- каждый ресурс всегда имеет ACL node;
- просто привязать creator grant и состояние объекта.

Минусы:

- ACL дублирует весь namespace;
- каждый create/delete требует синхронизации;
- объём данных зависит от всех ресурсов, а не только от ACL;
- повышается риск превращения ACL в четвёртый системный реестр ресурсов.

Это предложение выбирает разреженное дерево как середину между плоским URI и
полным зеркалом VFS.

## 28. Положительные последствия

- Rename и move поддерева становятся локальными изменениями.
- Прямые правила потомков не переписываются.
- Наследование следует текущей структуре дерева.
- Delete + recreate естественно разделяются разными node IDs.
- ACL не хранит каждый VFS-ресурс.
- Нет необходимости в prefix materialization для обычного move.
- Публичные контракты продолжают использовать канонические URI.
- Provider-specific идентичность остаётся внутри провайдера.

## 29. Отрицательные последствия и риски

- ACL хранит собственную нормализованную структуру адресов и обязан сохранять её
  согласованность с подтверждёнными VFS lifecycle-операциями.
- Внутренний `node_id` переживает rename/move ACL-поддерева, поэтому граница
  между адресным индексом и параллельной идентичностью должна строго
  соблюдаться.
- Ошибка parent link влияет на всё ACL-поддерево.
- Требуются cycle detection, revision checks и durable recovery.
- Изменения вне VFS остаются сложными без надёжного change feed.
- Реконструкция полного URI требует обхода предков.
- Автоматические per-resource grants уничтожают преимущество разреженности.

## 30. Критерии принятия решения

До перевода ADR в статус «Принято» необходимо согласовать:

1. Считается ли `node_id` допустимым приватным ключом ACL namespace, не
   являющимся системной идентичностью ресурса.
2. Заменяет ли этот ADR части ADR-003 про generation, prefix overlay,
   materializer и compaction.
3. Точную политику owner fallback и bootstrap grants.
4. Retention tombstone и audit history.
5. Контракт staged lifecycle между VFS Core и ACL.
6. Поведение при отсутствии надёжного provider change feed.
7. Семантику удаления поддерева и фонового pruning.
8. Форму ACL Provider API для grant/revoke/list/explain.
9. Стратегию сосуществования с legacy permission ACL.

## 31. Критерии готовности реализации

После принятия реализация считается готовой, когда тесты подтверждают:

1. Прямой grant действует только на точный узел.
2. Recursive grant действует на потомков без создания узла для каждого файла.
3. Из применимых правил побеждает правило с максимальным priority.
4. Deny побеждает allow при одинаковом максимальном priority.
5. Recursive-правило сохраняет свой priority на всех потомках.
6. Rename каталога меняет одну запись узла.
7. Move каталога меняет один `parent_id`.
8. Правила потомков сохраняются после rename/move.
9. Move немедленно переключает внешнее наследование.
10. Попытка move в собственное поддерево отклоняется.
11. Конкурентное изменение revision обнаруживается.
12. Delete + recreate не получает старые правила.
13. Повтор одного `operation_id` идемпотентен.
14. Падение между provider commit и ACL commit восстанавливается.
15. Адрес в recovery работает fail-closed.
16. Cross-root move не переносит `node_id` или правила автоматически.
17. ACL node не считается доказательством существования VFS-ресурса.
18. Provider не получает прямой ACL repository.
19. Ошибка хранилища не превращается в allow.
20. Кеш можно полностью удалить и восстановить без изменения решений.
21. Property-based последовательности create/rename/move/delete не создают
    циклов, дубликатов активного адреса или наследования через deleted-узел.

## 32. Статус относительно ADR-003

Пока этот ADR имеет статус «Предложено»:

- ADR-003 остаётся принятым целевым решением;
- реализация не должна молча заменять overlay на sparse tree;
- этот документ может использоваться для обсуждения и прототипирования, но не
  как основание считать архитектуру изменённой.

Если предложение будет принято, потребуется отдельно зафиксировать один из
вариантов:

1. ADR-006 полностью заменяет lifecycle storage model ADR-003; либо
2. ADR-003 остаётся общим lifecycle-решением, а ADR-006 заменяет только
   представление URI и механизм move/materialization.

В любом случае durable journal, идемпотентность, recovery, fail-closed и
междоменные границы должны сохраниться.
