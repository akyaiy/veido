# Frontend guide: сайт и HTML provider

Этот документ — точка входа для frontend-разработчика. Задача frontend —
написать интерфейс поверх уже существующего HTTP API. Не нужно подключаться к
SQLite, вызывать Go-код или знать внутренности провайдеров: всё взаимодействие
идёт через `fetch`/REST и канонические URI.

> Frontend-разработчик сам выполняет описанные ниже команды в терминале. Они
> нужны не только первому администратору: без них нельзя локально запустить
> сервер, получить JWT для ручной проверки API или выкатить изменённый
> frontend-шаблон.

## 0. Шпаргалка: ежедневный цикл frontend-разработчика

В первом терминале, из корня репозитория:

```bash
go run ./cmd/server
```

Во втором терминале:

```bash
# после первого bootstrap: получить JWT для CLI и ручных REST-проверок
scripts/login.sh --username admin
source .site-session

# после любого изменения data/HTML/frontend: собрать и выкатить новую версию
scripts/install-template.sh

# открыть http://localhost:8080/ и сделать Ctrl+Shift+R
```

Для первой настройки проекта вместо простого запуска сначала выполни весь
раздел 3. Для остановки сервера — `Ctrl+C` в первом терминале. `.site-session`
локален, в Git его не добавлять.

## 1. Что здесь есть

Сервер одновременно отдаёт две вещи:

| Что | Адрес | Для чего |
| --- | --- | --- |
| Публичный сайт | `GET /`, `GET /about`, … | Просмотр страниц посетителем. |
| Статические файлы текущего шаблона | `GET /_static/...` | JS, CSS, изображения frontend-приложения. |
| Универсальный REST API | `/api/v2/vfs/...` | Чтение, запись, создание файлов и команды провайдеров. |
| Hook API | `/api/v2/vfs/hooks/<hook>/run` | Логин, регистрация, обновление токена и специальные операции. |

`/api` не является страницей сайта. Маршруты сайта обрабатываются только
после API: `GET /` отдаёт entrypoint шаблона, `GET /_static/*` — asset, а
остальные `GET /*` пытаются найти опубликованную HTML-страницу.

## 2. Главная идея без терминов VFS

Представь API как несколько файловых дисков, доступных по HTTP. У каждого
ресурса есть полный адрес — **канонический VFS URI**:

```
provider@connection[scope]:///path
```

Примеры:

```
html@site[96f0bf-site]:///                 # сайт и дерево страниц
html@site[96f0bf-site]:///pages/demo       # запись страницы demo
local@publisher[96f0bf-site]:///pages/demo # файлы bundle страницы
```

- `provider` определяет тип ресурса (`html`, `local`, `scopes` и т. п.).
- `connection` — конкретное подключение этого провайдера.
- `scope` — граница конкретного сайта. Сайт **не** находится в `system` scope.
- `path` — путь внутри ресурса.

URI передаётся целиком в query-параметре `uri`; при ручном `fetch` его надо
передавать через `encodeURIComponent`. Не заменяй URI локальными ID из JSON:
например, `page.id` нужен HTML provider для дерева, но не является глобальным
идентификатором страницы.

## 3. Быстрый запуск с чистой рабочей копии

Требования: Go, `curl`, `jq`, свободный порт 8080.

### Первый запуск владельца сайта

1. Создай конфигурацию и задай непустой секрет:

   ```bash
   cp .env.example .env
   # открыть .env и задать JWT_SECRET=<длинная случайная строка>
   ```

2. Примени миграции:

   ```bash
   scripts/migrate.sh
   ```

3. В первом терминале запусти сервер:

   ```bash
   go run ./cmd/server
   ```

4. Во втором терминале один раз создай пользователя, site scope, подключения,
   publisher и начальную страницу:

   ```bash
   scripts/bootstrap-site.sh --username admin --password 'admin123'
   ```

   Скрипт сначала пытается войти, а если такого пользователя нет —
   регистрирует его. Он обновляет `SITE_URI` в `.env` на URI созданного сайта.
   Повторный полный bootstrap существующего scope намеренно запрещён: для
   шаблона используй `scripts/install-template.sh`, для страниц —
   `scripts/add-page.sh`.

5. Перезапусти сервер — это обязательно после изменения `.env`:

   ```bash
   # остановить прежний процесс Ctrl+C
   go run ./cmd/server
   ```

6. Открой [http://localhost:8080/](http://localhost:8080/).

`SITE_URI` в `.env.example` — лишь валидный стартовый адрес. Реальный URI
возвращает bootstrap и он отличается для каждого созданного сайта.

### Повседневные команды

```bash
# Войти и сохранить access JWT только в локальном .site-session (chmod 600)
scripts/login.sh --username admin
source .site-session

# Выйти: отозвать сессию на сервере и удалить .site-session
scripts/logout.sh

# Установить новую immutable версию frontend-шаблона из data/HTML/frontend
scripts/install-template.sh

# Создать страницу из трёх файлов content.md, style.css, script.js
SITE_ACCESS_TOKEN="$SITE_ACCESS_TOKEN" scripts/add-page.sh \
  --key about --slug about --title 'О нас' \
  --source-dir ./site-content/publisher/pages/about

# Загрузить Block через тот же public VFS HTTP API
SITE_ACCESS_TOKEN="$SITE_ACCESS_TOKEN" scripts/add-block.sh \
  --key promo-card --name 'Promo card' --type ui-component \
  --source-dir ./site-content/publisher/blocks/promo-card \
  --folder-key components --folder-name 'Components'

# Обновить только physical bundle существующей Page
SITE_ACCESS_TOKEN="$SITE_ACCESS_TOKEN" scripts/update-page-bundle.sh \
  --key home --source-dir ./site-content/publisher/pages/home
```

`scripts/add-page.sh` загружает bundle в подключение
`local@publisher[<scope>]:///pages/<key>/`, затем создаёт метаданные страницы
в HTML provider. Он не копирует файлы в `data/HTML/frontend`.

## 4. Где лежит frontend и как выкатывать изменения

Исходники application template сейчас находятся в:

```
data/HTML/frontend/
```

Это именно shell/admin-приложение: `index.html`, общий CSS и JavaScript,
включая готовый HTTP-клиент `js/vfsv2.js`. Исходники отдельных страниц сайта
хранятся отдельно — в publisher bundle (`content.md`, `style.css`,
`script.js`).

Пакеты шаблона намеренно неизменяемы. После изменения frontend-исходников:

```bash
scripts/login.sh --username admin
scripts/install-template.sh
```

Скрипт берёт source из `site.bootstrap.json` →
`site.template_source` (сейчас `./data/HTML/frontend`), сам выбирает следующую
числовую версию `default-spa` и устанавливает её. Затем сделай hard reload
(`Ctrl+Shift+R`). Менять `template_version` вручную для обычной разработки не
нужно.

Установка нового шаблона не меняет страницы, их bundle и метаданные. Она
только меняет статику, которую сервер отдаёт по `/_static/` и для `/`.

## 5. Авторизация: что frontend обязан сделать

### Access JWT — единственный токен для доступа к API

После успешного `auth.login`/`auth.register` сервер возвращает access JWT в
`output.access_token`. Именно его надо добавлять к защищённым VFS-вызовам:

```http
Authorization: Bearer <access JWT>
```

Refresh credential сервер кладёт в HttpOnly cookie. JavaScript не может и не
должен его читать. Наличие cookie **не** авторизует обычные VFS-запросы;
cookie используется только hook `auth.refresh`. Храни access JWT только в
памяти приложения, а не в `localStorage`.

### Контракт hooks

Все hooks вызываются одинаково:

```http
POST /api/v2/vfs/hooks/<hook-key>/run
Content-Type: application/json

{"input": { ... }}
```

Успешный ответ содержит `hook`, `version`, `execution_id`, `status` и
`output`. Ошибка имеет вид:

```json
{
  "error": {
    "code": "hook_step_failed",
    "message": "hook execution failed",
    "execution_id": "…",
    "cause": "permission_denied",
    "retryable": false
  }
}
```

Используемые hooks:

| Hook | Кто вызывает | `input` | Результат |
| --- | --- | --- | --- |
| `auth.register` | гость | `{username, password}` | Создаёт пользователя, personal scope и возвращает access JWT. |
| `auth.login` | гость | `{username, password}` | Возвращает access JWT и устанавливает refresh cookie. |
| `auth.refresh` | браузер с refresh cookie | обычно `{}` | Возвращает новый access JWT; вызывай с `credentials: "include"`. |
| `auth.logout` | авторизованный пользователь | обычно `{}` | Отзывает сессию и очищает refresh cookie. |

Пример минимальной обвязки:

```js
async function runHook(key, input = {}, accessToken = null) {
  const response = await fetch(`/api/v2/vfs/hooks/${encodeURIComponent(key)}/run`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({ input })
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error?.message || "Hook failed"), body.error);
  return body.output;
}

let accessToken = "";

async function restoreSession() {
  const output = await runHook("auth.refresh");
  accessToken = output.access_token;
  configureVFS();
}

async function login(username, password) {
  const output = await runHook("auth.login", { username, password });
  accessToken = output.access_token;
  configureVFS();
  return output;
}

async function logout() {
  await runHook("auth.logout", {}, accessToken);
  accessToken = "";
  configureVFS();
}
```

При `401` не пытайся бесконечно повторять запрос: один раз вызови
`auth.refresh`, обнови access JWT и повтори исходный запрос. Если refresh не
успешен — очисти состояние и покажи экран логина.

## 6. Готовый клиент VFSv2

Шаблон уже отдаёт `/_static/js/vfsv2.js`. Подключи его и один раз настрой
клиент после получения токена:

```html
<script src="/_static/js/vfsv2.js"></script>
```

```js
function configureVFS() {
  VFSv2.configure({
    baseURL: "/api/v2/vfs",
    credentials: "include",
    headers: () => accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
}
```

Доступные методы:

```js
await VFSv2.stat(uri);                         // JSON metadata
await VFSv2.readdir(uri);                      // массив items
await VFSv2.read(uri);                         // текст
await VFSv2.readJSON(uri);                     // JSON
await VFSv2.readBlob(uri);                     // Blob
await VFSv2.exists(uri);                       // boolean
await VFSv2.create(uri, content);              // POST file
await VFSv2.write(uri, content);               // PUT file
await VFSv2.writeJSON(uri, object);
await VFSv2.mkdir(uri);                        // POST directory
await VFSv2.move(sourceURI, targetURI);
await VFSv2.remove(uri);                       // DELETE resource
await VFSv2.control(uri, command, input, { responseType: "json" });
```

При ошибке клиент бросает `VFSv2.Error`. У него есть `status`, `code`,
`operation` и `requestId`:

```js
try {
  await VFSv2.readJSON(siteURI + "tree.json");
} catch (error) {
  if (error instanceof VFSv2.Error && error.code === "conflict") {
    // перечитать документ и дать пользователю повторить изменение
  }
  throw error;
}
```

## 7. REST API без готового клиента

База API: `/api/v2/vfs`. Во всех строках ниже `uri` — ровно один полный,
URL-encoded canonical URI. Для защищённых операций добавляй Bearer JWT.

Логика: Действие (HTTP метод) ---> с/над чем то (Endpoint) ---> с адресом (`?uri=`)

| HTTP | Endpoint | Body | Ответ |
| --- | --- | --- | --- |
| `GET` | `/stat?uri=…` | — | Метаданные одного узла. |
| `GET` | `/list?uri=…` | — | `{items:[…]}` для каталога. |
| `GET` | `/read?uri=…` | — | Содержимое файла. |
| `POST` | `/file?uri=…` | bytes/text | Создать файл, `201`. |
| `PUT` | `/file?uri=…` | bytes/text | Полностью заменить файл, `204`. |
| `POST` | `/directory?uri=…` | — | Создать каталог, `201`. |
| `POST` | `/move?uri=source` | `{"target_uri":"…"}` | Переместить/переименовать, `204`. |
| `DELETE` | `/resource?uri=…` | — | Удалить ресурс, `204`. |
| `POST` | `/control?uri=…&command=…` | JSON команды | Выполнить доменную команду provider. |

Ошибки VFS имеют JSON-envelope:

```json
{
  "error": {
    "code": "conflict",
    "message": "…",
    "operation": "control",
    "request_id": "…"
  }
}
```

Для UI важны: `400 invalid_argument` (ошибка формы), `401 unauthenticated`
(нужен access JWT), `403 permission_denied`, `404 not_found`, `409 conflict`
(устарела revision), `413 payload_too_large`. Показывай пользователю понятное
сообщение, а `request_id` оставляй в developer details/логе.

## 8. HTML provider: данные сайта

Базовый URI сайта берётся из bootstrap, конфигурации или страницы:

```js
const siteURI = "html@site[96f0bf-site]:///"; // пример, не хардкодить
const site = await VFSv2.readJSON(siteURI + "site.json");
const tree = await VFSv2.readJSON(siteURI + "tree.json");
```

У корня HTML provider есть:

| URI относительно `siteURI` | Смысл |
| --- | --- |
| `site.json` | Имя сайта, template, `model_revision`, `tree_revision`, `visibility_revision`, видимость. |
| `tree.json` | Иерархия страниц и её `tree_revision`. Используй для sidebar/tree. |
| `pages/` | Коллекция страниц. |
| `pages/<pageKey>/info.json` | Полные метаданные конкретной страницы, включая `revision`, bundle URI, статусы, теги. |
| `publishers/` | Зарегистрированные корни publisher-контента. |
| `publishers/<id>/info.json` | URI корня bundle и аудитория publisher. |
| `templates/default-spa/` | Установленные immutable версии frontend-шаблона. |
| `editor/model.xml`, `editor/layout.xml` | Существующий layout/editor контракт; не нужен для обычной SPA-админки. |

### Страница — это метаданные плюс bundle

HTML provider не хранит текст и CSS страницы внутри себя. Для страницы нужны
три файла в `bundle_root_uri`:

```
content.md
style.css
script.js
```

Например, `bundle_root_uri` может быть
`local@publisher[96f0bf-site]:///pages/about`. Перед созданием page эти файлы
должны уже существовать. Provider валидирует, что URI лежит в ранее
зарегистрированном publisher root того же site scope.

`publisher_subject_key` фиксируется при регистрации publisher. По умолчанию
это actor, который его зарегистрировал. Это метаданные владения publisher; не
подменяй значение на клиенте. Настоящее право выполнить операцию в будущем
должно определяться ACL, а не этим полем.

### Статусы и видимость

Статусы: `draft`, `ready`, `hidden`, `archived`. В публичный роутинг попадает
только готовая (`ready`) страница по валидной цепочке родителей.

`visible_to` — фильтр видимости представления HTML provider:

```json
["all"]
```

Понятные аудитории: `all`, `guest`, `user:<id>`, `service:<id>`. Для
публичной страницы используй `['all']`. Не используй `visible_to` как защиту
данных: это не заменяет ACL.

## 9. Изменение сайта через команды HTML provider

`control` — не «произвольный RPC», а операция конкретного ресурса. URI
определяет, над чем выполняется команда.

| URI | Command | Основные поля body |
| --- | --- | --- |
| корень сайта | `initialize` | `name`, `base_url`, template, `visible_to` — только bootstrap. |
| корень сайта | `update` | `expected_model_revision`, `name`, `base_url`. |
| корень сайта | `set-visibility` | `expected_visibility_revision`, `visible_to`. |
| `publishers/` | `register-root` | `root_uri`, `purpose`, `visible_to`, опционально `publisher_subject_key`. |
| `publishers/<id>` | `set-visibility` | revision + `visible_to`. |
| `pages/` | `create` | См. пример ниже. |
| `pages/<key>` | `update` | `expected_page_revision` и только изменяемые `slug`, `title`, `note`, `description`, `status`. |
| `pages/<key>` | `move` | `expected_tree_revision`, `parent_id`, `position`. |
| `pages/<key>` | `delete` | `expected_page_revision`, `expected_tree_revision`, `mode`. |
| `pages/<key>` | `set-visibility` | `expected_visibility_revision`, `visible_to`. |
| `pages/<key>` | `set-types` / `set-search-tags` | `expected_page_revision`, `values`. |

`position` имеет один из anchors: `{ "last": true }`, `{ "first": true }`,
`{ "before_id": 12 }`, `{ "after_id": 12 }`. Поля `parent_id` и anchor ID
— локальные идентификаторы HTML provider; получай их из свежего `tree.json`.

### Создать страницу из браузерного UI

Это рекомендуемая последовательность:

1. Прочитать `site.json`, `tree.json` и список publisher root.
2. Выбрать разрешённый `root_uri` publisher.
3. Создать каталог bundle: `local@…:///pages/<key>`.
4. Загрузить `content.md`, `style.css`, `script.js`.
5. Вызвать `create` у `${siteURI}pages` с текущим `tree.tree_revision`.
6. По успешному ответу перечитать `tree.json` и страницу; не собирать дерево
   вручную из локального состояния.

Пример:

```js
const tree = await VFSv2.readJSON(siteURI + "tree.json");
const bundle = "local@publisher[96f0bf-site]:///pages/about";

await VFSv2.mkdir(bundle);
await VFSv2.create(bundle + "/content.md", "# О нас\n");
await VFSv2.create(bundle + "/style.css", ".page { padding: 2rem; }\n");
await VFSv2.create(bundle + "/script.js", "console.log('about');\n");

await VFSv2.control(siteURI + "pages", "create", {
  expected_tree_revision: tree.tree_revision,
  position: { last: true },
  page_key: "about",
  slug: "about",
  title: "О нас",
  status: "ready",
  bundle_root_uri: bundle,
  visible_to: ["all"]
}, { responseType: "json" });
```

Обновить title у существующей страницы:

```js
const page = await VFSv2.readJSON(siteURI + "pages/about/info.json");
await VFSv2.control(siteURI + "pages/about", "update", {
  expected_page_revision: page.revision,
  title: "Новый заголовок"
}, { responseType: "json" });
```

## 10. Ревизии и конфликт одновременного редактирования

Это обязательная часть UI. Для предотвращения тихой потери данных сервер
требует текущую ревизию:

| Что меняется | Что предварительно прочитать | Поле в команде |
| --- | --- | --- |
| Название/base URL сайта | `site.json` | `expected_model_revision` |
| Структура дерева, создание, перемещение | `tree.json` | `expected_tree_revision` |
| Поля одной страницы, типы, теги | `pages/<key>/info.json` | `expected_page_revision` |
| Видимость сайта/страницы/publisher | соответствующий документ | `expected_visibility_revision` |

Если пришёл `409 conflict`, не отправляй старое тело повторно. Перечитай
нужный документ, покажи обновлённые данные или предложи пользователю применить
правку ещё раз. Для чистого `create` можно один раз заново прочитать дерево и
повторить операцию, предварительно проверив, что такой `page_key` ещё не
создан.

## 11. Публичная страница и site context

Посетитель не обязан заранее знать VFS URI. При `GET /demo` server проверяет
маршрут и отдаёт application template. Runtime получает site scope из static
asset этого template:

```html
GET /_static/site-context.json
{"scope":"site-acme"}
```

Frontend читает его так:

```js
const { scope } = await fetch("/_static/site-context.json").then((response) => response.json());
const siteURI = `html@site[${scope}]:///`;
```

Браузер получает только scope сайта и строит его канонический HTML URI. Page и
Block metadata читаются отдельно; `bundle_root_uri` никогда не передаётся через
HTML entrypoint или server-side DOM injection.
Не хардкодь scope или URI публикатора: scope у каждого развёртывания другой.

Существующая demo-админка — рабочий пример вызовов в
`data/HTML/frontend/js/admin.js`, но это демо, не готовая модель прав.

## 12. Что сейчас ещё не является готовой многопользовательской системой

Это важно заложить в UI правильно.

| Есть сейчас | Чего пока нет |
| --- | --- |
| Auth выдаёт access JWT и refresh HttpOnly cookie. | Нет полноценного ACL management UI и правил, которые различают редакторов сайта. |
| Сервер извлекает actor из Bearer access JWT; без него actor — гость. | Нет безопасного разграничения «владелец / редактор / читатель» для HTML-команд. |
| `visible_to` скрывает site/page/publisher от нецелевой аудитории. | `visible_to` не является авторизацией и не должен охранять данные. |
| Site scope отделён от system scope. | Текущий временный authorizer разрешает операции site scope шире, чем должен. |

Поэтому frontend уже сейчас должен:

1. Всегда реализовать логин, refresh и Bearer header для административных
   вызовов.
2. Не считать отсутствие кнопки или `visible_to` защитой.
3. Держать проверки прав в отдельном слое UI, готовом получать будущие ACL
   capabilities от сервера.
4. Не пытаться компенсировать отсутствие ACL прямым доступом к БД или
   «секретными» URI — это запрещённый обход архитектуры.

## 13. Что отдать frontend-разработчику как стартовую задачу

1. Запустить проект по разделу 3 и проверить `GET /health/ready`.
2. Изучить `data/HTML/frontend/js/vfsv2.js` и использовать его, а не
   копировать HTTP-код в каждой форме.
3. Сделать auth state: login → access JWT в памяти → refresh при reload →
   logout.
4. Получить site scope через `/_static/site-context.json`, построить site URI и загрузить
   `site.json`, `tree.json`.
5. Реализовать sidebar дерева и карточку страницы через `info.json`.
6. Реализовать create/update/move/delete с revision-aware конфликтами.
7. Реализовать загрузку трёх файлов bundle перед `pages/create`.
8. После изменения frontend-исходников выкатывать их
   `scripts/install-template.sh`, а не пытаться записывать в `/_static` по
   HTTP.

## 14. Полезные исходники в репозитории

| Файл | Что смотреть |
| --- | --- |
| `data/HTML/frontend/js/vfsv2.js` | Готовый браузерный клиент VFS. |
| `data/HTML/frontend/js/admin.js` | Демо интерфейса HTML provider. |
| `site.bootstrap.json` | Как устроен конкретный site/publisher/template bootstrap. |
| `scripts/README.md` | Краткий справочник команд. |
| `scripts/add-page.sh` | Полная последовательность создания page через REST. |
| `docs/HTML_EDITOR_CONTRACT_RU.md` | Более детальный контракт HTML provider. |
| `docs/VFS_V2_HTTP_ENDPOINT_MAP_RU.md` | Низкоуровневая карта VFS HTTP endpoint-ов. |

Если в этом документе и коде есть расхождение, контрактом считается текущий
код и тесты HTTP adapter/HTML provider. Обнаруженное расхождение надо
исправлять в документации вместе с изменением API.
