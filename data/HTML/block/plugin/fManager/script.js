/***************************************************************************
 * FilesApiClient — клиент API для работы с файлами и каталогами.
 ***************************************************************************/
class FilesApiClient {

/***************************************************************************
 * constructor — инициализация базового пути.
 ***************************************************************************/
  constructor(baseUrl = '/api/files') {
    this.baseUrl = baseUrl;
  }


/****************************************************************************
 * list — запрашивает список файлов и каталогов по указанному пути.
 *
 * @param {string} path Путь к каталогу
 * @returns {Promise<any>} Результат запроса к API со списком файлов
 *
 * Поведение:
 * - Отправляет защищённый запрос к `/api/files{path}`.
 * - При ошибке 403 выводит сообщение об отсутствии прав доступа.
 * - При любой другой ошибке выводит общее сообщение об ошибке загрузки.
 ***************************************************************************/
  async list(path) {
    try {
        return  await apiProtected(`/api/files${path}`);//urlPath
    } catch (e) {
        if (e.status === 403) {
            alert("Нет прав на просмотр файлов");
        } else {
            alert("Ошибка списка файлов");
        }
        return;
    }
}

/***************************************************************************
 * getFile — получение содержимого файла:
 *
 * @param {string} path Путь к каталогу
 * @returns {Promise<any>} Cодержимое файла в текстовом виде.
 *
 * Поведение:
 * - Принимает путь к файлу относительно базового пути.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает содержимое файла в текстовом виде.
 ***************************************************************************/
  async getFile(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await apiProtected(url);
    if (!res.ok) throw new Error(`Error getting file: ${res.statusText}`);
    return res.text(); // для бинарных файлов можно использовать res.arrayBuffer()
  }

/***************************************************************************
 * head — получение метаинформации файла:
 *
 * @param {string} path Путь к каталогу
 * @returns {Promise<{
 *   size: number | null,
 *   lastModified: Date | null,
 *   contentType: string | null
 *  }>}
 *
 * Поведение:
 * - Принимает путь к файлу относительно базового пути.
 * - Выполняет HEAD-запрос без загрузки содержимого.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает размер, дату изменения и тип содержимого.
 ***************************************************************************/
  async head(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await apiProtected(url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`Error fetching metadata: ${res.statusText}`);
    return {
      size: res.headers.get('Content-Length'),
      lastModified: res.headers.get('Last-Modified'),
      contentType: res.headers.get('Content-Type')
    };
  }

/***************************************************************************
 * upload — загрузка файла:
 * 
 * @param {string} path Путь назначения относительно baseUrl
 * @param {File|Blob} file Файл для загрузки
 * @returns {Promise<boolean>}
 *
 * Поведение:
 * - Принимает путь назначения и файл для загрузки.
 * - Отправляет файл на сервер с использованием FormData.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат загрузки.
 ***************************************************************************/
  async upload(path, file) {
    const url = `${this.baseUrl}/${path}`;
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiProtected(url, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Error uploading file: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * mkdir — создание папки:
 * 
 * @param {string} path Путь создаваемого каталога относительно baseUrl
 * @returns {Promise<boolean>} Успешный результат операции.
 *
 * Поведение:
 * - Принимает путь создаваемой папки.
 * - Отправляет запрос на создание папки.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
  async mkdir(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await apiProtected(url, { method: 'POST' });
    if (!res.ok) throw new Error(`Error creating folder: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * put — полная замена содержимого файла:
 * - Принимает путь к файлу и новое содержимое.
 * - Полностью перезаписывает файл на сервере.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
  async put(path, content) {
    const url = `${this.baseUrl}/${path}`;
    const res = await apiProtected(url, { method: 'PUT', body: content });
    if (!res.ok) throw new Error(`Error updating file: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * patch — частичное обновление содержимого файла:
 * - Принимает путь к файлу и обновляемое содержимое.
 * - Обновляет часть файла без полной перезаписи.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
  async patch(path, content) {
    const url = `${this.baseUrl}/${path}`;
    const res = await apiProtected(url, { method: 'PATCH', body: content });
    if (!res.ok) throw new Error(`Error patching file: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * delete — удаление файла или папки:
 * - Принимает путь к файлу или папке.
 * - Удаляет указанный объект на сервере.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
  async delete(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await apiProtected(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Error deleting: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * copy — копирование файла:
 * - Принимает путь исходного файла и целевой путь.
 * - Создаёт копию файла в указанном месте.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
  async copy(path, target) {
    const url = `${this.baseUrl}/${path}/copy`;
    const res = await apiProtected(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    });
    if (!res.ok) throw new Error(`Error copying file: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * move — перемещение файла:
 * - Принимает путь исходного файла и целевой путь.
 * - Перемещает файл в указанное место.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
  async move(path, target) {
    const url = `${this.baseUrl}/${path}/move`;
    const res = await apiProtected(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    });
    if (!res.ok) throw new Error(`Error moving file: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * getRange — загрузка части файла:
 * - Принимает путь к файлу и диапазон байт.
 * - Загружает указанную часть файла с использованием Range-запроса.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает данные файла в бинарном виде.
 ***************************************************************************/
  async getRange(path, start = 0, end = null) {
    const url = `${this.baseUrl}/${path}`;
    const headers = {};
    if (end !== null) headers['Range'] = `bytes=${start}-${end}`;
    const res = await apiProtected(url, { headers });
    if (!res.ok && res.status !== 206) throw new Error(`Error fetching range: ${res.statusText}`);
    return res.arrayBuffer();
  }

/***************************************************************************
 * search — поиск файлов с фильтрацией:
 * - Принимает путь каталога и параметры поиска.
 * - Выполняет поиск файлов по заданным условиям.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает список найденных файлов.
 ***************************************************************************/
  async search(path = '', query = {}) {
    const params = new URLSearchParams(query);
    const url = `${this.baseUrl}/${path}?${params.toString()}`;
    const res = await apiProtected(url);
    if (!res.ok) throw new Error(`Error searching files: ${res.statusText}`);
    return res.json();
  }
}

/***************************************************************************
 * Основной класс файлового менеджера.
 ***************************************************************************/
class FileManager {

/***************************************************************************
 * Переменные для хранения текущее состояние файлового менеджера.
 ***************************************************************************/
  constructor(apiClient, Msg) {
    this.cwd = '/';
    this.currentFiles = [];
    this.api = apiClient;
    // Пользовательские настройки файлового менеджера.
    this.settings = {
      sort: 'name', // name | size | date  
      view: 'table',//
      foldersFirst: false,
      showHidden: false
    };
    this.msg = Msg;
  }

/***************************************************************************
 * init — загружает содержимое корневого каталога.
 ***************************************************************************/
async init() {
  this.currentFiles = await f.list(await this.msg.getData() || []);
  //console.log(this.currentFiles);
    this.updateCwdDisplay();
    this.sortFiles();
    this.renderFiles();
}

/***************************************************************************
 * sortFiles — сортирует список файлов:
 * - При включённой опции поднимает папки выше файлов.
 * - Сортирует по имени размеру или дате в зависимости от выбранного режима.
 * - Обновляет порядок элементов в списке.
 ***************************************************************************/
  sortFiles() {
    this.currentFiles.sort((a, b) => {

        // папки вверх ТОЛЬКО если включено
        if (this.settings.foldersFirst && a.isDir !== b.isDir) {
            return b.isDir - a.isDir;
        }

        if (this.settings.sort === 'size') {
            return (a.size || 0) - (b.size || 0); 
        }

        if (this.settings.sort === 'date') {
            return new Date(a.modTime || 0) - new Date(b.modTime || 0);
        }

        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    });
}


/***************************************************************************
 * Переменные для хранения текущее состояние файлового менеджера.
 ***************************************************************************/
  async openDir(path) {
    this.currentFiles = await this.api.list(path);
    this.cwd = path;
    this.updateCwdDisplay();
    this.sortFiles();
    this.renderFiles();
  }

/***************************************************************************
 * updateCwdDisplay — обновление отображения текущего пути:
 * - Очищает текущее содержимое строки пути.
 * - Отображает базовый текущий каталог.
 * - При наличии выбранного элемента добавляет выделенный суффикс пути.
 ***************************************************************************/
  updateCwdDisplay(selectedName = null) {
    cwdEl.innerHTML = '';

    const base = document.createElement('span');
    base.className = 'cwdEl-base';
    base.textContent = this.cwd;
    cwdEl.appendChild(base);

    if (selectedName) {
        const suffix = document.createElement('span');
        suffix.className = 'cwdEl-selected';
        suffix.textContent =
            (this.cwd.endsWith('/') ? '' : '/') + selectedName;
        cwdEl.appendChild(suffix);
    }
}

/***************************************************************************
 * renderFiles — отрисовка списка файлов в текущем режиме отображения:
 * - Очищает контейнер списка файлов.
 * - Добавляет заголовок таблицы при режиме "table".
 * - Фильтрует скрытые файлы в зависимости от настроек.
 * - Формирует элементы файлов и папок с учётом режима отображения.
 * - Назначает обработчик двойного клика для открытия или скачивания.
 * - Управляет отображением нижней панели действий.
 ***************************************************************************/
  async renderFiles() {
    const container = document.getElementById('files_view');
    container.innerHTML = '';

    // Если режим "table", добавляем заголовок первой строкой
    if (this.settings.view === 'table') {
      const header = document.createElement('div');
      header.id = 'files_header';
      header.innerHTML = `
        <div>Имя</div>
        <div>Размер</div>
        <div>Дата</div>
      `;
      container.appendChild(header);
    }

    // Рендерим файлы
      this.currentFiles
      .filter(file => this.settings.showHidden || !file.name.startsWith('.'))
      .forEach(file => {
      const item = document.createElement('div');
      item.className = 'file_item';
      item.dataset.path = (this.cwd === '/' ? '' : this.cwd) + '/' + file.name;

      const icon = file.isDir ? '📁' : '📄';
      const nameEsc = escapeHtml(file.name);

      item.innerHTML = `
        <div class="file_main">  <!--ОДНА колонка -->
          <div class="file_icon">${icon}</div>
          <div class="file_name">${nameEsc}</div>
        </div>
        ${this.settings.view === 'table' ? `<div>${file.size || '—'}</div><div>${file.modTime || ''}</div>` : ''}
      `;

      item.ondblclick = () => {
          const path = (this.cwd === '/' ? '' : this.cwd) + '/' + file.name;
          if (file.isDir) {
              this.openDir(path);  // <- используем метод класса
          } else {
              downloadFile(path);
          }
      };


      container.appendChild(item);
    });

    const act = M.data?.[0]?.listTfootAct ?? null;
    if (act) {
      listTfoot(act);
    } else {
      const toolbarBottom = document.getElementById('toolbarBottom');
      toolbarBottom.style.display = 'none';
    }
  }
}

/***************************************************************************
 * MsgClient — клиент API для работы с Внутренними сообщениями.
 ***************************************************************************/
class MsgClient {

/***************************************************************************
 * Переменная для хранения полученых данных
 ***************************************************************************/
  constructor(data) {
    this.data
  }

/***************************************************************************
 * Функция получения данных из хранилища сообщений
 ***************************************************************************/
  async getData() {
    this.data = await tempStore.getByRecipient("fManager");
    let urlPath;
    if (this.data){
    if (this.data?.[0]?.path) {
      urlPath = this.data[0].path;
    } else if (this.data[0].path === '/') {
      urlPath = '';
    }} else {urlPath = "/"}
    return urlPath
  }

/***************************************************************************
 * Функция отправки данных в хранилище сообщений
 ***************************************************************************/
  async setData(path){
    await tempStore.store({path: path}, { recipient: M.data?.[0]?.sender})
  }

/***************************************************************************
 * Функция запуска callBack функций
 ***************************************************************************/
  async callBack(){
    const callbackName = M.data?.[0]?.callbackFun;
    if (callbackName && typeof window[callbackName] === "function") {
        await window[callbackName]();
    }
 }
}

let f = new FilesApiClient;
let M = new MsgClient
let fm = new FileManager(f,M)

/***********************************************************************
 * Элементы интерфейса файлового менеджера.
 **********************************************************************/
const cwdEl = document.getElementById('cwdEl');
const mainEl = document.getElementById('main');
const filesTable = document.getElementById('files');
const tbody = document.querySelector('#files tbody');
const closeBtn = document.getElementById('closeBtn');
const fburger = document.getElementById('fburger');
const fburgerMenu = document.getElementById('fburgerMenu');
const fburgerMenuEl = document.getElementById('fburgerMenu');
const menuItems = fburgerMenuEl.querySelectorAll('#fburgerMenu > .menu_item');
const submenus = fburgerMenuEl.querySelectorAll('.submenu');
// Чекбоксы управления списком файлов.
const chkFoldersFirst = document.getElementById('sortFoldersFirst');
const chkShowHidden = document.getElementById('showHidden');
// Контейнер отображения списка файлов.
const filesView = document.getElementById('files_view');

/***************************************************************************
 * closeBtn click — закрывает окно файлового менеджера:
 * - Сбрасывает активное состояние панели.
 * - Удаляет окно файлового менеджера со страницы.
 * - Удаляет связанные динамические стили и скрипты.
 ***************************************************************************/
closeBtn.addEventListener('click', () => {
    const f_m = document.getElementById("fManager");
    if (f_m) f_m.remove();
    document.querySelectorAll('[data-dynamic="fManager"]').forEach(el => el.remove());
});

/***************************************************************************
 * document click — закрывает меню файлового менеджера.
 ***************************************************************************/
document.addEventListener('click', () => {
    fburger.classList.remove('open');
});

 /***********************************************************************
  * Пользовательские настройки файлового менеджера.
  **********************************************************************/

/***********************************************************************
 * Загрузка сохранённых настроек файлового менеджера из cookie.
 **********************************************************************/
const saved = getCookie('fm_settings');
if (saved) {
    try {
        Object.assign(fm.settings, JSON.parse(decodeURIComponent(saved)));
    } catch {}
}
chkFoldersFirst.checked = fm.settings.foldersFirst;
chkShowHidden.checked = fm.settings.showHidden;

/***************************************************************************
 * fburger click — переключает состояние главного меню файлового менеджера.
 ***************************************************************************/
fburger.addEventListener('click', e => {
    e.stopPropagation();
    fburger.classList.toggle('open');
});

/***********************************************************************
 * Классы режимов отображения списка файлов.
 **********************************************************************/
const VIEW_CLASSES = {
    table: 'view_table',
    columns: 'view_list',
    tiles: 'view_tiles'
};

/***************************************************************************
 * applyViewMode — переключает режим отображения:
 * - Принимает режим отображения.
 * - Убирает все активные режимы у списка файлов.
 * - Применяет выбранный режим к списку файлов.
 ***************************************************************************/
function applyViewMode(view) {
    // убрать все режимы
    filesView.classList.remove(...Object.values(VIEW_CLASSES));
    // добавить нужный
    if (VIEW_CLASSES[view]) {
        filesView.classList.add(VIEW_CLASSES[view]);
    }
}

/***********************************************************************
 * Применение сохранённых настроек к текущему состоянию и интерфейсу.
 **********************************************************************/
document.querySelector(`input[name="sort"][value="${fm.settings.sort}"]`)?.click();

/***************************************************************************
 * fburgerMenu item click — изменяет режим отображения списка файлов:
 * - Обновляет текущий режим отображения.
 * - Применяет режим и перерисовывает список файлов.
 * - Сохраняет выбранный режим в настройках и закрывает меню.
 ***************************************************************************/
fburgerMenu.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', e => {
        e.stopPropagation();
        fm.settings.view = item.dataset.view;
        applyViewMode(fm.settings.view);
        fm.renderFiles();
        saveSettings();
        fburgerMenu.style.display = 'none';
    });
});


/***************************************************************************
 * filesView click — управление выделением файлов и отображением пути:
 * - Принимает событие клика мыши.
 * - Снимает выделение при клике по пустой области.
 * - Переключает выделение элемента файла.
 * - Обновляет отображение текущего пути в зависимости от выбора.
 ***************************************************************************/
filesView.addEventListener('click', (e) => {
    const item = e.target.closest('.file_item');
    if (!item || e.target === filesView) {
        filesView.querySelectorAll('.file_item.selected')
            .forEach(el => el.classList.remove('selected'));
        fm.updateCwdDisplay(); // сброс серого пути
        return;
    }
    if (item.classList.contains('selected')) {
        item.classList.remove('selected');
        fm.updateCwdDisplay(); // убрали выделение
        return;
    }
    filesView.querySelectorAll('.file_item.selected')
        .forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    const name = item.querySelector('.file_name')?.textContent;
    if (name) {
        fm.updateCwdDisplay(name);
    }
});

/***************************************************************************
 * listTfoot — управление нижней панелью действий:
 * - Отображает нижнюю панель файлового менеджера.
 * - Назначает действие кнопки в зависимости от режима.
 ***************************************************************************/
function listTfoot(act) {
    const toolbarBottom = document.getElementById('toolbarBottom');
    toolbarBottom.style.display = '';
    
    if (act === 'loadBlock') {
        const bottomBtn = document.getElementById('bottomBtn');
        bottomBtn.onclick = () => submitPath();
    }
}

/***************************************************************************
 * submitBlockPath — подтверждение выбора:
 * - Формирование пути по текущему каталогу и вводу пользователя.
 * - Передача пути через tempStore.
 * - Вызов callback-функции.
 * - Закрытие файлового менеджера.
 ***************************************************************************/
async function submitPath() {
    const input = document.getElementById('bottomInput');
    let path = fm.cwd + '/' + input.value;
    path = path.replace(/^\/data\/HTML\/block\//, '');
    await M.setData(path);
    await M.callBack();
    closeBtn.click();
}

/***************************************************************************
 * escapeHtml — экранирование HTML-символов для безопасного вывода текста.
 ***************************************************************************/
function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**************************************************************************
 * btnUp — кнопка перехода в родительский каталог.
 ***************************************************************************/
const btnUp = document.getElementById('btnUp');

/***************************************************************************
 * btnUp click — переход в родительский каталог:
 * - Проверяет корневой ли каталог.
 * - Определяет путь родительского каталога.
 * - Загружает содержимое родительского каталога.
 ***************************************************************************/
btnUp.addEventListener('click', () => {
    // если мы уже в корне, не делаем ничего
    if (!fm.cwd || fm.cwd === '/') return;
    // разбиваем путь на части
    const parts = fm.cwd.split('/').filter(Boolean);
    // убираем последний сегмент (текущий каталог)
    parts.pop();
    // формируем путь родителя
    const parent = '/' + parts.join('/');
    // переходим в родительский каталог
    fm.openDir(parent === '' ? '/' : parent);
});

/***************************************************************************
 * cwdEl — включение редактирования и отключение проверки орфографии.
 ***************************************************************************/
cwdEl.contentEditable = "true";
cwdEl.spellcheck = false;

/***************************************************************************
 * Временное хранение пути при редактировании.
 ***************************************************************************/
let cwdHtmlBackup = "";

/***************************************************************************
 * cwdEl focus — начало редактирования текущего пути:
 * - Сохраняет текущий путь для возможной отмены.
 * - Включает визуальный режим редактирования.
 * - Отображает текущий путь в поле ввода.
 ***************************************************************************/
cwdEl.addEventListener('focus', () => {
    cwdHtmlBackup = cwdEl.innerHTML;
    cwdEl.classList.add('editing');
});

/***************************************************************************
 * cwdEl blur — завершение редактирования пути:
 * - Отключает режим редактирования.
 * - Возвращает отображение текущего пути.
 ***************************************************************************/
cwdEl.addEventListener('blur', () => {
    cwdEl.classList.remove('editing');
    cwdEl.innerHTML = cwdHtmlBackup;
});

/***************************************************************************
 * cwdEl keydown — обработка ввода пути в адресной строке:
 * - Отслеживает нажатия клавиш Enter и Escape.
 * - Enter:
 *   - Отменяет стандартное поведение.
 *   - Нормализует введённый путь.
 *   - Гарантирует корректный формат пути.
 *   - Выполняет переход по указанному пути.
 * - Escape:
 *   - Отменяет редактирование.
 *   - Восстанавливает предыдущий путь.
 ***************************************************************************/
cwdEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();

        let path = cwdEl.textContent.trim();

        if (!path.startsWith('/')) path = '/' + path;
        path = path.replace(/\/+/g, '/');

        if (path === '') path = '/';

        fm.openDir(path);
        cwdEl.blur();
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        cwdEl.textContent = cwdEditBackup;
        cwdEl.blur();
    }
});


/***************************************************************************
 * hideSubmenus — скрытие подменю и сброс состояний меню:
 * - Скрывает все вложенные подменю.
 * - Снимает активное состояние с пунктов меню.
 * - Закрывает главное меню файлового менеджера.
 ***************************************************************************/
function hideSubmenus() {
  submenus.forEach(sm => sm.style.display = 'none');
  menuItems.forEach(mi => mi.classList.remove('active'));
  fburger.classList.remove('open');
}

/***************************************************************************
 * menuItems item mouseenter — отображение подменю:
 * - Скрывает все ранее открытые подменю.
 * - Сбрасывает активное состояние пунктов меню.
 * - Определяет связанное подменю по атрибуту data.
 * - Показывает соответствующее подменю и позиционирует его.
 ***************************************************************************/
menuItems.forEach(item => {
  item.addEventListener('mouseenter', () => {
    submenus.forEach(sm => sm.style.display = 'none');
    menuItems.forEach(mi => mi.classList.remove('active'));

    const id = item.dataset.submenu;
    const submenu = document.getElementById('submenu_' + id);

    if (submenu) {
      item.classList.add('active');
      submenu.style.display = 'block';
      submenu.style.top = item.offsetTop + 'px';
    }
  });
});

/***************************************************************************
 * fburger, submenus mouseleave — автоматическое скрытие меню:
 * - Отслеживает уход курсора с кнопки меню и подменю.
 * - С небольшой задержкой проверяет, находится ли курсор над меню.
 * - Скрывает меню при отсутствии наведения.
 ***************************************************************************/
[fburger, ...submenus].forEach(el => {
  el.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (!fburger.matches(':hover') && ![...submenus].some(sm => sm.matches(':hover'))) {
        hideSubmenus();
      }
    }, 50);
  });
});

/***************************************************************************
 * document radio change — изменение режима сортировки:
 * - Обновляет текущий параметр сортировки.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', () => {
        fm.settings.sort = radio.value;
        fm.sortFiles();
        fm.renderFiles();
    });
});

/***************************************************************************
 * chkFoldersFirst change — переключение приоритета папок:
 * - Обновляет настройку отображения папок.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
chkFoldersFirst.addEventListener('change', () => {
    fm.settings.foldersFirst = chkFoldersFirst.checked;
    fm.sortFiles();
    fm.renderFiles();
});

/***************************************************************************
 * chkShowHidden change — переключение отображения скрытых файлов:
 * - Обновляет настройку показа скрытых файлов.
 * - Перерисовывает список файлов.
 ***************************************************************************/
chkShowHidden.addEventListener('change', () => {
    fm.settings.showHidden = chkShowHidden.checked;
    fm.renderFiles();
});

/***************************************************************************
 * document radio change — изменение и сохранение режима сортировки:
 * - Обновляет текущий параметр сортировки.
 * - Сохраняет выбранный режим в настройках.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', () => {
        fm.settings.sort = radio.value;
        
        fm.sortFiles();
        fm.renderFiles();

        saveSettings();
    });
});

/***************************************************************************
 * chkFoldersFirst change — переключение приоритета папок и сохранение настройки:
 * - Обновляет параметр приоритета папок.
 * - Сохраняет значение в настройках.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
chkFoldersFirst.addEventListener('change', () => {
    fm.settings.foldersFirst = chkFoldersFirst.checked;

    fm.sortFiles();
    fm.renderFiles();
    saveSettings();
});

/***************************************************************************
 * chkShowHidden change — переключение показа скрытых файлов и сохранение настройки:
 * - Обновляет параметр отображения скрытых файлов.
 * - Сохраняет значение в настройках.
 * - Перерисовывает список файлов.
 ***************************************************************************/
chkShowHidden.addEventListener('change', () => {
    fm.settings.showHidden = chkShowHidden.checked;

    fm.renderFiles();
    saveSettings();
});

/***************************************************************************
 * saveSettings — сохранение текущих настроек в cookie.
 ***************************************************************************/
function saveSettings() {
    setCookie('fm_settings', JSON.stringify(fm.settings));
}

/***************************************************************************
 * fburger click — переключение отображения главного меню:
 * - Останавливает всплытие события клика.
 * - Переключает состояние видимости меню файлового менеджера.
 ***************************************************************************/
fburger.addEventListener('click', e => {
    e.stopPropagation();
    fburgerMenu.style.display = fburgerMenu.style.display === 'block' ? 'none' : 'block';
});

/***************************************************************************
 * document click — закрывает меню файлового менеджера при клике вне его.
 ***************************************************************************/
document.addEventListener('click', () => {
    fburgerMenu.style.display = 'none';
});

/***************************************************************************
 * menuItems item mouseenter — отображение подменю:
 * - Скрывает все открытые подменю.
 * - Снимает активное состояние с пунктов меню.
 * - Определяет подменю, связанное с пунктом.
 * - Показывает соответствующее подменю и позиционирует его.
 ***************************************************************************/
menuItems.forEach(item => {
  item.addEventListener('mouseenter', () => {
    submenus.forEach(sm => sm.style.display = 'none');
    menuItems.forEach(mi => mi.classList.remove('active'));

    const id = item.dataset.submenu;
    const submenu = document.getElementById('submenu_' + id);

    if (submenu) {
      item.classList.add('active');
      submenu.style.display = 'block';
      submenu.style.top = item.offsetTop + 'px';
    }
  });
});

/***************************************************************************
 * applyViewMode — применяет текущий режим отображения файлов.
 ***************************************************************************/
applyViewMode(fm.settings.view);

fm.init();
