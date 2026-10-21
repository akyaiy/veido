# ADR-010: Централизованные versioned SQLite migrations

> Статус решения: принято.  
> Статус реализации: реализовано для pre-prod schema groups.  
> Дата решения: 21 октября 2026 года.  
> Связанные документы: [ADR-009](PREPROD_SERVER_RUNTIME_DECISION_RU.md),
> [целевая Auth session schema](../AUTH_SESSION_SCHEMA_PLAN_RU.md).

## Контекст

Прежний `sqliteDB.InitDB` одновременно открывал файл, создавал таблицы разных
доменов, менял данные VFS и завершал процесс через `log.Fatal`/`panic`. HTML,
Local и Shared дополнительно создавали свои схемы при случайном запуске demo.
Невозможно было доказать, что чистая и существующая базы подготовлены одинаково.

## Решение

SQLite open и schema migration разделены:

- `sqliteDB.Open` создаёт каталог/файл с ограниченными permissions, настраивает
  foreign keys для каждого pooled connection, busy timeout и WAL, затем делает
  startup ping и проверяет pragmas;
- нейтральный `internal/database/migrate` выполняет переданные groups строго в
  заданном порядке;
- каждая migration и запись её версии фиксируются одной транзакцией;
- история хранится в `schema_migrations(group_name, version, name)`;
- применённая неизвестная версия, изменившееся имя версии или разрыв истории
  останавливают startup;
- определения migrations находятся у владельцев схемы;
- `internal/database/schema` знает только группы системного ядра, а composition
  root передаёт migrations тех provider modules, которые он действительно
  выбрал для конкретного binary.

Системный порядок:

```text
core/database -> auth -> vfs/core -> <groups выбранных provider modules>
```

Основная pre-prod композиция после системных групп передаёт `provider/local` и
`provider/html`. Database package не импортирует, не регистрирует и даже не
знает ключи providers. Shared экспортирует собственную `provider/shared` group,
но её импортирует только отдельная demo/plugin-композиция, которая одновременно
подключает сам Shared Provider. В основной server и migration CLI этой
зависимости нет.

Миграции создают и преобразуют только schema/data, необходимые для upgrade. Они
не создают users, scopes, connections, provider seed или demo content.

Для существующей HTML-схемы её прежняя `html_schema_migrations` читается как
compatibility marker и заполняется при новом развёртывании, пока все установки
не будут переведены на общий runner. Авторитетной междоменной историей является
`schema_migrations`.

## CLI и startup

`go run ./cmd/migrate -db <path>` полностью подготавливает чистую БД основной
pre-prod композиции без запуска HTTP. Миграции внешнего provider выполняет его
собственный composition root/installer, передавая group тому же runner.
`cmd/server` и demo-команды останавливаются при ошибке открытия или migration до
создания HTTP listener.

## Последствия и ограничения

- Каждая следующая schema change добавляет новую неизменяемую версию в group;
  уже выпущенные version/name/Up не редактируются.
- Auth runtime переведён на `sessions` в ADR-011; удаление сохранённых legacy
  stores по-прежнему отложено и не входит в этот ADR.
- Legacy `internal/vfs.Repository.AutoMigrate` остаётся только для legacy tests и
  не входит в pre-prod registry.
- Runner сериализуется механизмами SQLite; отдельный distributed migration lock
  не вводится для single-node pre-prod deployment.
