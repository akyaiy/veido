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
```

`bootstrap-site.sh` выполняется только для нового сайта. Повторный полный
bootstrap намеренно откажется до изменения данных, если site scope уже
существует. Для обновления frontend-шаблона используй `install-template.sh`,
а для страниц — `add-page.sh`.

`add-page.sh` ожидает в source directory файлы `content.md`, `style.css` и
`script.js`; `SITE_URI` берёт из `.env`. При конкурентном изменении дерева
страниц создание может вернуть conflict: запусти команду повторно после
проверки, что page ещё не создана.

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
