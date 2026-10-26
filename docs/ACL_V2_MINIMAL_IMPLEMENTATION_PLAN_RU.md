# ACLv2: минимальный рабочий план реализации

> Статус: план реализации.
> Основание: [ADR-006: разреженное дерево ACL namespace](adr/ACL_SPARSE_NAMESPACE_TREE_PROPOSAL_RU.md), [ADR-003: ACL lifecycle](adr/ACL_LIFECYCLE_ARCHITECTURE_RU.md), [ADR-005: scope resolution](adr/VFS_V2_SCOPE_RESOLUTION_DECISION_RU.md).
> Граница первого среза: SQLite, VFS-операции, изменения namespace только через VFS Core.

## 1. Результат первого среза

После реализации VFS Core для каждой защищённой операции получает actor,
канонический URI и action, а затем вызывает единственный ACL evaluator.
Без разрешающего решения provider не вызывается.

```text
Auth -> trusted actor
     -> VFS Core resolves canonical URI
     -> ACL Authorizer.Can(actor, action, resource)
     -> owning provider
```

Поддерживаются subject keys:

```text
guest:              guest, all
user:<id>:          user:<id>, group:<name>..., all
service:<name>:     service:<name>
```

Группы являются только частью набора subjects текущего actor. ACL получает их
из trusted membership-хранилища Auth; provider не читает группы и не передаёт
их в запросе.

Каждое правило имеет `priority` от 1 до 100; по умолчанию 50. Среди всех
применимых прямых и recursive правил побеждает максимальный priority. При
равном максимальном priority `deny` побеждает `allow`.

Первый срез намеренно не включает owner fallback, внешние change feeds, cache,
HTTP management API, shared-проекции, journal replay worker и background
pruning. Отсутствие правила означает deny. Owner fallback не выдаёт `r/w/x` на
данные, но lifecycle создаёт protected policy capability владельцу нового
ресурса, чтобы он мог управлять sharing именно этого ресурса.

## 2. Минимальная структура кода

Новый домен ACL остаётся компактным:

```text
internal/acl/v2/
  migrations.go     -- SQLite schema group
  store.go          -- transactions, sparse nodes, rules, lifecycle rows
  authorizer.go     -- actor -> subjects, evaluator, VFS Authorizer adapter
  lifecycle.go      -- ResourceLifecycleSink для VFS create/move/delete

internal/vfs/v2/providers/acl/
  provider.go       -- VFS projection policy/rule resources
  service.go        -- RuleService и command DTO validation
```

Не создавать отдельный сервис групп, ACL HTTP API, общий ACL management service
для других providers или дополнительный RBAC слой. Другой provider работает с
правилами только через `BoundVFS` и ACL Provider.

## 3. Схема SQLite

В migration group ACL создать только таблицы из ADR-006:

- `acl_namespace_roots` — отдельный root для `(provider, connection, scope)`;
- `acl_path_nodes` — разреженное дерево канонических сегментов;
- `acl_rules` — правила на `node_id`;
- `acl_lifecycle_operations` — durable intent и результат VFS lifecycle.

В `acl_rules` обязательны:

```text
rule_id, node_id,
subject_key, action, effect, priority, recursive,
created_by_actor,
manager_subject_key, manager_mode, state,
rule_revision, created_at, updated_at
```

Уникальность правила: `(node_id, subject_key, action)`. Target URI не
сохраняется отдельным ключом правила: он восстанавливается из root и цепочки
ACL nodes. `node_id` остаётся внутренним ключом ACL и не попадает в публичные
URI или контракты providers.

## 4. Проверка доступа

`ACLAuthorizer.Can(ctx, actor, action, ref)` делает следующее:

1. Валидирует `ResourceRef` и action `r/w/x`.
2. Строит subjects actor. Для user одним trusted SQL-запросом читает его
   membership и добавляет `group:<name>`.
3. Находит ACL root и существующие узлы пути.
4. Собирает правила точного узла и recursive-правила предков.
5. Отбрасывает правила не для subjects actor или другого action.
6. Оставляет правила максимального priority.
7. Возвращает deny при наличии deny; иначе allow при наличии allow; иначе deny.

Ошибка БД, некорректный URI или неполные lifecycle-данные не превращаются в
allow. Они останавливают VFS-операцию отдельной ошибкой.

## 5. Подключение к VFS Core

Заменить разрешающие временные authorizer-ы реальным `ACLAuthorizer` в
production composition. В `core.go` применять целевые проверки:

| Операция | ACL-проверка |
| --- | --- |
| `Stat`, чтение, `ReadDir` | `r` цели и `x` нужных предков |
| запись существующего файла | `w` цели и `x` предков |
| create | `x` родителя; `w` и `x` цели |
| delete | `x` родителя; `w` и `x` цели |
| move | для source: `x` старого родителя; `w` и `x` source; для destination: `w` и `x` нового родителя |
| `Control` | `x` ресурса capability |

Вход в scope остаётся отдельным `x` на synthetic scope resource согласно
ADR-005. Нельзя оставлять owner-only фильтрацию scope resolver как замену ACL:
доступ к чужому scope должен решаться ACL после разрешения scope.

## 6. ACL Provider и RuleService

ACL Provider представляет policy target и отдельное rule как виртуальные
ресурсы. Канонический target URI кодируется обратимо, например:

```text
acl@acl[system]:///policies/<base64url(canonical-target-uri)>
acl@acl[system]:///rules/<rule-id>
```

RuleService предоставляет только:

```text
Create(target, subject, action, effect, priority, recursive)
Get(ruleID)
List(target)
Update(ruleID, effect, priority, recursive)
Delete(ruleID)
SetManager(ruleID, manager, mode, state)
```

Actor всегда извлекается из VFS request context. `target`, `subject` и `action`
не меняются через update: их изменение выполняется как delete + create.

### 6.1. Динамическое управление правилом

При `Create` RuleService проверяет `x` на policy-resource target. Затем он
записывает actor в `created_by_actor` и устанавливает
`manager_subject_key = user:<actor-id>`, `manager_mode = full`, `state = active`.

| Операция | Кто может выполнить |
| --- | --- |
| создать правило | resource manager или policy-admin с `x` policy-resource target |
| посмотреть policy | resource manager или policy-admin с `r` policy-resource target |
| прочитать правило | active manager с сохраняющимся `x` policy target либо policy-admin |
| изменить/удалить правило | active manager с сохраняющимся `x` policy target либо policy-admin |
| передать manager, сменить mode, lock/unlock | только policy-admin |

Manager может менять лишь `effect`, `priority`, `recursive`. Он не может
переадресовать правило, сменить subject/action, назначить себя manager другого
правила или снять lock. Если rule заблокирован, manager передан другому subject
или actor потерял `x` policy target, прежний manager немедленно теряет
возможность изменения.

`manager_mode = narrow_only` разрешает только сужение доступа: выключить
recursive, понизить priority allow, заменить allow на deny или удалить allow.
Расширение доступа возвращает permission denied. Policy-admin не ограничен этим
режимом.

### 6.2. Policy capability владельца и корень доверия

После успешного VFS create lifecycle выдаёт actor-создателю protected `r/x` на
policy-resource нового target. Поэтому Alice может создать sharing rule для
своего файла, но не для файла Bob. Для каталога lifecycle может явно выдать
recursive policy capability на потомков.

Эта capability не является owner fallback на чтение или изменение данных. Она
существует только для policy-resource и создаётся, переносится или отзывается
lifecycle-операцией при create/move/delete/смене владельца. Обычный
`Create/Update/Delete` ACL Provider не может изменить такой grant.

Policy-admin получает override `r/x` на policy-resource отдельным protected
control-plane grant. Bootstrap создаёт только первый такой grant, а не
подменяет ежедневное управление ресурсами пользователей. Правила, выдающие
`x` на ACL policy namespace, меняет лишь bootstrap/maintenance-операция ACL
либо lifecycle владельца конкретного ресурса. Это исключение разрывает цикл и
не даёт Auth или другим providers права авторизовывать пользовательские
VFS-ресурсы.

## 7. Lifecycle первого среза

`lifecycle.go` реализует существующий `ResourceLifecycleSink` и записывает
durable lifecycle operation. Для первого среза поддерживаются только операции,
которые VFS Core уже выполнил над SQLite/local namespace:

- create создаёт protected policy capability для actor-создателя; data-rule
  nodes создаются только при первом обычном grant;
- delete помечает соответствующее ACL-поддерево tombstone и снимает правила с
  удалённого logical URI;
- rename меняет segment одного node;
- move в том же root меняет `parent_id` одного node;
- move между root не переносит rules автоматически;
- незавершённая lifecycle operation приводит к fail-closed для затронутого
  диапазона до ручной или стартовой reconciliation.

Не реализовывать prefix overlay, materializer или compaction: sparse tree
устраняет их для штатного move. Не обещать согласованность внешних изменений,
которые произошли вне VFS и не имеют change feed.

## 8. Bootstrap и composition

Добавить одну локальную maintenance-команду для initial ACL bootstrap. Она не
является HTTP endpoint и не использует actor клиента. Команда принимает явно
указанный trusted admin subject и создаёт первый protected control-plane override.

Production composition:

1. применяет ACL migration group;
2. создаёт ACL store и authorizer;
3. передаёт authorizer и ACL lifecycle sink в VFS Core;
4. регистрирует ACL Provider как выбранный provider module;
5. не подключает legacy `internal/acl` string-permission evaluator к VFSv2.

## 9. Порядок работы

### Шаг 1 — schema и evaluator

Добавить migration, store, subject expansion, priority evaluator и unit-тесты.
Пока authorizer можно подключить к isolated VFS harness. Результат шага: реальный
deny-by-default без ACL Provider management UI.

### Шаг 2 — VFS Core

Внести action/parent/traverse проверки и подключить authorizer в composition.
Результат шага: ни HTTP, ни provider не обходят ACL.

### Шаг 3 — ACL Provider

Добавить policy/rule virtual resources, RuleService, manager/mode/lock и
bootstrap command. Результат шага: правила управляются через VFS с исходным
actor, без прямого доступа других providers к ACL store.

### Шаг 4 — lifecycle

Подключить sparse nodes к create/delete/rename/move, durable operation и
fail-closed recovery. Результат шага: move не переписывает правила потомков и
не переносит старые права при delete + recreate.

## 10. Минимальные тесты готовности

1. Guest получает только `guest` и `all`; user — user, all и свои groups.
2. Recursive rule действует на потомка, но нерекурсивное правило предка — нет.
3. Priority 80 побеждает priority 60 независимо от глубины URI.
4. При равном priority deny побеждает allow, в том числе между user и group.
5. После ACL deny provider не вызывается.
6. Создатель active rule может изменить только разрешённые mutable fields при
   сохраняющемся `x` policy target.
7. Locked rule, передача manager или отзыв policy capability запрещают прежнему
   manager update/delete.
8. `narrow_only` не может расширить доступ.
9. Обычная команда ACL Provider не изменяет protected control plane.
10. Rename/move сохраняет node ID и правила потомков; delete + recreate не
    наследует старые правила.
11. Ошибка store или незавершённый lifecycle range возвращает fail-closed error.
12. Создатель файла может создать sharing rule для своего URI, но не может
    создать правило для чужого URI без policy capability.

## 11. Явно отложено

- owner fallback;
- внешние providers и change feeds;
- cache решений и invalidation;
- HTTP/GUI для ACL management;
- история правил как отдельная audit-проекция;
- background pruning и recovery worker;
- shared provider, использующий ACL grants;
- миграция legacy string permissions в resource ACL.

Каждый отложенный пункт добавляется только отдельным ADR или изменением этого
плана с указанием, как он сохраняет описанные здесь границы Auth, ACL и VFS
Core.
