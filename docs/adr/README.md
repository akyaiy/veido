# Архитектурные решения

В этой папке находятся самостоятельные ADR проекта. Концепции, обзоры текущей
реализации и планы разработки остаются на уровень выше в `docs/`.

| ADR | Решение | Статус решения | Статус реализации | Примечание |
| --- | --- | --- | --- | --- |
| [ADR-003](ACL_LIFECYCLE_ARCHITECTURE_RU.md) | ACL lifecycle, durable journal, generation, tombstone и overlay | Принято | Не реализовано | В VFSv2 есть только синхронная точка расширения `ResourceLifecycleSink`; journal, generation, tombstone, overlay и recovery отсутствуют |
| [ADR-004](VFS_V2_SHARED_PROVIDER_DECISION_RU.md) | Shared Provider как заменяемая проекция канонических VFS URI | Принято | В процессе | Реализован ACL-free каркас: модель ссылки, собственное SQLite-хранилище без связи с `users`, CRUD записей, `incoming/outgoing`, делегирование через `BoundVFS` и регистрация `shared` в рабочей VFSv2-сборке; `Control` намеренно возвращает unsupported, не реализованы `acl_grant_uri`, ACL и lifecycle |
| [ADR-005](VFS_V2_SCOPE_RESOLUTION_DECISION_RU.md) | Разделение разрешения scope и авторизации входа в него | Принято | В процессе | Текущий resolver всё ещё фильтрует явный scope по владельцу, а VFS Core использует прежнюю проверку входа |
| [ADR-006](ACL_SPARSE_NAMESPACE_TREE_PROPOSAL_RU.md) | Разреженное дерево ACL namespace с отдельными roots и внутренними node ID | Предложено | Не реализовано | Альтернатива части ADR-003: rename/move меняет один узел вместо prefix overlay и массовой материализации; до принятия ADR-003 остаётся действующим решением |
| [ADR-007](VFS_V2_HTML_PROVIDER_DECISION_RU.md) | HTML Provider как метадоменная проекция физических файлов сайта | Предложено | Не реализовано | Зафиксированы metadata/tree, ID-связи model/layout, site-local application templates и static allowlist, прямой VFS-контракт, необязательные hooks, physical content публикаторов и publication manifest; подготовлен [практический план](../VFS_V2_HTML_PROVIDER_IMPLEMENTATION_PLAN_RU.md) |
| [ADR-008](VFS_V2_SERVER_HOOKS_DECISION_RU.md) | Серверные hooks как versioned orchestration-сценарии над actor-bound VFS | Предложено | Не реализовано | Независимые registry/runtime и Hook SDK; HTTP является адаптером runtime, каждый шаг проходит VFS Core и ACL |

Допустимые статусы решения: `Предложено`, `Принято`, `Отклонено`, `Заменено`.

Допустимые статусы реализации: `Не реализовано`, `В процессе`, `Реализовано`,
`Частично устарело`. Статус реализации следует обновлять при изменении рабочего
кода, а не только целевой документации.
