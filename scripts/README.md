# Рабочие скрипты

Все скрипты выполняются из любого каталога и сами переходят в корень проекта.
Они используют только публичные VFS HTTP API и access JWT.

```bash
# получить access JWT и сохранить его локально в .site-session (mode 600)
scripts/login.sh --username admin
source .site-session

# отозвать текущую JWT-сессию и удалить .site-session
scripts/logout.sh

# собрать и установить следующую immutable версию default-spa автоматически
scripts/install-template.sh

# применить миграции из DB_PATH .env
scripts/migrate.sh

# при работающем cmd/server: login/register, provision site и обновление .env (выполнять только 1 раз при настройке сервера)
scripts/bootstrap-site.sh --username admin --password 'admin123'

# добавить новую page из трёх файлов bundle
SITE_ACCESS_TOKEN='<access JWT>' scripts/add-page.sh \
  --key about --slug about --title 'О нас' \
  --source-dir ./site-content/publisher/pages/about

# загрузить Block и добавить его в provider-owned tree
SITE_ACCESS_TOKEN="$SITE_ACCESS_TOKEN" scripts/add-block.sh \
  --key promo-card --name 'Promo card' --type ui-component \
  --source-dir ./site-content/publisher/blocks/promo-card \
  --folder-key components --folder-name 'Components'

# заменить только bytes bundle существующей Page
SITE_ACCESS_TOKEN="$SITE_ACCESS_TOKEN" scripts/update-page-bundle.sh \
  --key home --source-dir ./site-content/publisher/pages/home
```

`bootstrap-site.sh` выполняется только для нового сайта. Повторный полный
bootstrap намеренно откажется до изменения данных, если site scope уже
существует. Для обновления frontend-шаблона используй `install-template.sh`,
а для страниц — `add-page.sh`.

`add-block.sh` использует тот же зарегистрированный publisher root, но хранит
physical bundle в `local@publisher[<scope>]:///blocks/<key>/`. Для
`ui-component` нужны три файла `content.md`, `style.css`, `script.js`; для
`content` допускается только `content.md`. Скрипт создаёт metadata через
`Control(/blocks, "create", ...)` и при переданных `--folder-key`/
`--folder-name` атомарно заменяет `blocks/tree.json` с его текущей revision.
При conflict дерева повтори запуск только после проверки, что metadata Block
не была уже создана: скрипт намеренно не перезаписывает существующий Block.

`add-page.sh` ожидает в source directory файлы `content.md`, `style.css` и
`script.js`; `SITE_URI` берёт из `.env`. При конкурентном изменении дерева
страниц создание может вернуть conflict: запусти команду повторно после
проверки, что page ещё не создана.

`update-page-bundle.sh` заменяет только три physical файла существующей Page
через VFS. Он не создаёт Page и не меняет slug, status, visibility или metadata.
После успешной команды сделай hard reload страницы в браузере.

Чтобы показать стандартную страницу Blocks через `cmd/server`, скопируй demo
bundle в publisher source, загрузь хотя бы один Block, затем создай Page:

```bash
mkdir -p site-content/publisher/pages/blocks
cp cmd/vfsv2html/content/demo/{content.md,style.css,script.js} site-content/publisher/pages/blocks/
SITE_ACCESS_TOKEN="$SITE_ACCESS_TOKEN" scripts/add-page.sh \
  --key blocks --slug blocks --title 'Blocks' \
  --source-dir ./site-content/publisher/pages/blocks
```

Скрипт этой страницы берёт `site_uri` из server bootstrap, поэтому один и тот
же bundle работает и в `cmd/server`, и в isolated `cmd/vfsv2html` demo.

`login.sh` хранит только access JWT, server URL и shell exports в локальном
`.site-session`; пароль и refresh credential в файл не попадают. Access JWT
короткоживущий: после его истечения запусти login снова. `logout.sh` отзывает
серверную сессию, поэтому для него нужен ещё действующий access JWT.

`install-template.sh` читает `SITE_URI` из `.env`, находит последнюю числовую
версию `default-spa` через VFS и устанавливает следующую. Поэтому
`template_version` в `site.bootstrap.json` не требуется менять вручную для
обычных обновлений frontend assets.

Если старый повторный bootstrap уже оставил `local@publisher` с credential,
который не совпадает с local account, для локальной development-БД есть
одноразовый recovery:

```bash
scripts/repair-publisher-credential.sh --yes
```

Это не обычная VFS-операция и не инструмент frontend-разработки: он нужен
только для восстановления повреждённого credential в локальной БД.
