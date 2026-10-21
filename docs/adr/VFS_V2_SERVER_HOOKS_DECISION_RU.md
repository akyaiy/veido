# ADR-008: Серверные хуки VFSv2

> Статус: предложенное архитектурное решение, не описание готовой реализации.  
> Статус реализации на 20 октября 2026 года: в процессе. Реализован
> transport-neutral фундамент `pkg/vfs/hooks`: versioned definitions, engine
> contract и доверенный native engine, immutable после compile/freeze definitions,
> typed Hook SDK и Runtime с actor-bound VFS,
> timeout/input/output/step limits, structured errors и in-memory
> idempotency store для коротких синхронных запусков. Контракт и тесты не
> зависят от HTTP или provider internals. Реализован прикладной read-only
> `get-static` получает site URI и template key в typed input, а hook выбирает последнюю
> установленную immutable версию package,
> manifest и asset читаются через actor-bound VFS, фактические size/SHA-256
> сверяются с manifest, а результат содержит asset bytes и HTTP metadata.
> `get-page` читает actor-filtered `tree.json`, разрешает точную
> цепочку page slug для одно- или многосегментного browser path и возвращает
> тот же проверенный application entrypoint только для существующего маршрута.
> Размер одного ответа ограничен размером template asset (4 MiB), JSON output
> допускает Base64 overhead и сохраняется в Hook Store при идемпотентном запуске.
> Provider SDK поддерживает `Module`: hook definitions регистрируются вместе с
> типом provider. HTML module объявляет `get-static` и `get-page`; site adapter
> передаёт site URI и template key в typed input и вызывает обычный `Run`.
> Auth-композиция также регистрирует native hooks `auth.register`,
> `auth.login`, `auth.refresh`, `auth.logout`, `auth.change-password` и
> `auth.revoke-sessions` как глобальные команды без target resource.
> HTTP adapter поддерживает типизированный transport bridge: refresh credential
> передаётся Auth handlers через приватный trusted context и не попадает в
> пользовательский input/output или provider context.
> Реализован HTTP adapter `POST /api/v2/vfs/hooks/{hook-key}/run`: он принимает
> strict `input`, version и `Idempotency-Key`, получает actor только из trusted
> resolver и вызывает `Run`.
> Ещё отсутствуют durable Execution Store, step journal/resume/compensation, sandboxed script
> engine, hook-level policy и metrics/tracing.
> Дата решения: 26 сентября 2026 года.  
> Связанные документы: [карта HTTP API VFSv2](../VFS_V2_HTTP_ENDPOINT_MAP_RU.md), [архитектура HTTP-адаптера](../VFS_V2_HTTP_ADAPTER_ARCHITECTURE_RU.md), [ACL lifecycle](ACL_LIFECYCLE_ARCHITECTURE_RU.md).

## 1. Контекст

Некоторые пользовательские действия состоят не из одной VFS-операции, а из
последовательности чтений, записей и доменных команд. Например, создание
пользователя может требовать создать несколько ресурсов, подготовить scope,
создать подключения и записать начальные настройки.

Клиент способен выполнить эти запросы самостоятельно, но тогда он должен знать
порядок шагов, повторять серверную логику, обрабатывать промежуточные состояния
и оставаться открытым до завершения всей операции. Разные клиенты начинают
реализовывать один сценарий по-разному.

Нужен общий механизм, позволяющий сохранить такой сценарий на сервере и вызвать
его как одну прикладную операцию. Этот механизм относится к VFS в целом и не
принадлежит конкретному provider-у.

## 2. Решение

В VFS application-слой добавляется независимый механизм **серверных хуков**.
Registry и runtime можно собрать и использовать без HTTP-сервера. HTTP-адаптер
получает готовый runtime как зависимость и предоставляет к нему внешний
интерфейс.

Хук — сохранённый на сервере исполняемый сценарий с именованным входом и
результатом. Во время выполнения хук вызывает публичные операции VFSv2:

```text
Stat
ReadDir
OpenFile / Read / Write
Mkdir
Move
Delete
Control
```

Базовый путь выполнения:

```text
HTTP request
  -> Auth устанавливает actor
  -> Hook HTTP adapter вызывает Hook Runtime
  -> Hook Runtime находит definition в Hook Registry
  -> Hook Runtime исполняет script
  -> каждый шаг вызывает VFSFrontend с тем же actor
  -> VFS Core разрешает URI и проверяет ACL
  -> provider выполняет разрешённую операцию
  -> Hook Runtime формирует результат
  -> Hook HTTP adapter кодирует результат
  -> HTTP response
```

Registry и runtime не зависят от способа вызова. Тот же runtime может быть
использован HTTP-адаптером, CLI, worker-ом или тестовым окружением. Обычный VFS
HTTP endpoint продолжает соответствовать одной операции `VFSFrontend`, а hook
endpoint только преобразует HTTP-запрос в вызов runtime.

## 3. Что даёт хук

Хук является серверным макросом над VFS. Он позволяет:

- скрыть от клиента техническую последовательность запросов;
- повторно использовать один сценарий из разных frontend-ов;
- централизованно проверять входные данные и формировать результат;
- выполнять следующий шаг без дополнительного сетевого round trip;
- хранить состояние длительного или повторяемого сценария на сервере;
- реализовать идемпотентный повтор после временного сбоя.

Хук не становится владельцем ресурсов, которых он касается. Источником истины
остаётся provider, которому принадлежит соответствующий канонический VFS URI.

## 4. Два равноправных способа изменения ресурсов

Клиент может выполнить элементарные операции напрямую:

```text
client
  -> POST /api/v2/vfs/directory
  -> PUT  /api/v2/vfs/file
  -> POST /api/v2/vfs/control
```

Либо клиент может вызвать хук, который выполнит те же публичные VFS-операции:

```text
client
  -> POST /api/v2/vfs/hooks/create-user/run
       -> VFS Mkdir
       -> VFS Control
       -> VFS Write
       -> VFS Control
```

Оба пути проходят через `VFSFrontend`, VFS Core и ACL. Хук не получает прямой
доступ к таблицам, repositories, services или backend-клиентам provider-ов.

Под «прямым изменением метаданных» понимается запись или `Control` по их
каноническому VFS URI. Прямое изменение таблицы provider-а из Hook Runtime
запрещено.

## 5. Независимые компоненты

Механизм состоит из пяти частей:

| Компонент | Ответственность |
| --- | --- |
| Hook SDK | Описывает definition, упрощённую регистрацию, ошибки и тестовые средства |
| Hook Registry | Регистрирует definitions, версии и активную версию каждого hook |
| Hook Runtime | Разрешает definition, валидирует вызов и управляет выполнением |
| Script Engine | Загружает и исполняет script с ограниченным actor-bound VFS API |
| Hook Adapter | Преобразует внешний вызов в обращение к runtime; HTTP является одним из адаптеров |

Registry, runtime, engine contracts и SDK не импортируют HTTP-типы и не знают о
routes, headers, cookies или status codes. HTTP package зависит от публичного
интерфейса runtime, но runtime не зависит от HTTP package.

Компоненты hooks не добавляются в VFS Core и не становятся новым обязательным
методом каждого provider-а. Runtime зависит только от публичного
`VFSFrontend`, registry, script engines, execution store и нейтральной
инфраструктуры: clock, logger и tracer.

VFS Core ничего не знает о сценарии целиком. Для него каждый шаг остаётся
обычным независимым вызовом от конкретного actor.

## 6. Определение хука

Логическое определение содержит как минимум:

```text
key             стабильное имя хука
version         версия реализации
engine          тип движка исполнения
script          серверный исполняемый сценарий
input_schema    допустимая структура входа
output_schema   структура успешного результата
limits          timeout, число шагов и предельный размер данных
enabled         доступность версии для новых запусков
```

Точный язык script и формат хранения являются деталями Script Engine.
Контракт VFS-хуков не должен зависеть от конкретного языка. Script получает
только ограниченный runtime API, request context, actor-bound VFS и
валидированный input. Произвольный доступ к SQL, файловой системе процесса,
сети и внутренним Go-сервисам provider-ов в контракт не входит.

Для MVP definitions устанавливаются доверенным серверным способом: из
конфигурации, migration, deployment bundle или административного ресурса с
отдельной авторизацией. Публичная загрузка произвольного исполняемого кода
пользователем в MVP не входит.

## 7. Регистрация через Hook SDK

Hook SDK предоставляет простой способ собрать definition и добавить его в
registry. Разработчик задаёт:

- стабильный ключ и версию;
- тип script engine;
- script или ссылку на поставляемый сервером script;
- схемы input и output либо типы, из которых SDK может их построить;
- timeout, максимальное число шагов и другие ограничения;
- признак активной версии.

Для hooks, принадлежащих provider-модулю, ожидаемый сценарий интеграции выглядит так:

```text
создать registry
  -> providersdk.RegisterModule(provider catalog, hook registry, module)
  -> зарегистрировать provider factory и hook definitions модуля
  -> проверить и заморозить hook definitions
  -> создать runtime из registry, VFSFrontend, engines и execution store
  -> передать runtime нужным adapters
```

Каждый provider-модуль экспортирует provider definition и hook definitions
через Provider SDK. Модулю не
передаются HTTP router или handler, и он не создаёт собственный runtime. SDK
скрывает служебную сборку definition, но не скрывает ключ, версию, схемы и
лимиты публичного контракта.

Ошибки регистрации выявляются при сборке приложения:

- повтор `key + version`;
- отсутствие указанного script engine;
- некорректные input/output schemas;
- script не загружается или не компилируется;
- активными объявлены несколько несовместимых версий.

Production hook definitions после сборки замораживаются. Удалённое добавление
definitions для MVP не поддерживается.

## 8. Контракт Hook Runtime

Runtime предоставляет transport-neutral операцию:

```text
Run(context, actor, hook key, input, options) -> result или typed error
```

`options` содержит только независимые от транспорта параметры: запрошенную
версию, idempotency key и политику deadline. HTTP headers и status codes в
контракт runtime не входят.

Перед исполнением runtime:

1. находит definition и фиксирует его версию;
2. валидирует input;
3. проверяет лимиты и идемпотентность;
4. создаёт execution context;
5. привязывает `VFSFrontend` к переданному actor;
6. запускает соответствующий script engine;
7. валидирует output и сохраняет результат выполнения.

Script получает actor-bound VFS, в котором actor уже зафиксирован. Операции
script принимают URI и данные, но не принимают actor. Поэтому отдельный шаг не
может случайно выбрать другого пользователя.

## 9. HTTP-адаптер Runtime

Предлагаемый HTTP-маршрут:

```http
POST /api/v2/vfs/hooks/{hook-key}/run
Content-Type: application/json
Idempotency-Key: 8d47a220-3c2d-47fd-b3e5-f85c0f8672b1

{
  "input": {
	"site_uri": "html@site[site-acme]:///",
	"template_key": "default-spa",
	"path": "index.html"
  }
}
```

HTTP-адаптер выполняет только транспортную работу:

1. получает actor из доверенного auth context;
2. читает `hook-key`, input, version и `Idempotency-Key`;
3. вызывает `Run`;
4. преобразует result или типизированную ошибку runtime в HTTP-ответ.

Actor не передаётся в path, query, headers сценария или JSON. HTTP-адаптер не
разрешает definition, не запускает script engine и не выполняет VFS-шаги сам.
Все URI находятся в typed input конкретного hook; каждый VFS-шаг повторно
проходит VFS Core и ACL с тем же actor. Hook не прикреплён к одному ресурсу и
может обращаться к ресурсам разных provider-ов.

Успешный результат:

```json
{
  "hook": "create-user",
  "version": 3,
  "executionId": "hook-exec-018f",
  "status": "completed",
  "output": {
    "userUri": "auth@users[system]:///users/alice"
  }
}
```

Для короткого синхронного хука HTTP-ответ возвращается после завершения. Для
длительных hooks тот же доменный контракт может получить асинхронный режим с
ресурсом execution, но он не требуется для первого MVP.

## 10. Actor и ACL

Все VFS-вызовы одного запуска выполняются от actor, переданного вызывающим
адаптером. HTTP-адаптер берёт его только из исходного auth context:

```text
adapter actor == hook execution actor == actor каждого VFS шага
```

Запрещено:

- принимать actor как часть hook input;
- подменять actor владельцем ресурса или service principal;
- считать успешный запуск хука разрешением на все его будущие шаги;
- кэшировать ACL `allow` между разными URI или операциями;
- продолжать шаг после ACL `deny`.

VFS Core проверяет ACL отдельно для каждого target URI. Provider после этой
проверки сохраняет право отклонить операцию по своим доменным ограничениям или
из-за отказа backend-а.

Право вызвать hook и право выполнить затрагиваемые им операции являются разными
проверками. Вызывающий adapter или runtime policy может ограничивать доступность
самого hook, но это не заменяет ACL-проверки его VFS-шагов.

## 11. Вход, выход и ошибки

Input валидируется до начала выполнения по версии схемы конкретного hook.
Output формируется явно сценарием и также проверяется перед ответом. Внешний
контракт не должен зависеть от внутренних структур runtime-а.

Ошибка содержит как минимум:

```json
{
  "error": {
    "code": "hook_step_failed",
    "message": "cannot complete create-user",
    "executionId": "hook-exec-018f",
    "failedStep": "create-default-connection",
    "cause": "permission_denied",
    "retryable": false
  }
}
```

Клиент принимает решения по стабильным `code`, `cause` и `retryable`, а не по
тексту `message`. Ответ не должен раскрывать script, секреты, SQL-ошибки или
содержимое защищённых ресурсов.

## 12. Атомарность

Запуск хука не создаёт общую транзакцию поверх нескольких VFS-вызовов.

Если сценарий сделал три успешных шага, а четвёртый завершился ошибкой, первые
три шага не откатываются автоматически. Особенно это важно для операций над
разными provider-ами: ради атомарности runtime не должен обращаться к их
таблицам напрямую или объединять чужие stores одной SQL-транзакцией.

Если несколько изменений принадлежат одному provider-у и должны примениться
атомарно, этот provider предоставляет одну пакетную доменную команду:

```text
hook
  -> VFS Control(target URI, "apply-batch", payload)
  -> provider проверяет весь payload
  -> provider применяет изменения своей локальной транзакцией
```

Хук может подготовить payload и вызвать такую команду, но граница атомарности
остаётся внутри provider-владельца.

Межпровайдерный сценарий использует состояния выполнения, идемпотентные шаги,
повтор, outbox и reconciliation. Если обратное действие безопасно и является
частью доменного сценария, hook может выполнить явную компенсацию. Компенсация
не должна выдаваться за транзакционный rollback.

## 13. Идемпотентность и повтор

Клиент передаёт `Idempotency-Key`. Execution Store связывает как минимум:

```text
actor
hook key
hook version
idempotency key
hash нормализованного input
status
output или error
```

Повтор с той же комбинацией actor, hook и key:

- с тем же input возвращает существующий результат или продолжает допустимое
  незавершённое выполнение;
- с другим input возвращает `idempotency_conflict`;
- не начинает второй независимый запуск незаметно для клиента.

Каждый mutating step также должен иметь стабильный operation ID, выведенный из
execution ID и имени шага. Это позволяет безопасно продолжить сценарий после
сбоя ответа между runtime и VFS.

## 14. Состояние выполнения

Минимальные состояния:

```text
pending -> running -> completed
                   -> failed
                   -> compensating -> compensated
                                  -> compensation_failed
```

Для коротких hooks допускается хранить только итог идемпотентного вызова. Для
сценария с несколькими изменяющими шагами состояние каждого завершённого шага
должно сохраняться до перехода к следующему шагу. После перезапуска процесс не
должен угадывать, какая операция уже была выполнена.

## 15. Версионирование

Новый запуск использует активную версию hook. Созданное execution фиксирует
конкретную версию и при повторе не переключается на новую реализацию.

Изменение input/output semantics требует новой версии. Старую версию можно
отключить для новых запусков только после того, как незавершённые executions
либо завершены ею, либо явно мигрированы поддерживаемой процедурой.

## 16. Ограничения выполнения

Runtime совместно со Script Engine обязан ограничивать:

- общее время запуска;
- количество VFS-шагов;
- глубину и число повторов;
- размер input, output и промежуточных значений;
- объём одновременно читаемых данных;
- параллелизм одного actor и одного hook;
- доступный script API.

Отмена context вызывающего адаптера отменяет синхронное выполнение. Для HTTP
это означает отмену при разрыве request. Если в будущем появятся durable
asynchronous hooks, их продолжение после отмены context должно быть явной
частью async-контракта, а не detached goroutine.

## 17. Наблюдаемость

Для запуска записываются:

```text
execution ID
hook key и version
actor key
status
начало и длительность
имя текущего или неуспешного шага
код результата VFS
```

Input, output, control payload и содержимое файлов по умолчанию в лог не
попадают. Tracing связывает вызов runtime со всеми дочерними VFS-вызовами; HTTP
trace при наличии становится родительским trace такого выполнения.

## 18. Пример: создание пользователя

```text
hook create-user(input)
  1. Control(auth user collection, "create", input.identity)
  2. Control(scope collection, "create-user-scope", input.scope)
  3. Control(connection collection, "create", input.connections[0])
  4. Control(connection collection, "create", input.connections[1])
  5. Write(settings URI, input.settings)
  6. Return created canonical URIs
```

Каждый target адресуется каноническим URI и повторно проходит ACL. Если шаги
принадлежат разным provider-ам, выполнение использует workflow-состояние и
идемпотентность, а не общую транзакцию.

## 19. Отклонённые варианты

### 19.1. Выполнять составной сценарий только на frontend

Вариант оставляет порядок шагов и восстановление после сбоя каждому клиенту.
Прямые вызовы остаются допустимыми, но общие сценарии хранятся на сервере.

### 19.2. Дать hook прямой доступ к stores provider-ов

Вариант нарушает доменные границы, обходит VFS Core и ACL и связывает сценарий
с внутренней схемой хранения provider-а.

### 19.3. Добавить hooks в интерфейс каждого provider-а

Вариант делает общий orchestration обязательной частью заменяемых адаптеров.
Provider реализует только собственные ресурсы и доменные команды.

### 19.4. Считать весь hook одной транзакцией

Вариант создаёт ложную гарантию для межпровайдерных операций. Атомарность
возможна только внутри одной доменной команды provider-владельца.

### 19.5. Поместить registry и runtime внутрь HTTP package

Вариант связывает регистрацию и выполнение сценариев с одним transport-ом,
затрудняет модульные тесты и повторное использование из CLI или worker-а.
HTTP должен адаптировать независимый runtime, а не владеть им.

## 20. План реализации MVP

1. Определить transport-neutral контракты Registry, Runtime, Script Engine,
   Execution Store, Definition, Run Options и Result.
2. Реализовать Hook SDK с упрощённой регистрацией и тестовыми средствами.
3. Реализовать in-memory registry, его валидацию и замораживание.
4. Добавить доверенную загрузку versioned hook definitions при старте сервера.
5. Предоставить script engine только actor-bound VFS API и безопасные helper-ы.
6. Реализовать runtime независимо от HTTP и покрыть его контрактными тестами.
7. Добавить HTTP-адаптер с `POST /api/v2/vfs/hooks/{hook-key}/run`. Реализовано
   для direct и resource-bound запусков.
8. Добавить input/output validation, limits и нормализованную карту ошибок.
9. Реализовать `Idempotency-Key` и сохранение результата короткого запуска.
10. Добавить execution/step journal для многошаговых mutating hooks.
11. Добавить structured logs, metrics и tracing дочерних VFS-вызовов.
12. Покрыть тестами сохранение actor, повторную ACL-проверку, запрет прямых
   provider dependencies, частичный сбой и идемпотентный повтор.

В MVP не входят публичная загрузка произвольных scripts, расписание запуска,
триггеры от событий, долгоживущие фоновые executions и распределённые
транзакции.

## 21. Критерии приёмки

1. Registry и runtime собираются и тестируются без HTTP package.
2. Модуль регистрирует hook одной функцией SDK без доступа к HTTP router.
3. Duplicate definition и невалидный script обнаруживаются при сборке registry.
4. Один сохранённый hook принимает input и возвращает документированный output.
5. Hook выполняет не менее двух VFS-операций через `VFSFrontend`.
6. Каждый шаг выполняется с actor, переданным вызывающим адаптером.
7. ACL применяется VFS Core отдельно к каждому target URI.
8. Runtime не импортирует provider services и не читает их stores напрямую.
9. Повтор с тем же `Idempotency-Key` и input не дублирует изменения.
10. Повтор того же key с другим input возвращает конфликт.
11. Частичный сбой отражён в execution state и не объявляется rollback-ом.
12. Timeout и отмена context останавливают синхронное выполнение.
13. HTTP-адаптер ограничивается вызовом runtime и преобразованием результата.
14. Обычные VFS endpoints продолжают вызывать ровно одну операцию
    `VFSFrontend`.
