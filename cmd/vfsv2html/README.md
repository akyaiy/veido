# HTML Provider VFSv2 demo

Команда поднимает отдельную ACL-free development-композицию VFSv2:

- scope `html-demo`, принадлежащий actor `user:html-demo`;
- HTML connection `html@site[html-demo]:///`;
- Scopes Provider в system scope;
- writable content connection `demo-content@content[html-demo]:///content`,
  использующий metadata/CAS реализацию Local Provider;
- publisher root `/content`, страницы `home`/`demo` и Blocks `demo-ui`/
  `demo-content`, созданные через публичные команды `Control` HTML Provider.
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

Blocks лежат в `/content/blocks`: `demo-ui` является `ui-component` с тремя
contract-файлами, `demo-content` — `content` только с `content.md`. Seed создаёт
provider-owned дерево с папками `UI components` и `Content`.

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
`get-page` и physical bundle. Bundle страницы `demo` наглядно показывает
`blocks/tree.json`, затем лениво читает `/blocks/<key>/meta.json`; по кнопке
показывает physical `content.md` по `bundle_root_uri`. Это демонстрирует, что
Block не является обязательной частью Page и HTML Provider не читает байты
bundle из собственного Store.
Остальные browser routes отображают найденную `get-page` страницу, загружая
её `content.md`, `style.css` и `script.js` через actor-bound VFS. HTML-ответ
не меняется adapter-ом: browser получает scope из `GET /_static/site-context.json`,
строит canonical HTML site URI и читает `tree.json` и `info.json`/`meta.json`.
`bundle_root_uri` приходит только из этих metadata.

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

## Обновление и миграция

Останови процесс, затем примени миграции к существующей demo БД:

```bash
go run ./cmd/migrate -db ./data/db/vfsv2_html_demo.sqlite3
```

Либо для основной конфигурации с `DB_PATH` из `.env`:

```bash
scripts/migrate.sh
```

Чтобы обновить именно страницу `/demo` после правки файлов в
`cmd/vfsv2html/content/demo/`, достаточно перезапустить команду запуска выше.
Content fixtures повторно записываются через VFS, а seed Blocks и дерева
идемпотентен. Ничего удалять из SQLite или CAS для обычного обновления не надо.

Для полностью чистой демо-среды выбери другой пути `-db` и `-content-store`
либо удали только конкретные demo-файлы/БД, когда процесс остановлен.
