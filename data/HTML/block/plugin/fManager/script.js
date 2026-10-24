/***************************************************************************
 * FilesApiClient — клиент API для работы с файлами и каталогами.
 ***************************************************************************/
class FilesApiClient {

/***************************************************************************
 * constructor — инициализация VFSv2-клиента.
 ***************************************************************************/
constructor() {
    this.vfs = window.vfs;
}

// uri — преобразование пути файлового менеджера в канонический URI VFS:
uri(path = '') {
    return window.VFS_ROOT + `${this.cleanPath(path)}`;
}

// cleanPath — нормализация пути:
cleanPath(path = '') {
    return String(path)
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\/+|\/+$/g, '');
}

// parentPath — получение пути к родительскому каталогу:
parentPath(path = '') {
    const parts = this.cleanPath(path).split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
}

// baseName — получение имени файла или каталога:
baseName(path = '') {
    const parts = this.cleanPath(path).split('/').filter(Boolean);
    return parts.pop() || '';
}

// dirEntries — получение списка файлов и каталогов в указанной директории:
async dirEntries(dirPath = '') {
    return await this.vfs.readdir(this.uri(dirPath));
}

// uniquePath — генерация уникального пути для нового файла или каталога:
async uniquePath(path, isDir = false) {
    const cleanPath = this.cleanPath(path);
    const parent = this.parentPath(cleanPath);
    const name = this.baseName(cleanPath);

    if (!name) return cleanPath;

    const entries = await this.dirEntries(parent);
    const used = new Set(entries.map(item => item && item.name).filter(Boolean));

    if (!used.has(name)) {
        return cleanPath;
    }

    let base = name;
    let ext = '';

    if (!isDir) {
        const dot = name.lastIndexOf('.');
        if (dot > 0) {
            base = name.slice(0, dot);
            ext = name.slice(dot);
        }
    }

    let i = 1;
    let candidate = '';

    do {
        candidate = `${base}_${i}${ext}`;
        i++;
    } while (used.has(candidate));

    return parent ? `${parent}/${candidate}` : candidate;
}


/****************************************************************************
 * list — запрашивает список файлов и каталогов по указанному пути.
 *
 * @param {string} path Путь к каталогу
 * @returns {Promise<any>} Результат запроса к API со списком файлов
 *
 * Поведение:
 * - Отправляет защищённый запрос через VFSv2.
 * - При ошибке 403 выводит сообщение об отсутствии прав доступа.
 * - Показывает сообщение об ошибке и повторно выбрасывает ошибку вызывающему коду.
 ***************************************************************************/
  async list(path) {
    try {
        return (await this.vfs.readdir(this.uri(path))).map(item => ({
            ...item,
            modTime: item.updated_at ?? item.modTime
        }));
    } catch (e) {
        if (e?.status === 403) {
            alert("#{You don't have permission to view files}");
        } else {
            alert("#{Error loading file list}");
        }
        throw e;
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
    return await this.vfs.read(this.uri(path)); // для бинарных файлов используйте readBytes
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
 * - Запрашивает метаданные через VFSv2 без загрузки содержимого.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает размер, дату изменения и тип содержимого.
 ***************************************************************************/
async head(path) {
    return await this.vfs.stat(this.uri(path));
}

// upload — загрузка файла на сервер:
async upload(path, file) {
    const uniquePath = await this.uniquePath(path, false);
    await this.vfs.create(this.uri(uniquePath), file);
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
    const uniquePath = await this.uniquePath(path, true);
    await this.vfs.mkdir(this.uri(uniquePath));
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
    await this.vfs.write(this.uri(path), content);
    return true;
}

/***************************************************************************
 * patch — частичная запись не поддерживается VFS API.
 ***************************************************************************/
async patch() {
    throw new Error("Частичная запись через VFS не поддерживается; используйте put() для полной замены файла");
}

/***************************************************************************
 * delete — удаление файла или папки:
 * - Принимает путь к файлу или папке.
 * - Удаляет указанный объект на сервере.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
async delete(path) {
    await this.vfs.remove(this.uri(path));
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
    const cleanPath = this.cleanPath(path);
    const cleanTarget = this.cleanPath(target);

    // Получаем метаданные объекта (файл или папка)
    const statData = await this.vfs.stat(this.uri(cleanPath));

    // Проверяем тип объекта по флагу is_dir
    if (statData.is_dir === true) {
        // Обработка папки

        const uniqueTarget = await this.uniquePath(cleanTarget, true);
        const uniqueCleanTarget = this.cleanPath(uniqueTarget);

        // Получаем список содержимого папки
        // Защита от пустой папки или null ответа
        const children = await this.vfs.readdir(this.uri(cleanPath));

        // Создаём папку в целевом месте
        await this.vfs.mkdir(this.uri(uniqueCleanTarget));

        // Рекурсивно копируем каждый элемент внутри папки
        for (const child of children) {
            const childSrcPath = `${cleanPath}/${child.name}`;
            const childDstPath = `${uniqueCleanTarget}/${child.name}`;

            await this.copy(childSrcPath, childDstPath);
        }

    } else {
        // Обработка файл

        const uniqueTarget = await this.uniquePath(cleanTarget, false);
        const uniqueCleanTarget = this.cleanPath(uniqueTarget);

        // Преобразуем ответ в Blob (бинарные данные файла)
        const blob = await this.vfs.readBlob(this.uri(cleanPath));
        await this.vfs.create(this.uri(uniqueCleanTarget), blob);
    }

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
    await this.vfs.move(this.uri(path), this.uri(target));
    return true;
}

/***************************************************************************
 * getRange — получение части файла:
 * - Принимает путь к файлу и диапазон байт.
 * - Читает файл целиком и возвращает клиентский срез; VFS Range-запрос не поддерживает.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает данные файла в бинарном виде.
 ***************************************************************************/
async getRange(path, start = 0, end = null) {
    // Серверный VFS read не поддерживает Range, поэтому срез выполняется после чтения всего файла.
    const bytes = await this.vfs.readBytes(this.uri(path));
    return bytes.slice(start, end === null ? undefined : end + 1).buffer;
}

/***************************************************************************
 * search — рекурсивный поиск файлов и папок с фильтрацией:
 * - Принимает путь каталога и параметры поиска.
 * - Обходит каталог и его подкаталоги.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает найденные элементы с относительным путём в поле path.
 ***************************************************************************/
async search(path = '', query = {}) {
    const root = this.cleanPath(path);
    const results = [];
    const visited = new Set();

    const visit = async directory => {
        const cleanDirectory = this.cleanPath(directory);
        if (visited.has(cleanDirectory)) return;
        visited.add(cleanDirectory);

        const entries = await this.vfs.readdir(this.uri(cleanDirectory));
        for (const item of entries) {
            const childPath = cleanDirectory
                ? `${cleanDirectory}/${item.name}`
                : item.name;
            const result = { ...item, path: childPath };

            if (Object.entries(query).every(([key, value]) =>
                String(result[key] ?? "").includes(String(value))
            )) {
                results.push(result);
            }

            if (item.is_dir) await visit(childPath);
        }
    };

    await visit(root);
    return results;
}

/***************************************************************************
 * download — скачивание файла с сервера:
 * - Принимает путь к файлу и имя для сохранения.
 * - Загружает файл и сохраняет его на клиенте.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Если это папка, загружает её содержимое и упаковывает в ZIP-архив с использованием сторонней логики.
 * - Возвращает Blob (файл или ZIP-архив).
 ***************************************************************************/
async download(path, fileName) {
    const isDir = (await this.vfs.stat(this.uri(path))).is_dir;

    // файл
    if (!isDir) {
        const blob = await this.vfs.readBlob(this.uri(path));

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName.replace(/^\/+/, "");
        a.click();

        URL.revokeObjectURL(a.href);
        return;
    }

    // папка
    await this.downloadZip([path], fileName);
}

/***************************************************************************
 * downloadZip — скачивание набора файлов/папок в ZIP-архив
 * - принимает массив путей (paths)
 * - поддерживает файлы и директории (рекурсивно)
 ***************************************************************************/
async downloadZip(paths, zipName = "archive.zip") {
    const zipModule = await loadBlock(
        "plugin/zipArchiver",
        document.createElement("div"),
        false,
        "importJs"
    );
    if (!zipModule || typeof zipModule.zipSync !== "function") {
        throw new Error("Не удалось загрузить функцию zipSync из plugin/zipArchiver");
    }
    const { zipSync } = zipModule;

    const filesMap = {};

    const read = async (basePath, node) => {
        const path = `${basePath}/${node.name}`;
        const isDir = (await this.vfs.stat(this.uri(path))).is_dir;

        if (isDir) {
            const children = await this.vfs.readdir(this.uri(path));

            for (const c of children) {
                await read(path, c);
            }
            return;
        }

        const buf = await this.vfs.readBytes(this.uri(path));
        filesMap[path.replace(/^\//, "")] = buf;
    };

    for (const p of paths) {
        const path = typeof p === "string" ? p : p.name;

        const isDir = (await this.vfs.stat(this.uri(path))).is_dir;

        if (isDir) {
            const children = await this.vfs.readdir(this.uri(path));
            for (const c of children) {
                await read(path, c);
            }
        } else {
            const buf = await this.vfs.readBytes(this.uri(path));
            const name = path.split("/").filter(Boolean).pop();
            filesMap[name] = buf;
        }
    }

    const zipData = zipSync(filesMap);

    const blob = new Blob([zipData], { type: "application/zip" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = zipName;
    a.click();

    URL.revokeObjectURL(a.href);
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
      view: 'tiles',//
      foldersFirst: true,
      showHidden: false
    };
    this.msg = Msg;
  }

/***************************************************************************
 * init — загружает содержимое начального каталога.
 ***************************************************************************/
async init() {
  const initialPath = this.api.cleanPath(await this.msg.getData());
  this.cwd = initialPath ? `/${initialPath}` : '/';
  this.currentFiles = await this.api.list(this.cwd);
  //console.log(this.currentFiles);
    this.updateCwdDisplay();
    this.sortFiles();
    this.renderFiles();
    saveHistory();
}

/***************************************************************************
 * sortFiles — сортирует список файлов:
 * - При включённой опции поднимает папки выше файлов.
 * - Сортирует по имени размеру или дате в зависимости от выбранного режима.
 * - Обновляет порядок элементов в списке.
 ***************************************************************************/
sortFiles() {
    if (!Array.isArray(this.currentFiles)) {
        return;
    }

    this.currentFiles.sort((a, b) => {

        const aDir = a.isDir ?? a.is_dir;
        const bDir = b.isDir ?? b.is_dir;

        if (this.settings.foldersFirst && aDir !== bDir) {
            return bDir - aDir;
        }

        if (this.settings.sort === 'size') {
            const res = (a.size || 0) - (b.size || 0);
            if (res !== 0) return res;
        }

        if (this.settings.sort === 'date') {
            const res = new Date(a.modTime || 0) - new Date(b.modTime || 0);
            if (res !== 0) return res;
        }

        const nameCmp = a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        if (nameCmp !== 0) return nameCmp;

        // финальный стабилизатор (важно для "не меняется обратно")
        return (aDir === bDir ? 0 : aDir ? -1 : 1);
    });
}


/***************************************************************************
 * Переменные для хранения текущее состояние файлового менеджера.
 ***************************************************************************/
async openDir(path) {
    const cleanPath = this.api.cleanPath(path);
    this.currentFiles = await this.api.list(cleanPath);
    this.cwd = cleanPath ? `/${cleanPath}` : '/';

    this.updateCwdDisplay();
    this.sortFiles();
    this.renderFiles();
    saveHistory();
}

/***************************************************************************
 * updateCwdDisplay — обновление отображения текущего пути:
 * - Очищает текущее содержимое строки пути.
 * - Отображает базовый текущий каталог.
 * - При наличии выбранного элемента добавляет выделенный суффикс пути.
 ***************************************************************************/
  updateCwdDisplay(selectedName = null) {
    if (cwdEl.classList.contains('search')) return;
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

    const clipboardPath = await getClipboard();
    const list = (clipboardPath || "").split("\n").map(v => v.trim()).filter(Boolean);

    cwdEl.classList.remove('search');
    cwdEl.classList.remove("searchPlaceholder");
    fm.updateCwdDisplay();

    // Если режим "table", добавляем заголовок первой строкой
    if (this.settings.view === 'table') {
      const header = document.createElement('div');
      header.id = 'files_header';
      header.innerHTML = `
        <div style="margin-left: 5px;">#{Name}</div>
        <div>#{Size}</div>
        <div>#{Date}</div>
      `;
      container.appendChild(header);
    }

    if (!Array.isArray(this.currentFiles) && this.currentFiles !== null) {
        container.innerHTML = `
            <div class="file_main_empty">
                <div class="file_icon_empty">🔍</div>
                <div class="file_name_empty">#{This folder does not exist}</div>
            </div>
        `;
        container.classList.add('empty');
        return;
    } else if (this.currentFiles === null || this.currentFiles.length === 0) {
        container.innerHTML = `
            <div class="file_main_empty">
                <div class="file_icon_empty">📁</div>
                <div class="file_name_empty">#{Folder is empty}</div>
            </div>
        `;
        container.classList.add('empty');
    } else {
        container.classList.remove('empty');

        this.currentFiles
        .filter(file => this.settings.showHidden || !file.name.startsWith('.'))
        .filter(file => {
            const filter = this.settings.typeFilter || [];

            if (filter.length === 0) return true;

            if (file.is_dir) {
                return filter.includes("");
            }

            return filter.some(ext => ext && file.name.endsWith(ext));
        })
        .forEach(file => {
            const item = document.createElement('div');
            item.className = 'file_item';
            item.dataset.path = (this.cwd === '/' ? '' : this.cwd) + '/' + file.name;

            if (list.includes(item.dataset.path)) { item.classList.add('clipboard'); }

            const icon = file.is_dir ? '📁' : '📄';
            const nameEsc = escapeHtml(file.name);

            item.innerHTML = `
                <div class="file_main">
                    <div class="file_icon">${icon}</div>
                    <div class="file_name">${nameEsc}</div>
                </div>
                ${this.settings.view === 'table' ? `<div>${file.size ?? '—'}</div><div>${file.modTime ?? ''}</div>` : ''}
            `;

            item.ondblclick = () => {
                const path = (this.cwd === '/' ? '' : this.cwd) + '/' + file.name;

                if (file.is_dir) {
                    this.openDir(path);
                } else {
                    downloadFile(path);
                }
            };

            container.appendChild(item);
        });
    }

    const act = M.data?.[0]?.listTfootAct ?? null;
    if (act) {
        listTfoot(act);
    } else {
        const toolbarBottom = document.getElementById('toolbarBottom');
        toolbarBottom.style.display = 'none';
    }
}
}

// Получение текста из буфера обмена с поддержкой fallback на cookie.
async function getClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (text && text.length > 0) return text;
    } catch {}

    const match = document.cookie.match(/(?:^|;\s*)clipboard=([^;]+)/);
    if (!match) return null;

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

async function downloadFile(path) {
    const selected = getSelectedItems();
    if (selected.length === 0) return;

    const cwd = fm.cwd || "";
    const base = cwd.startsWith("/") || cwd === "" ? cwd : `/${cwd}`;

    // если несколько файлов — zip
    if (selected.length > 1) {
        const paths = selected.map(item => {
            const name = getItemName(item);
            return `${base}/${name}`;
        });

        await fm.api.downloadZip(paths, "archive.zip");
        return;
    }

    // один файл (используем path если передан, иначе selected)
    let finalPath = path;

    if (!finalPath) {
        const item = selected[0];
        const name = getItemName(item);
        finalPath = `${base}/${name}`;
    }

    const fileName = finalPath.split("/").pop();
    await fm.api.download(finalPath, fileName);
}

/***************************************************************************
 * MsgClient — клиент API для работы с Внутренними сообщениями.
 ***************************************************************************/
class MsgClient {

/***************************************************************************
 * Переменная для хранения полученых данных
 ***************************************************************************/
  constructor(data) {
    this.data;
    this.selectedPath = "";
  }

/***************************************************************************
 * Функция получения данных из хранилища сообщений
 ***************************************************************************/
  async getData() {
    this.data = await tempStore.getByRecipient("fManager");
    const message = this.data?.[0];
    const path = message?.path ?? message?.data?.path;
    return typeof path === "string" && path.trim() ? path : "/";
  }

/***************************************************************************
 * Функция отправки данных в хранилище сообщений
 ***************************************************************************/
  async setData(path){
    this.selectedPath = path;
    await window.tempStore.store({ data: { path: path } }, { recipient: M.data?.[0]?.sender, ttlMs: 5000, destroyOnRead: true });
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
    const container = document.getElementById('fManagerContainer');

    if (container) {
        container.remove();
    } else {
        const f_m = document.getElementById("fManager");
        if (f_m) f_m.remove();
    }

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
    tiles: 'view_tiles',
    table: 'view_table',
    columns: 'view_list'
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
 * selectionState — объект для управления состоянием выделения файлов:
 * - anchorIndex: индекс элемента, с которого началось выделение (для Shift).
 * - focusIndex: индекс текущего активного элемента.
 * - dragging: флаг, указывающий, происходит ли выделение мышью.
 * - dragMode: режим выделения при перетаскивании (replace/add/toggle).
 * - dragStartX/Y: координаты начала перетаскивания.
 * - dragBox: элемент DOM для визуального отображения рамки выделения.
 * - baseSelection: множество элементов, выделенных до начала перетаскивания.
 * - suppressNextClick: флаг для подавления клика после завершения перетаскивания.
 ***************************************************************************/
const selectionState = {
    anchorIndex: -1,
    focusIndex: -1,
    dragging: false,
    dragMode: "replace",
    dragStartX: 0,
    dragStartY: 0,
    dragBox: null,
    baseSelection: new Set(),
    suppressNextClick: false
};

// список файлов в DOM
function getFileItems() {
    return Array.from(filesView.querySelectorAll(".file_item"));
}

// индекс элемента в списке
function getItemIndex(item) {
    return getFileItems().indexOf(item);
}

// имя файла из DOM
function getItemName(item) {
    return item.querySelector(".file_name")?.textContent?.trim() || null;
}

// текущий список выбранных файлов
function getSelectedItems() {
    return getFileItems().filter(el => el.classList.contains("selected"));
}

// очистка выделения
function clearSelection() {
    getFileItems().forEach(el => el.classList.remove("selected"));
}

// обновление cwd отображения в зависимости от выбора
function setCwdDisplayFromSelection() {
    const selected = getSelectedItems();

    if (selected.length === 1) {
        fm.updateCwdDisplay(getItemName(selected[0]));
        return;
    }

    fm.updateCwdDisplay();
}

// применить новое множество выделения
function applySelectionSet(set) {
    const items = getFileItems();

    items.forEach(el => {
        el.classList.toggle("selected", set.has(el));
    });

    setCwdDisplayFromSelection();
}

// выделить только один элемент
function selectOnly(item) {
    clearSelection();
    item.classList.add("selected");

    const index = getItemIndex(item);
    selectionState.anchorIndex = index;
    selectionState.focusIndex = index;

    fm.updateCwdDisplay(getItemName(item));
}

// переключить выделение одного элемента (Ctrl)
function toggleItem(item) {
    item.classList.toggle("selected");

    const index = getItemIndex(item);
    selectionState.focusIndex = index;

    if (selectionState.anchorIndex < 0) {
        selectionState.anchorIndex = index;
    }

    setCwdDisplayFromSelection();
}

// выделение диапазона (Shift)
function selectRange(toIndex) {
    const items = getFileItems();

    if (selectionState.anchorIndex < 0) {
        selectionState.anchorIndex = toIndex;
    }

    const a = Math.min(selectionState.anchorIndex, toIndex);
    const b = Math.max(selectionState.anchorIndex, toIndex);

    const set = new Set(items.slice(a, b + 1));

    applySelectionSet(set);
    selectionState.focusIndex = toIndex;
}

// проверка пересечения прямоугольников (drag selection)
function rectIntersects(a, b) {
    return !(
        a.right < b.left ||
        a.left > b.right ||
        a.bottom < b.top ||
        a.top > b.bottom
    );
}

// создать визуальную рамку выделения
function createDragBox() {
    if (selectionState.dragBox) return;

    const box = document.createElement("div");
    box.className = "selectionBox";
    document.body.appendChild(box);
    selectionState.dragBox = box;
}

// удалить рамку выделения
function removeDragBox() {
    if (!selectionState.dragBox) return;
    selectionState.dragBox.remove();
    selectionState.dragBox = null;
}

// обновление drag-выделения
function updateDragSelection(x1, y1, x2, y2, mode) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    // обновление рамки
    selectionState.dragBox.style.left = left + "px";
    selectionState.dragBox.style.top = top + "px";
    selectionState.dragBox.style.width = width + "px";
    selectionState.dragBox.style.height = height + "px";

    const boxRect = {
        left,
        top,
        right: left + width,
        bottom: top + height
    };

    const items = getFileItems();
    const hit = new Set();

    // собираем элементы внутри рамки
    items.forEach(item => {
        if (rectIntersects(boxRect, item.getBoundingClientRect())) {
            hit.add(item);
        }
    });

    // режимы drag (replace/add/toggle)
    let result = new Set(selectionState.baseSelection);

    if (mode === "replace") result = hit;

    if (mode === "add") {
        hit.forEach(el => result.add(el));
    }

    if (mode === "toggle") {
        hit.forEach(el => {
            if (result.has(el)) result.delete(el);
            else result.add(el);
        });
    }

    applySelectionSet(result);
}

// клик по файлу (shift/ctrl/обычный)
function handleFileClick(e) {
    const item = e.target.closest(".file_item");

    if (!item) {
        clearSelection();
        selectionState.anchorIndex = -1;
        selectionState.focusIndex = -1;
        fm.updateCwdDisplay();
        return null;
    }

    const index = getItemIndex(item);
    const name = getItemName(item);

    // Shift - диапазон
    if (e.shiftKey) {
        selectRange(index);
        return name;
    }

    // Ctrl - переключение
    if (e.ctrlKey || e.metaKey) {
        toggleItem(item);
        return name;
    }

    // обычный клик
    selectOnly(item);
    return name;
}

// click handler
filesView.addEventListener("click", (e) => {
    if (selectionState.suppressNextClick) {
        selectionState.suppressNextClick = false;
        return;
    }

    handleFileClick(e);
});

// drag selection (мышь)
filesView.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;

    selectionState.dragStartX = e.clientX;
    selectionState.dragStartY = e.clientY;
    selectionState.dragging = false;

    // режим зависит от модификаторов
    selectionState.dragMode =
        (e.ctrlKey || e.metaKey) ? "toggle" :
        (e.shiftKey ? "add" : "replace");

    // базовое выделение перед drag
    selectionState.baseSelection = new Set(getSelectedItems());

    const onMove = (ev) => {
        const dx = Math.abs(ev.clientX - selectionState.dragStartX);
        const dy = Math.abs(ev.clientY - selectionState.dragStartY);

        // старт drag после небольшого смещения
        if (!selectionState.dragging && (dx > 4 || dy > 4)) {
            selectionState.dragging = true;
            createDragBox();
        }

        if (!selectionState.dragging) return;

        updateDragSelection(
            selectionState.dragStartX,
            selectionState.dragStartY,
            ev.clientX,
            ev.clientY,
            selectionState.dragMode
        );
    };

    const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);

        // завершение drag
        if (selectionState.dragging) {
            removeDragBox();
            selectionState.suppressNextClick = true;
        }

        selectionState.dragging = false;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
});

// keyboard navigation (стрелки + shift/ctrl)
filesView.addEventListener("keydown", (e) => {
    const items = getFileItems();
    if (!items.length) return;

    const keys = ["ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;

    e.preventDefault();

    let current = selectionState.focusIndex;

    if (current < 0) {
        const selected = getSelectedItems();
        current = selected.length ? getItemIndex(selected[0]) : 0;
    }

    let next = current;

    if (e.key === "ArrowUp") next = Math.max(0, current - 1);
    if (e.key === "ArrowDown") next = Math.min(items.length - 1, current + 1);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;

    const nextItem = items[next];
    if (!nextItem) return;

    // Shift - расширение диапазона
    if (e.shiftKey) {
        if (selectionState.anchorIndex < 0) {
            selectionState.anchorIndex = current;
        }
        selectRange(next);
    }
    // Ctrl - только фокус
    else if (e.ctrlKey || e.metaKey) {
        selectionState.focusIndex = next;
    }
    // обычная навигация
    else {
        selectOnly(nextItem);
    }

    nextItem.scrollIntoView({ block: "nearest" });
});

// Ctrl+A и Escape для выделения всех файлов и очистки выделения
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A" || e.code === "KeyA")) {
        e.preventDefault();

        const items = getFileItems();
        if (!items.length) return;

        clearSelection();

        items.forEach(item => item.classList.add("selected"));

        selectionState.anchorIndex = 0;
        selectionState.focusIndex = items.length - 1;
        return;
    }

    if (e.key === "Escape") {
        e.preventDefault();

        clearSelection();

        selectionState.anchorIndex = -1;
        selectionState.focusIndex = -1;
    }
});

// фокус на контейнер для клавиатуры
filesView.addEventListener("click", () => {
    filesView.focus();
});



/***************************************************************************
 * listTfoot — управление нижней панелью действий:
 * - Отображает нижнюю панель файлового менеджера.
 * - Назначает подтверждение выбранного пути.
 ***************************************************************************/
function listTfoot(act) {
    const toolbarBottom = document.getElementById('toolbarBottom');
    toolbarBottom.style.display = '';

    if (act === 'loadBlock' || act === 'saveBlock') {
        const bottomBtn = document.getElementById('bottomBtn');
        bottomBtn.onclick = () => submitPath();
    }
}

/***************************************************************************
 * submitPath — подтверждение выбора:
 * - Формирует путь по текущему каталогу и введённому имени.
 * - Если имя не введено, возвращает текущую папку.
 * - Передаёт путь через tempStore и вызывает callback.
 * - Закрывает файловый менеджер.
 ***************************************************************************/
async function submitPath() {
    const input = document.getElementById('bottomInput');
    const selected = getSelectedItems();

    // Получение пути выделенного элемента
    let path = selected.length === 1
        ? selected[0].dataset.path
        : fm.cwd;

    // Если введено имя, используем его относительно текущей папки
    if (input.value.trim()) {
        path = fm.cwd.replace(/\/+$/, '') + '/' + input.value.trim();
    }

    // Нормализация пути
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
    // if (!fm.cwd || fm.cwd === '/') return;
    // разбиваем путь на части
    const parts = fm.cwd.split('/').filter(Boolean);
    // убираем последний сегмент (текущий каталог)
    parts.pop();
    // формируем путь родителя
    const parent = '/' + parts.join('/');
    // переходим в родительский каталог
    fm.openDir(parent === '' ? '/' : parent);
    // сохраняем путь в историю
    saveHistory();
});

// Кнопки навигации по истории переходов
const btnBack = document.getElementById('btnBack');
const btnForward = document.getElementById('btnForward');

// Массив для хранения истории переходов
const history = [];
let historyIndex = -1;

/***************************************************************************
 * saveHistory — сохраняет текущий cwd в историю
 * - предотвращает дубликаты подряд
 * - обрезает "ветку" истории при новом переходе
 ***************************************************************************/
function saveHistory() {
    const el = document.querySelector('.cwdEl-base');
    const cwd = fm.cwd;

    if (!cwd) return;

    // если уже последний элемент совпадает — ничего не делаем
    if (history[historyIndex] === cwd) return;

    // удаляем "будущую" часть истории при новом переходе
    history.splice(historyIndex + 1);

    // добавляем новый путь
    history.push(cwd);

    // обновляем индекс
    historyIndex = history.length - 1;

    // обновляем UI текущего пути
    if (el) el.textContent = cwd;
}

/***************************************************************************
 * btnBack click — переход назад по истории
 ***************************************************************************/
btnBack.addEventListener('click', () => {
    if (historyIndex <= 0) {
        fm.renderFiles(); 
        return;
    }

    historyIndex--;
    const path = history[historyIndex];

    fm.openDir(path);

    const el = document.querySelector('.cwdEl-base');
    if (el) el.textContent = path;
});

/***************************************************************************
 * btnForward click — переход вперёд по истории
 ***************************************************************************/
btnForward.addEventListener('click', () => {
    if (historyIndex >= history.length - 1) {
        fm.renderFiles(); 
        return;
    }

    historyIndex++;
    const path = history[historyIndex];

    fm.openDir(path);

    const el = document.querySelector('.cwdEl-base');
    if (el) el.textContent = path;
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
    cwdEl.classList.add('editing');
    if (cwdEl.classList.contains('search')) return;
    cwdHtmlBackup = cwdEl.innerHTML;
});

/***************************************************************************
 * cwdEl blur — завершение редактирования пути:
 * - Отключает режим редактирования.
 * - Возвращает отображение текущего пути.
 ***************************************************************************/
cwdEl.addEventListener('blur', () => {
    cwdEl.classList.remove('editing');
    if (cwdEl.classList.contains('search')) return;
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
    if (cwdEl.classList.contains('search')) return;
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

// Поиск по имени файла
const btnSearch = document.getElementById('btnSearch');

function searchByNameInit() {
    if (!cwdEl.classList.contains('search')) {
        cwdEl.innerHTML = '';
        cwdEl.click();
        cwdEl.focus();
        cwdEl.classList.add('search');
        cwdEl.classList.add("searchPlaceholder");
    } else {
        fm.renderFiles();
        cwdEl.blur();
    }
}
    
btnSearch.addEventListener("click", searchByNameInit);

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (!cwdEl.classList.contains("search")) return;
        fm.renderFiles();
        cwdEl.blur();
    }
});

// Обновление плейсхолдера при поиске
function updateSearchPlaceholder() {
    if (!cwdEl.classList.contains("search")) return;

    const hasText = cwdEl.textContent && cwdEl.textContent.length > 0;

    if (hasText) {
        cwdEl.classList.remove("searchPlaceholder");
    } else {
        cwdEl.classList.add("searchPlaceholder");
    }
}

cwdEl.addEventListener("input", updateSearchPlaceholder);
cwdEl.addEventListener("DOMSubtreeModified", updateSearchPlaceholder);

// Реализация поиска по имени файла
function searchByName() {
    if (!cwdEl.classList.contains("search")) return;
    filesView.scrollTop = 0;

    const query = (cwdEl.textContent);
    const items = filesView.querySelectorAll(".file_item");

    let hasVisible = false;

    items.forEach(item => {
        const name = (item.querySelector(".file_name")?.textContent || "");

       const match = !query || name.replace(/\u00A0/g, ' ').includes(query.replace(/\u00A0/g, ' '));

        item.style.display = match ? "" : "none";

        if (match) hasVisible = true;
    });

    const empty = document.querySelector(".file_main_empty");

    if (!hasVisible) {
        if (!empty) {
            const div = document.createElement("div");
            div.className = "file_main_empty";
            div.innerHTML = `
                <div class="file_icon_empty">🔍</div>
                <div class="file_name_empty">#{No results found}</div>
            `; 
            filesView.classList.add('empty');
            filesView.appendChild(div);
        }
    } else {
        if (empty) empty.remove();
            filesView.classList.remove('empty');
    }
}

cwdEl.addEventListener("input", searchByName);



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
 * applyViewMode — применяет текущий режим отображения файлов.
 ***************************************************************************/
applyViewMode(fm.settings.view);

fm.init();



// Правила для переименования файлов и папок
const renameRules = {
    file: {
        maxLength: 255,
        forbiddenChars: ["<", ">", ":", "\"", "/", "\\", "|", "?", "*"],
        cannotStartWith: [" ", "."],
        cannotEndWith: [" ", "."],
        other: []
    },
    folder: {
        maxLength: 255,
        forbiddenChars: ["<", ">", ":", "\"", "/", "\\", "|", "?", "*"],
        cannotStartWith: [" ", "."],
        cannotEndWith: [" ", "."],
        other: []
    }
};

// Функция для проверки валидности нового имени при переименовании
function validateRename(name, type) {
    const rule = renameRules[type];
    if (!rule) return null;

    if (name.length > rule.maxLength) {
        return "#{Name is too long}";
    }

    if (rule.forbiddenChars.some(ch => name.includes(ch))) {
        return "#{Forbidden characters}";
    }

    if (rule.cannotStartWith.some(ch => name.startsWith(ch))) {
        return "#{Invalid name beginning}";
    }

    if (rule.cannotEndWith.some(ch => name.endsWith(ch))) {
        return "#{Invalid name ending}";
    }

    if (name === "." || name === "..") {
        return "#{Invalid name}";
    }

    return null;
}


/***************************************************************************
 * ContextMenu — кастомное контекстное меню
 * - контекст определяется через handleFileClick (без изменений функции)
 * - clipboard: navigator.clipboard + fallback cookie
 ***************************************************************************/
class ContextMenu {

    /***************************************************************************
     * constructor — инициализация меню и состояния
     ***************************************************************************/
    constructor(menuId, targetId) {
        this.menu = document.getElementById(menuId);
        this.target = document.getElementById(targetId);

        this.fileName = null;

        // режим операции буфера (copy | cut)
        this.clipboardMode = "copy";

        this.propertiesManager = new FilePropertiesManager();

        this.init();
    }

    /***************************************************************************
     * init — подключение событий
     ***************************************************************************/
    init() {
        this.target.addEventListener("contextmenu", (e) => this.open(e));
        document.addEventListener("click", () => this.close());
        this.menu.addEventListener("click", (e) => this.onClick(e));
        document.addEventListener("keydown", this.onKeyDown.bind(this));
        this.initDrag();
    }

    /***************************************************************************
     * open — открытие меню и определение файла
     ***************************************************************************/
    open(e) {
        e.preventDefault();

        const item = e.target.closest(".file_item");
        const selected = getSelectedItems();

        const isSelectedItem = item && item.classList.contains("selected");
        const isMulti = selected.length > 1;

        // НЕ трогаем выделение, если уже есть мультивыделение и клик по одному из них
        if (isMulti && isSelectedItem) {
            this.fileName = item.querySelector(".file_name")?.textContent?.trim() || null;
        } else if (selected.length === 1 && isSelectedItem) {
            // если выделен один элемент и клик по нему — можно сбросить
            clearSelection();
            fm.updateCwdDisplay();
            this.fileName = null;
        } else {
            // обычный случай — обновляем через handleFileClick
            this.fileName = handleFileClick(e);
        }

        this.filterMenu();

        this.menu.style.display = "block";
        this.menu.style.left = e.pageX + 2 + "px";
        this.menu.style.top = e.pageY + 2 + "px";
    }

    /***************************************************************************
     * filterMenu — управление видимостью пунктов меню
     ***************************************************************************/
    async filterMenu() {
        const selected = getSelectedItems();
        const isMultiple = selected.length > 1;
        const context = isMultiple ? "files" : (this.fileName ? "file" : "files_view");

        const clipboard = await this.getClipboard();

        this.menu.querySelectorAll("[data-target]").forEach(item => {

            const action = item.dataset.action;

            // Для множественного выделения показываем только нужные опции
            if (context === "files") {
                if (["copy", "cut", "delete", "download"].includes(action)) {
                    item.style.display = "block";
                    return;
                }
                if (["rename", "fileProperties", "paste", "newFolder", "newFile"].includes(action)) {
                    item.style.display = "none";
                    return;
                }
            }

            if (item.dataset.target !== context) {
                item.style.display = "none";
                return;
            }

            if (action === "paste") {
                item.style.display = clipboard ? "block" : "none";
                return;
            }

            item.style.display = "block";
        });

        this.menu.querySelectorAll("[data-actionShow]").forEach(item => {
            const actions = item.getAttribute("data-actionShow").split(" ");

            const visible = actions.some(action => {
                const el = this.menu.querySelector(`[data-action="${action}"]`);
                return el && el.style.display !== "none";
            });

            item.style.display = visible ? "block" : "none";
        });
    }

    /***************************************************************************
     * close — закрытие меню
     ***************************************************************************/
    close() {
        this.menu.style.display = "none";
        this.fileName = null;
    }

    /***************************************************************************
     * onClick — обработка кликов по меню
     ***************************************************************************/
    onClick(e) {
        const action = e.target.dataset.action;

        if (action) this.handleAction(action, this.fileName, e);

        this.close();
    }

    /***************************************************************************
     * handleAction — маршрутизация действий
     ***************************************************************************/
    handleAction(action, fileName, e) {

        if (action === "newFolder") this.createFolder();
        if (action === "newFile") this.createFile();

        if (action === "copy") this.copy(fileName);
        if (action === "cut") this.cut(fileName);
        if (action === "paste") this.paste();

        if (action === "rename") this.rename(fileName);
        if (action === "fileProperties") this.propertiesManager.show(fileName, fm.cwd, fm.api);
        if (action === "delete") this.remove(fileName);
        
        if (action === "uploadFile") this.uploadFile();
        if (action === "uploadFolder") this.uploadFolder();
        if (action === "download") this.download(fileName);
    }

    /***************************************************************************
     * onKeyDown — горячие клавиши 
     ***************************************************************************/
    onKeyDown(e) {
        const selected = getSelectedItems();
        const hasSelection = selected.length > 0;

        if (e.key === "Delete") {
            e.preventDefault();
            if (hasSelection) this.remove(this.fileName);
            return;
        }

        if (e.key === "F2") {
            e.preventDefault();

            const selected = getSelectedItems();
            if (selected.length !== 1) return;

            const item = selected[0];
            const name = getItemName(item);

            this.rename(name);

            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
            e.preventDefault();
            if (hasSelection) this.copy(this.fileName);
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
            e.preventDefault();
            if (hasSelection) this.cut(this.fileName);
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
            e.preventDefault();
            this.paste();
            return;
        }
    }

    /***************************************************************************
     * setClipboard — запись пути (navigator + cookie fallback)
     ***************************************************************************/
    async setClipboard(path) {
        try {
            await navigator.clipboard.writeText(path);
            document.cookie = "clipboard=" + encodeURIComponent(path) + "; path=/";
        } catch {
            document.cookie = "clipboard=" + encodeURIComponent(path) + "; path=/";
        }
    }

    /***************************************************************************
     * getClipboard — чтение пути (navigator + cookie fallback)
     ***************************************************************************/
    async getClipboard() {
        // 1. пробуем navigator
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.length > 0) {
                return text;
            }
        } catch {}

        // 2. fallback cookie
        const match = document.cookie.match(/(?:^|;\s*)clipboard=([^;]+)/);
        if (!match) return null;

        try {
            return decodeURIComponent(match[1]);
        } catch {
            return match[1];
        }
    }

    /***************************************************************************
     * clearClipboard — очистка буфера
     ***************************************************************************/
    async clearClipboard() {
        try {
            await navigator.clipboard.writeText("");
        } catch {
            document.cookie = "clipboard=; path=/; max-age=0";
        }

        // всегда чистим cookie тоже
        document.cookie = "clipboard=; path=/; max-age=0";
    }

    /***************************************************************************
    * copy — сохранить пути в буфер (copy)
    ***************************************************************************/
    copy(fileName) {
        const selected = getSelectedItems();
        if (selected.length === 0) return;

        this.clipboardMode = "copy";

        const paths = selected.map(item => {
            const name = getItemName(item);
            return (fm.cwd === "/" ? "" : fm.cwd) + "/" + name;
        });

        this.setClipboard(paths.join("\n"));

        document.querySelectorAll(".file_item.clipboard").forEach(el => {
            el.classList.remove("clipboard");
        });
        selected.forEach(item => {
            item.classList.add("clipboard");
        });
    }

    /***************************************************************************
    * cut — сохранить пути в буфер (cut)
    ***************************************************************************/
    cut(fileName) {
        const selected = getSelectedItems();
        if (selected.length === 0) return;

        this.clipboardMode = "cut";

        const paths = selected.map(item => {
            const name = getItemName(item);
            return (fm.cwd === "/" ? "" : fm.cwd) + "/" + name;
        });

        this.setClipboard(paths.join("\n"));

        document.querySelectorAll(".file_item.clipboard").forEach(el => {
            el.classList.remove("clipboard");
        });
        selected.forEach(item => {
            item.classList.add("clipboard");
        });
    }

    /***************************************************************************
     * paste — вставка файлов (copy / cut)
     ***************************************************************************/
    async paste() {
        const clipboard = await this.getClipboard();

        if (!clipboard) return;

        const targetDir = fm.cwd;
        const srcPaths = clipboard.split("\n").filter(p => p);

        for (const src of srcPaths) {
            const name = src.split("/").pop();
            const dst = (targetDir === "/" ? "" : targetDir) + "/" + name;

            if (this.clipboardMode === "copy") {
                await fm.api.copy(src, dst);
            }

            if (this.clipboardMode === "cut") {
                await fm.api.move(src, dst);
            }
        }

        if (this.clipboardMode === "cut") {
            await this.setClipboard(srcPaths.map(p => {
                const name = p.split("/").pop();
                return (targetDir === "/" ? "" : targetDir) + "/" + name;
            }).join("\n"));
        }

        await fm.openDir(fm.cwd);
    }

    /***************************************************************************
     * remove — удаление файлов
     ***************************************************************************/
    async remove(fileName) {
        const selected = getSelectedItems();
        if (selected.length === 0) return;

        const ok = confirm(`#{Delete} ${selected.length} file(s)?`);
        if (!ok) return;

        for (const item of selected) {
            const name = getItemName(item);
            const path = (fm.cwd === "/" ? "" : fm.cwd) + "/" + name;
            await fm.api.delete(path);
        }

        await fm.openDir(fm.cwd);
    }

    /***************************************************************************
     * showPrompt — ввод значения
     ***************************************************************************/
    showPrompt(title, callback) {
        const value = prompt(title);
        if (value) callback(value);
    }

    /***************************************************************************
     * createFolder — создание папки
     ***************************************************************************/
    createFolder() {
        let name = "folder";

        const exists = (n) =>
            Array.from(document.querySelectorAll(".file_item"))
                .some(item => getItemName(item) === n);

        if (exists(name)) {
            let i = 1;
            while (exists(`${name}_${i}`)) i++;
            name = `${name}_${i}`;
        }

        const path = (fm.cwd === "/" ? "" : fm.cwd) + "/" + name;

        fm.api.mkdir(path).then(async () => {
            await fm.openDir(fm.cwd);

            let tries = 0;

            const timer = setInterval(() => {
                tries++;

                const item = Array.from(document.querySelectorAll(".file_item"))
                    .find(i => i.dataset.path.trim() === path.trim());

                if (item) {
                    clearInterval(timer);

                    item.click();

                    const e = new KeyboardEvent("keydown", {
                        key: "F2",
                        code: "F2",
                        bubbles: true
                    });

                    item.dispatchEvent(e);
                }

                if (tries >= 10) {
                    clearInterval(timer);
                }

            }, 50);
        });
    }

    /***************************************************************************
     * createFile — создание файла
     ***************************************************************************/
    createFile() {
        let name = "file";

        const exists = (n) =>
            Array.from(document.querySelectorAll(".file_item"))
                .some(item => getItemName(item) === n);

        const existsWithExt = (n) =>
            Array.from(document.querySelectorAll(".file_item"))
                .some(item => getItemName(item) === n + ".txt");

        if (existsWithExt(name)) {
            let i = 1;
            while (existsWithExt(`${name}_${i}`)) i++;
            name = `${name}_${i}`;
        }

        const path = (fm.cwd === "/" ? "" : fm.cwd) + "/" + name + ".txt";

        fm.api.upload(path, new Blob([""])).then(async () => {
            await fm.openDir(fm.cwd);

            let tries = 0;

            const timer = setInterval(() => {
                tries++;

                const item = Array.from(document.querySelectorAll(".file_item"))
                    .find(i => i.dataset.path.trim() === path.trim());

                if (!item) return;

                clearInterval(timer);

                filesView.focus();
                item.click();
                item.classList.add("selected");

                const e = new KeyboardEvent("keydown", {
                    key: "F2",
                    code: "F2",
                    bubbles: true
                });

                item.dispatchEvent(e);

            }, 50);

            setTimeout(() => clearInterval(timer), 500);
        });
    }

    /***************************************************************************
     * uploadFile — загрузка выбранных файлов на сервер
     ***************************************************************************/
    async uploadFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true; // Разрешаем выбирать много файлов через Ctrl/Shift
        input.hidden = true;
        document.body.appendChild(input);

        input.addEventListener("change", async () => {
            try {
                const files = input.files;
                if (!files || files.length === 0) return;

                const currentDir = fm.cwd === "/" ? "" : fm.cwd;

                // Перебираем и загружаем ВСЕ выбранные файлы (а не только первый [0])
                for (const file of files) {
                    const path = `${currentDir}/${file.name}`.replace(/\/+/g, "/");
                    await fm.api.upload(path, file);
                }
                
                await fm.openDir(fm.cwd);
            } catch (err) {
                console.error("Ошибка загрузки файлов:", err);
            } finally {
                input.remove();
            }
        }, { once: true });

        input.click();
    }

    /***************************************************************************
     * uploadFolder — загрузка папки с сохранением её структуры
     ***************************************************************************/
    async uploadFolder() {
        const input = document.createElement("input");
        input.type = "file";
        input.hidden = true;
        input.webkitdirectory = true; // Переключаем в режим выбора папки
        document.body.appendChild(input);

        input.addEventListener("change", async () => {
            try {
                const files = input.files;
                if (!files || files.length === 0) return;

                const currentDir = fm.cwd === "/" ? "" : fm.cwd;
                const createdDirs = new Set(); // Кэш, чтобы не плодить лишние mkdir-запросы

                for (const file of files) {
                    const relative = file.webkitRelativePath || file.name;
                    const cleanFullPath = `${currentDir}/${relative}`.replace(/\/+/g, "/");

                    // Разбираем путь, чтобы воссоздать структуру папок на сервере
                    const parts = cleanFullPath.split("/").filter(p => p);

                    // Создаем все промежуточные папки (parts.length - 1 исключает сам файл)
                    for (let i = 0; i < parts.length - 1; i++) {
                        const dirPath = "/" + parts.slice(0, i + 1).join("/");
                        
                        if (!createdDirs.has(dirPath)) {
                            try {
                                // Отрезаем ведущий слэш для API-метода mkdir
                                await fm.api.mkdir(dirPath.replace(/^\/+/, ""));
                                createdDirs.add(dirPath);
                            } catch (err) {
                                // Если папка уже создана на сервере, просто кэшируем её
                                createdDirs.add(dirPath);
                            }
                        }
                    }

                    // Теперь, когда папка точно существует, загружаем файл
                    await fm.api.upload(cleanFullPath, file);
                }

                await fm.openDir(fm.cwd);
            } catch (err) {
                console.error("Ошибка загрузки папки:", err);
            } finally {
                input.remove();
            }
        }, { once: true });

        input.click();
    }

    /***************************************************************************
     * download — скачивание файла(ов) с сервера
     ***************************************************************************/
    async download(fileName) {
        const selected = getSelectedItems();
        if (selected.length === 0) return;

        const cwd = fm.cwd || "";
        const base = cwd.startsWith("/") || cwd === "" ? cwd : `/${cwd}`;

        // Если несколько файлов - скачиваем архив
        if (selected.length > 1) {
            const paths = selected.map(item => {
                const name = getItemName(item);
                return `${base}/${name}`;
            });
            await fm.api.downloadZip(paths, "archive.zip");
            return;
        }

        // Если один файл
        const path = `${base}/${fileName}`;
        await fm.api.download(path, fileName);
    }

    /***************************************************************************
     * rename — переименование файла 
     ***************************************************************************/
    rename(fileName) {
        if (!fileName) return;

        const nameEl = Array.from(document.querySelectorAll(".file_name"))
            .find(el => el.textContent.trim() === fileName);

        if (!nameEl) return;

        const fileEl = nameEl.closest(".file_item");
        if (!fileEl) return;

        const rect = fileEl.getBoundingClientRect();

        const windowEl = document.querySelector(".renameWindow");
        const oldName = windowEl.querySelector(".renameCurrentName");
        const input = windowEl.querySelector(".renameInput");
        const btn = windowEl.querySelector(".renameBtn");
        const msg = windowEl.querySelector(".renameWindowRulesMessage");
        const closeBtn = windowEl.querySelector(".renameWindowClose");

        const oldPath = (fm.cwd === "/" ? "" : fm.cwd) + "/" + fileName;

        oldName.textContent = fileName;
        input.value = fileName;
        msg.textContent = "";

        windowEl.style.display = "flex";
        windowEl.style.position = "fixed";
        windowEl.style.left = rect.left + "px";
        windowEl.style.top = rect.bottom + 5 + "px";

        input.focus();

        const value = input.value;
        const lastDot = value.lastIndexOf(".");

        if (lastDot === -1) {
            input.setSelectionRange(0, value.length);
        } else {
            input.setSelectionRange(0, lastDot);
        }

        const getType = () => fileEl.dataset.type || "file";

        const setButtonState = (isValid) => {
            btn.disabled = !isValid;
        };

        const validate = () => {
            const error = validateRename(input.value.trim(), getType());
            msg.textContent = error || "";

            const isValid = !error && input.value.trim().length > 0;
            setButtonState(isValid);

            return isValid;
        };

        const close = () => {
            windowEl.style.display = "none";

            document.removeEventListener("mousedown", outside);
            input.removeEventListener("keydown", onKey);
            input.removeEventListener("input", onInput);
            btn.removeEventListener("click", doRename);

            closeBtn.onclick = null;
        };

        const doRename = async () => {
            const newName = input.value.trim();

            if (!newName || newName === fileName) {
                close();
                return;
            }

            if (!validate()) return;

            const newPath = (fm.cwd === "/" ? "" : fm.cwd) + "/" + newName;

            await fm.api.move(oldPath, newPath);
            await fm.openDir(fm.cwd);

            close();
        };

        const onKey = (ev) => {
            if (ev.key === "Enter") doRename();
            if (ev.key === "Escape") close();
        };

        const onInput = () => validate();

        const outside = (ev) => {
            if (!windowEl.contains(ev.target)) doRename();
        };

        btn.onclick = doRename;
        closeBtn.onclick = close;

        input.addEventListener("keydown", onKey);
        input.addEventListener("input", onInput);
        document.addEventListener("mousedown", outside);
        validate();
    }

    /***************************************************************************
     * initDrag — подключение drag логики
     ***************************************************************************/
    initDrag() {
        this.propertiesManager.initDrag();
    }
}

// Генерация уникального имени для нового файла/папки, если уже существует
function getUniqueName(baseName, existsCheck) {
    if (!existsCheck(baseName)) return baseName;

    let i = 1;
    while (existsCheck(`${baseName}_${i}`)) {
        i++;
    }

    return `${baseName}_${i}`;
}



/***************************************************************************
 * FilePropertiesManager — управление окнами свойств файлов
 ***************************************************************************/
class FilePropertiesManager {

    constructor() {
        this.zIndexBase = 2000;
        this.zIndexMax = 2999;
        this.propertiesWindows = [];
    }

    /***************************************************************************
     * show — открыть / обновить окно свойств
     ***************************************************************************/
    async show(fileName) {
        if (!fileName) return;

        const path = (fm.cwd === "/" ? "" : fm.cwd) + "/" + fileName;

        const filePropertiesContainers = document.getElementById("filePropertiesContainers");

        const existing = document.querySelector(`.fileProperties[data-path="${path}"]`);

        const info = await fm.api.head(path);

        if (existing) {
            this.update(existing, fileName, path, info);

            this.focus(existing);
            existing.style.display = "block";
            return;
        }

        const win = this.create();

        win.root.dataset.path = path;

        this.render(win, fileName, path, info);

        filePropertiesContainers.appendChild(win.root);

        this.focus(win.root);

        win.root.style.display = "block";
    }

    /***************************************************************************
     * render — отрисовка окна
     ***************************************************************************/
    render(win, fileName, path, info) {
        const isDir = info.is_dir ?? info.isDir ?? false;

        win.title.textContent = `${isDir ? "📁" : "📄"} ${fileName}`;

        win.table.innerHTML = `
            <tr>
                <td>#{Name}</td>
                <td>${fileName}</td>
            </tr>
            <tr>
                <td>#{Path}</td>
                <td>${path}</td>
            </tr>
        `;

        Object.entries(info).forEach(([key, value]) => {
            if (key === "name" || key === "path") return;

            if (key === "size") {
                win.table.innerHTML += `
                    <tr>
                        <td>#{Size}</td>
                        <td>${value} #{bytes}</td>
                    </tr>
                `;
            } else if (key === "is_dir") {
                win.table.innerHTML += `
                    <tr>
                        <td>#{Type}</td>
                        <td>${value ? "#{Folder}" : "#{File}"}</td>
                    </tr>
                `;
            } else {
                win.table.innerHTML += `
                    <tr>
                        <td>${key}</td>
                        <td>${value}</td>
                    </tr>
                `;
            }
        });
    }

    /***************************************************************************
     * update — обновление окна
     ***************************************************************************/
    update(root, fileName, path, info) {
        this.render({
            root,
            title: root.querySelector(".filePropertiesTitle"),
            table: root.querySelector("table")
        }, fileName, path, info);
    }

    /***************************************************************************
     * create — создание окна
     ***************************************************************************/
    create() {
        const template = document.querySelector("#filePropertiesContainer .fileProperties");

        const root = template.cloneNode(true);

        root.style.display = "none";
        root.dataset.path = "";
        root.style.zIndex = this.zIndexBase;

        const closeBtn = root.querySelector(".filePropertiesClose");

        closeBtn.onclick = () => {
            this.propertiesWindows = this.propertiesWindows.filter(w => w !== root);
            root.remove();
            this.normalize();
        };

        return {
            root,
            title: root.querySelector(".filePropertiesTitle"),
            table: root.querySelector("table")
        };
    }

    /***************************************************************************
     * focus — поднятие окна
     ***************************************************************************/
    focus(win) {
        this.propertiesWindows = this.propertiesWindows.filter(w => w !== win);
        this.propertiesWindows.push(win);
        this.normalize();
    }

    /***************************************************************************
     * normalize — пересчет z-index
     ***************************************************************************/
    normalize() {
        this.propertiesWindows = this.propertiesWindows.filter(w => document.body.contains(w));

        this.propertiesWindows.forEach((w, i) => {
            w.style.zIndex = Math.min(this.zIndexBase + i, this.zIndexMax);
        });
    }

    /***************************************************************************
     * initDrag — drag окон
     ***************************************************************************/
    initDrag() {
        let active = null;
        let offsetX = 0;
        let offsetY = 0;

        document.addEventListener("mousedown", (e) => {
            const win = e.target.closest(".fileProperties");
            if (!win) return;
            
            this.focus(win);

            const check = e.target.closest(".filePropertiesTop");
            if (!check) return;

            active = win;

            const computed = window.getComputedStyle(win);

            const left = parseFloat(computed.left) || win.offsetLeft;
            const top = parseFloat(computed.top) || win.offsetTop;

            offsetX = e.clientX - left;
            offsetY = e.clientY - top;

            win.style.position = "fixed";
            win.style.left = left + "px";
            win.style.top = top + "px";
            win.style.margin = "0";
        });

        document.addEventListener("mousemove", (e) => {
            if (!active) return;

            requestAnimationFrame(() => {
                if (!active) return;

                active.style.left = (e.clientX - offsetX) + "px";
                active.style.top = (e.clientY - offsetY) + "px";
            });

            document.getSelection().removeAllRanges();
        });

        document.addEventListener("mouseup", () => {
            active = null;
        });
    }
}

/***************************************************************************
 * Инициализация FilePropertiesManager
 ***************************************************************************/
const filePropertiesManager = new FilePropertiesManager();

/***************************************************************************
 * Инициализация ContextMenu
 * - меню файлового менеджера
 * - обработка правого клика по файлам/папкам
 * - filePropertiesManager отвечает за окна свойств
 ***************************************************************************/
const contextMenuInstance = new ContextMenu(
    "contextMenu",
    "files_view",
    filePropertiesManager
);