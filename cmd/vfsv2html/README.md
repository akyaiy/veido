# HTML Provider VFSv2 demo

Команда поднимает отдельную ACL-free development-композицию VFSv2:

- scope `html-demo`, принадлежащий actor `user:html-demo`;
- HTML connection `html@site[html-demo]:///`;
- Scopes Provider в system scope;
- writable content connection `demo-content@content[html-demo]:///content`,
  использующий metadata/CAS реализацию Local Provider;
- publisher root `/content` и страницы `home`/`demo`, созданные через публичные
  команды `Control` HTML Provider.
- immutable application template `default-spa/7`, собранный из явного
  allowlist `data/HTML/frontend` и установленный через
  `Control(/templates, "install", ...)`.

Физические fixtures находятся в `/content/home` и `/content/demo`; каждый
содержит bundle:

```text
content.md   Markdown-контент с примером inline HTML
style.css    стили страницы
script.js    клиентский код страницы
```

Отдельный `content.html` не используется.

Запуск:

```bash
go run ./cmd/vfsv2html \
  -addr :8082 \
  -db ./data/db/vfsv2_html_demo.sqlite3 \
  -content-store ./data/cas/vfsv2_html_demo \
  -template-source ./data/HTML/frontend
```

HTTP VFS API доступен под `/api/v2/vfs`. Например:

```text
GET /api/v2/vfs/read?uri=html%40site%5Bhtml-demo%5D%3A%2F%2F%2Fpages%2Fhome%2Finfo.json
```

На `/` сохранено прежнее клиентское приложение. Все остальные routes, включая
`/demo`, являются обычными HTML Provider pages и загружаются одинаково через
`get-page` и physical bundle. Bundle страницы `demo` открывает рабочую панель
управления сайтом: дерево страниц, создание/обновление/перемещение и
удаление metadata, редактирование `content.md`/`style.css`/`script.js`, статусы,
типы, поисковые теги, visibility и просмотр publisher roots.
Остальные browser routes отображают найденную `get-page` страницу, загружая
её `content.md`, `style.css` и `script.js` через actor-bound VFS. Page bootstrap
встраивается в первоначальный HTML-ответ: браузер не повторяет `get-page` и не
читает отдельно `site.json`/`info.json`.

Пока active publication отсутствует, demo Site HTTP Adapter считает публично
активными только страницы со status `ready`. Поэтому seed-страница `/demo`
доступна, а `/home` со status `draft` возвращает 404; metadata и bundle draft
по-прежнему доступны авторизованной панели через VFS.

UI использует публичный `/api/v2/vfs`; универсальный endpoint
`POST /api/v2/vfs/hooks/{hook-key}/run` остаётся доступен внешним клиентам.
Прямого доступа к HTML Store, SQLite или filesystem у UI нет.

Повторный запуск с той же БД идемпотентен и не создаёт дубликаты страниц или
template version.
Physical content и его metadata сохраняются между запусками в SQLite/CAS.
Authorizer в demo допускает все resource actions после owner scope gate; это
проверочная сборка, а не production ACL.
