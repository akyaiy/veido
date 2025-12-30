/***********************************************************************
 * Элементы интерфейса файлового менеджера.
 **********************************************************************/
const cwdEl = document.getElementById('cwd');
const mainEl = document.getElementById('main');
const filesTable = document.getElementById('files');
const tbody = document.querySelector('#files tbody');
const closeBtn = document.getElementById('closeBtn');
const fburger = document.getElementById('fburger');
const fburgerMenu = document.getElementById('fburgerMenu');
const fburgerMenuEl = document.getElementById('fburgerMenu');
const menuItems = fburgerMenuEl.querySelectorAll('#fburgerMenu > .menu_item');
const submenus = fburgerMenuEl.querySelectorAll('.submenu');

/***********************************************************************
 * Чекбоксы управления списком файлов.
 **********************************************************************/
const chkFoldersFirst = document.getElementById('sortFoldersFirst');
const chkShowHidden = document.getElementById('showHidden');

/***************************************************************************
 * closeBtn click — закрывает окно файлового менеджера:
 * - Сбрасывает активное состояние панели.
 * - Удаляет окно файлового менеджера со страницы.
 * - Удаляет связанные динамические стили и скрипты.
 ***************************************************************************/
closeBtn.addEventListener('click', () => {
    /* window.listTfootAct = ""; */
    const fm = document.getElementById("fManager");
    if (fm) fm.remove();
    document.querySelectorAll('[data-dynamic="fManager"]').forEach(el => el.remove());
});

/***********************************************************************
 * Текущее состояние файлового менеджера.
 **********************************************************************/
let cwd = '/';
let viewMode = 'table';
let currentSort = 'name'; // name | size | date
let sortFoldersFirst = false;
let showHidden = false;
let currentFiles = [];

/***********************************************************************
 * Пользовательские настройки файлового менеджера.
 **********************************************************************/
const settings = {
    sort: 'name',
    foldersFirst: false,
    showHidden: false,
    view: 'table'
};

/***********************************************************************
 * Загрузка сохранённых настроек файлового менеджера из cookie.
 **********************************************************************/
const saved = getCookie('fm_settings');
if (saved) {
    try {
        Object.assign(settings, JSON.parse(decodeURIComponent(saved)));
    } catch {}
}
chkFoldersFirst.checked = settings.foldersFirst;
chkShowHidden.checked = settings.showHidden;

/***********************************************************************
 * Применение сохранённых настроек к текущему состоянию и интерфейсу.
 **********************************************************************/
currentSort = settings.sort;
document.querySelector(`input[name="sort"][value="${settings.sort}"]`)?.click();

sortFoldersFirst = settings.foldersFirst;
showHidden = settings.showHidden;
viewMode = settings.view || 'table';




/***************************************************************************
 * fburger click — переключает состояние главного меню файлового менеджера.
 ***************************************************************************/
fburger.addEventListener('click', e => {
    e.stopPropagation();
    fburger.classList.toggle('open');
});

/***************************************************************************
 * document click — закрывает меню файлового менеджера.
 ***************************************************************************/
document.addEventListener('click', () => {
    fburger.classList.remove('open');
});

/***********************************************************************
 * Контейнер отображения списка файлов.
 **********************************************************************/
const filesView = document.getElementById('files_view');

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

// fburgerMenu.querySelectorAll('[data-view]').forEach(item => {
//     item.addEventListener('click', e => {
//         e.stopPropagation();

//         const view = item.dataset.view;
//         applyViewMode(view);
//         saveSettings();

//         fburger.classList.remove('open');
//     });
// });

/***************************************************************************
 * fburgerMenu item click — изменяет режим отображения списка файлов:
 * - Обновляет текущий режим отображения.
 * - Применяет режим и перерисовывает список файлов.
 * - Сохраняет выбранный режим в настройках и закрывает меню.
 ***************************************************************************/
fburgerMenu.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', e => {
        e.stopPropagation();

        viewMode = item.dataset.view;
        settings.view = viewMode;   // сохраняем в settings
        applyViewMode(viewMode);
        renderFiles();
        saveSettings();

        fburgerMenu.style.display = 'none';
    });
});


// function sortFiles() {
//     currentFiles.sort((a, b) => {
//         // папки всегда сверху
//         if (a.isDir !== b.isDir) {
//             return b.isDir - a.isDir;
//         }

//         switch (currentSort) {
//             case 'size':
//                 return (a.size || 0) - (b.size || 0);

//             case 'date':
//                 return new Date(a.modTime || 0) - new Date(b.modTime || 0);

//             case 'name':
//             default:
//                 return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
//         }
//     });
// }

/***************************************************************************
 * sortFiles — сортирует список файлов:
 * - При включённой опции поднимает папки выше файлов.
 * - Сортирует по имени размеру или дате в зависимости от выбранного режима.
 * - Обновляет порядок элементов в списке.
 ***************************************************************************/
function sortFiles() {
    currentFiles.sort((a, b) => {

        // папки вверх ТОЛЬКО если включено
        if (sortFoldersFirst && a.isDir !== b.isDir) {
            return b.isDir - a.isDir;
        }

        if (currentSort === 'size') {
            return (a.size || 0) - (b.size || 0);
        }

        if (currentSort === 'date') {
            return new Date(a.modTime || 0) - new Date(b.modTime || 0);
        }

        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    });
}

/***************************************************************************
 * list — загружает и отображает содержимое каталога:
 * - Принимает путь к каталогу.
 * - Запрашивает список файлов с сервера.
 * - При ошибке загрузки показывает сообщение об ошибке.
 * - Обновляет текущий путь и его отображение.
 * - Сортирует и перерисовывает список файлов.
 ***************************************************************************/
async function list(path) {
    let urlPath = path;
    if (storeFManager?.[0]?.path) {
        urlPath = storeFManager[0].path;
        path = storeFManager[0].path;
        storeFManager[0].path = null;
    } else if (path === '/') {
        urlPath = '';
    }

    const res = await fetch(`/api/files${urlPath}`);
    if (!res.ok) return alert('Ошибка списка файлов');

    currentFiles = await res.json();

    cwd = path;
    //cwdEl.textContent = cwd;
    updateCwdDisplay();
    // //console.log(currentFiles)
    // currentFiles.sort((a, b) => {
    //     // сначала папки
    //     if (a.isDir !== b.isDir) {
    //         return b.isDir - a.isDir;
    //     }

    //     // затем по имени
    //     return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    //     });   
    sortFiles();
    renderFiles();
}

// filesView.addEventListener('click', (e) => {
//     const item = e.target.closest('.file_item');
//     //console.log(e.target)
//     if (!item || e.target == filesView){
//         filesView.querySelectorAll('.file_item.selected')
//             .forEach(el => el.classList.remove('selected'));
//         return;
//     }
//     if (!item) return;


//     // если клик по уже выбранному — снять выделение
//     if (item.classList.contains('selected')) {
//         item.classList.remove('selected');
//         return;
//     }

//     // if(document.getElementById('files_view')){

//     // }

//     // снять выделение со всех остальных
//     filesView.querySelectorAll('.file_item.selected')
//         .forEach(el => el.classList.remove('selected'));

//     // выделить текущий
//     item.classList.add('selected');
// });

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
        updateCwdDisplay(); // сброс серого пути
        return;
    }

    if (item.classList.contains('selected')) {
        item.classList.remove('selected');
        updateCwdDisplay(); // убрали выделение
        return;
    }

    filesView.querySelectorAll('.file_item.selected')
        .forEach(el => el.classList.remove('selected'));

    item.classList.add('selected');

    const name = item.querySelector('.file_name')?.textContent;
    if (name) {
        updateCwdDisplay(name);
    }
});




/***************************************************************************
 * renderFiles — отрисовка списка файлов в текущем режиме отображения:
 * - Очищает контейнер списка файлов.
 * - Добавляет заголовок таблицы при режиме "table".
 * - Фильтрует скрытые файлы в зависимости от настроек.
 * - Формирует элементы файлов и папок с учётом режима отображения.
 * - Назначает обработчик двойного клика для открытия или скачивания.
 * - Управляет отображением нижней панели действий.
 ***************************************************************************/
async function renderFiles() {
  const container = document.getElementById('files_view');
  container.innerHTML = '';

  // Если режим "table", добавляем заголовок первой строкой
  if (viewMode === 'table') {
    const header = document.createElement('div');
    header.id = 'files_header';
    //header.classList.add("file_item");
    header.innerHTML = `
      <div>Имя</div>
      <div>Размер</div>
      <div>Дата</div>
    `;
    container.appendChild(header);
  }

  // Рендерим файлы
//   currentFiles.forEach(f => {
    currentFiles
    .filter(f => showHidden || !f.name.startsWith('.'))
    .forEach(f => {
    const item = document.createElement('div');
    item.className = 'file_item';
    item.dataset.path = (cwd === '/' ? '' : cwd) + '/' + f.name;

    const icon = f.isDir ? '📁' : '📄';
    const nameEsc = escapeHtml(f.name);

    item.innerHTML = `
      <div class="file_main">  <!--ОДНА колонка -->
        <div class="file_icon">${icon}</div>
        <div class="file_name">${nameEsc}</div>
      </div>
      ${viewMode === 'table' ? `<div>${f.size || '—'}</div><div>${f.modTime || ''}</div>` : ''}
    `;

    item.ondblclick = () => {
      const path = (cwd === '/' ? '' : cwd) + '/' + f.name;
      f.isDir ? list(path) : downloadFile(path);
    };

    container.appendChild(item);
  });

  const act = storeFManager?.[0]?.listTfootAct ?? null;
  if (act) {
    listTfoot(act);
  } else {
    const toolbarBottom = document.getElementById('toolbarBottom');
    toolbarBottom.style.display = 'none';
  }
}

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
        bottomBtn.onclick = () => loadBlockBottomBtn();
    }
}

/***************************************************************************
 * loadBlockBottomBtn — загрузка блока из нижней панели:
 * - Формирование пути по текущему каталогу и вводу пользователя.
 * - Загрузка блока.
 * - Закрытие файлового менеджера.
 ***************************************************************************/
async function loadBlockBottomBtn() {
    const input = document.getElementById('bottomInput');
    let path = cwd + '/' + input.value;
    path = path.replace(/^\/data\/HTML\/block\//, ''); 
    await tempStore.store({path: path}, { recipient: storeFManager[0].sender, ttlMs: 5000, destroyOnRead: true })
    closeBtn.click();
}

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

/***************************************************************************
 * list — получение списка файлов и папок:
 * - Принимает путь к каталогу относительно базового пути.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает массив объектов с метаданными файлов.
 ***************************************************************************/
  async list(path = '') {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error listing files: ${res.statusText}`);
    return res.json(); // возвращает массив {name, isDir, size, modTime}
  }

/***************************************************************************
 * getFile — получение содержимого файла:
 * - Принимает путь к файлу относительно базового пути.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает содержимое файла в текстовом виде.
 ***************************************************************************/
  async getFile(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error getting file: ${res.statusText}`);
    return res.text(); // для бинарных файлов можно использовать res.arrayBuffer()
  }

/***************************************************************************
 * head — получение метаинформации файла:
 * - Принимает путь к файлу относительно базового пути.
 * - Выполняет HEAD-запрос без загрузки содержимого.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает размер, дату изменения и тип содержимого.
 ***************************************************************************/
  async head(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`Error fetching metadata: ${res.statusText}`);
    return {
      size: res.headers.get('Content-Length'),
      lastModified: res.headers.get('Last-Modified'),
      contentType: res.headers.get('Content-Type')
    };
  }

/***************************************************************************
 * upload — загрузка файла:
 * - Принимает путь назначения и файл для загрузки.
 * - Отправляет файл на сервер с использованием FormData.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат загрузки.
 ***************************************************************************/
  async upload(path, file) {
    const url = `${this.baseUrl}/${path}`;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(url, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Error uploading file: ${res.statusText}`);
    return true;
  }

/***************************************************************************
 * mkdir — создание папки:
 * - Принимает путь создаваемой папки.
 * - Отправляет запрос на создание папки.
 * - При неуспешном ответе сервера выбрасывает ошибку.
 * - Возвращает успешный результат операции.
 ***************************************************************************/
  async mkdir(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { method: 'POST' });
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
    const res = await fetch(url, { method: 'PUT', body: content });
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
    const res = await fetch(url, { method: 'PATCH', body: content });
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
    const res = await fetch(url, { method: 'DELETE' });
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
    const res = await fetch(url, {
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
    const res = await fetch(url, {
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
    const res = await fetch(url, { headers });
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
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error searching files: ${res.statusText}`);
    return res.json();
  }
}

/***************************************************************************
 * escapeHtml — экранирование HTML-символов для безопасного вывода текста.
 ***************************************************************************/
function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


/***************************************************************************
 * btnUp — кнопка перехода в родительский каталог.
 ***************************************************************************/
const btnUp = document.getElementById('btnUp');
/***************************************************************************
 * btnUp click — переход в родительский каталог:
 * - Проверяет возможность перехода выше корневого каталога.
 * - Определяет путь родительского каталога.
 * - Загружает содержимое родительского каталога.
 ***************************************************************************/
btnUp.addEventListener('click', () => {
    if (cwd === '/' || !cwd) return;

    const parts = cwd.split('/').filter(Boolean);
    parts.pop(); // убрать текущий каталог

    const parent = '/' + parts.join('/');
    list(parent === '' ? '/' : parent);
});


/***************************************************************************
 * cwdEl — включение редактирования и отключение проверки орфографии.
 ***************************************************************************/
cwdEl.contentEditable = "true";
cwdEl.spellcheck = false;

/***************************************************************************
 * cwdEditBackup — временное хранение пути при редактировании.
 ***************************************************************************/
let cwdEditBackup = "";

/***************************************************************************
 * cwdEl focus — начало редактирования текущего пути:
 * - Сохраняет текущий путь для возможной отмены.
 * - Включает визуальный режим редактирования.
 * - Отображает текущий путь в поле ввода.
 ***************************************************************************/
cwdEl.addEventListener('focus', () => {
    cwdEditBackup = cwd;
    cwdEl.classList.add('editing');
    cwdEl.textContent = cwd;
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

        list(path);
        cwdEl.blur();
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        cwdEl.textContent = cwdEditBackup;
        cwdEl.blur();
    }
});

/***************************************************************************
 * cwdEl blur — завершение редактирования пути:
 * - Отключает режим редактирования.
 * - Возвращает отображение текущего пути.
 ***************************************************************************/
cwdEl.addEventListener('blur', () => {
    cwdEl.classList.remove('editing');
    cwdEl.textContent = cwd;
});

//applyViewMode("table");
//list('/');

/***************************************************************************
 * updateCwdDisplay — обновление отображения текущего пути:
 * - Очищает текущее содержимое строки пути.
 * - Отображает базовый текущий каталог.
 * - При наличии выбранного элемента добавляет выделенный суффикс пути.
 ***************************************************************************/
function updateCwdDisplay(selectedName = null) {
    cwdEl.innerHTML = '';

    const base = document.createElement('span');
    base.className = 'cwd-base';
    base.textContent = cwd;
    cwdEl.appendChild(base);

    if (selectedName) {
        const suffix = document.createElement('span');
        suffix.className = 'cwd-selected';
        suffix.textContent =
            (cwd.endsWith('/') ? '' : '/') + selectedName;
        cwdEl.appendChild(suffix);
    }
}


// const menuItems = document.querySelectorAll('#fburgerMenu .menu-item');
// const submenus = document.querySelectorAll('#fburgerMenu .submenu');

// function hideSubmenus() {
//   submenus.forEach(sm => sm.style.display = 'none');
//   menuItems.forEach(mi => mi.classList.remove('active'));
// }

// menuItems.forEach(item => {
//   item.addEventListener('mouseenter', () => {
//     hideSubmenus();

//     const id = item.dataset.submenu;
//     const submenu = document.getElementById('submenu-' + id);

//     if (submenu) {
//       item.classList.add('active');
//       submenu.style.display = 'block';
//       submenu.style.top = item.offsetTop + 'px';
//     }
//   });
// });

// document.getElementById('fburgerMenu')
//   .addEventListener('mouseleave', hideSubmenus);

//const fburger = document.getElementById('fburger');

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
//applyViewMode();

/***************************************************************************
 * document radio change — изменение режима сортировки:
 * - Обновляет текущий параметр сортировки.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', () => {
        currentSort = radio.value;
        sortFiles();
        renderFiles();
    });
});




/***************************************************************************
 * chkFoldersFirst change — переключение приоритета папок:
 * - Обновляет настройку отображения папок.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
chkFoldersFirst.addEventListener('change', () => {
    sortFoldersFirst = chkFoldersFirst.checked;
    sortFiles();
    renderFiles();
});

/***************************************************************************
 * chkShowHidden change — переключение отображения скрытых файлов:
 * - Обновляет настройку показа скрытых файлов.
 * - Перерисовывает список файлов.
 ***************************************************************************/
chkShowHidden.addEventListener('change', () => {
    showHidden = chkShowHidden.checked;
    renderFiles();
});


// --- режим просмотра ---
//viewMode = settings.view;
//applyViewMode(viewMode);

/***************************************************************************
 * document radio change — изменение и сохранение режима сортировки:
 * - Обновляет текущий параметр сортировки.
 * - Сохраняет выбранный режим в настройках.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', () => {
        currentSort = radio.value;
        settings.sort = radio.value;

        sortFiles();
        renderFiles();

        saveSettings();
    });
});




/***************************************************************************
 * Инициализация параметров сортировки и отображения из настроек.
 ***************************************************************************/
sortFoldersFirst = settings.foldersFirst;
showHidden = settings.showHidden;


/***************************************************************************
 * chkFoldersFirst change — переключение приоритета папок и сохранение настройки:
 * - Обновляет параметр приоритета папок.
 * - Сохраняет значение в настройках.
 * - Пересортировывает список файлов.
 * - Перерисовывает отображение файлов.
 ***************************************************************************/
chkFoldersFirst.addEventListener('change', () => {
    sortFoldersFirst = chkFoldersFirst.checked;
    settings.foldersFirst = sortFoldersFirst;

    sortFiles();
    renderFiles();
    saveSettings();
});

/***************************************************************************
 * chkShowHidden change — переключение показа скрытых файлов и сохранение настройки:
 * - Обновляет параметр отображения скрытых файлов.
 * - Сохраняет значение в настройках.
 * - Перерисовывает список файлов.
 ***************************************************************************/
chkShowHidden.addEventListener('change', () => {
    showHidden = chkShowHidden.checked;
    settings.showHidden = showHidden;

    renderFiles();
    saveSettings();
});

/***************************************************************************
 * saveSettings — сохранение текущих настроек в cookie.
 ***************************************************************************/
function saveSettings() {
    setCookie('fm_settings', JSON.stringify(settings));
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
applyViewMode(viewMode);

/***************************************************************************
 * init — загружает содержимое корневого каталога.
 ***************************************************************************/
async function init() {
    storeFManager = await tempStore.getByRecipient("fManager");
    list('/');
}
let storeFManager = "";
init();