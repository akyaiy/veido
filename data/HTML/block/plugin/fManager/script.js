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

// --- чекбоксы ---
const chkFoldersFirst = document.getElementById('sortFoldersFirst');
const chkShowHidden = document.getElementById('showHidden');

closeBtn.addEventListener('click', () => {
    window.listTfootAct = "";
    const fm = document.getElementById("fManager");
    if (fm) fm.remove();
    document.querySelectorAll('[data-dynamic="fManager"]').forEach(el => el.remove());
});
let cwd = '/';
let viewMode = 'table';
let currentSort = 'name'; // name | size | date
let sortFoldersFirst = false;
let showHidden = false;
let currentFiles = [];

const settings = {
    sort: 'name',
    foldersFirst: false,
    showHidden: false,
    view: 'table'
};


const saved = getCookie('fm_settings');
if (saved) {
    try {
        Object.assign(settings, JSON.parse(decodeURIComponent(saved)));
    } catch {}
}

chkFoldersFirst.checked = settings.foldersFirst;
chkShowHidden.checked = settings.showHidden;

// --- сортировка ---
currentSort = settings.sort;
document.querySelector(`input[name="sort"][value="${settings.sort}"]`)?.click();



sortFoldersFirst = settings.foldersFirst;
showHidden = settings.showHidden;


viewMode = settings.view || 'table';


// открыть / закрыть меню
fburger.addEventListener('click', e => {
    e.stopPropagation();
    fburger.classList.toggle('open');
});

// клик вне меню — закрыть
document.addEventListener('click', () => {
    fburger.classList.remove('open');
});

const filesView = document.getElementById('files_view');

const VIEW_CLASSES = {
    table: 'view_table',
    columns: 'view_list',
    tiles: 'view_tiles'
};

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

async function list(path) {
    const urlPath = path === '/' ? '' : path;
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


function renderFiles() {
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

  if (window.listTfootAct) {
    listTfoot(window.listTfootAct);
  } else {
    const toolbarBottom = document.getElementById('toolbarBottom');
    toolbarBottom.style.display = 'none';
  }
}

function listTfoot(act) {
    const toolbarBottom = document.getElementById('toolbarBottom');
    toolbarBottom.style.display = '';
    
    if (act === 'loadBlock') {
        const bottomBtn = document.getElementById('bottomBtn');
        bottomBtn.onclick = () => loadBlockBottomBtn();
    }
}

function loadBlockBottomBtn() {
    const input = document.getElementById('bottomInput');
    let path = cwd + '/' + input.value;
    path = path.replace(/^\/data\/HTML\/block\//, ''); 
    window.newLoadedBlock(path);
    closeBtn.click();
}

class FilesApiClient {
  constructor(baseUrl = '/api/files') {
    this.baseUrl = baseUrl;
  }

  // --- Список файлов/папок ---
  async list(path = '') {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error listing files: ${res.statusText}`);
    return res.json(); // возвращает массив {name, isDir, size, modTime}
  }

  // --- Получение содержимого файла ---
  async getFile(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error getting file: ${res.statusText}`);
    return res.text(); // для бинарных файлов можно использовать res.arrayBuffer()
  }

  // --- HEAD: метаинформация ---
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

  // --- Загрузка файла ---
  async upload(path, file) {
    const url = `${this.baseUrl}/${path}`;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(url, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Error uploading file: ${res.statusText}`);
    return true;
  }

  // --- Создание папки ---
  async mkdir(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error(`Error creating folder: ${res.statusText}`);
    return true;
  }

  // --- Полная замена файла ---
  async put(path, content) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { method: 'PUT', body: content });
    if (!res.ok) throw new Error(`Error updating file: ${res.statusText}`);
    return true;
  }

  // --- Частичное обновление файла ---
  async patch(path, content) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { method: 'PATCH', body: content });
    if (!res.ok) throw new Error(`Error patching file: ${res.statusText}`);
    return true;
  }

  // --- Удаление файла или папки ---
  async delete(path) {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Error deleting: ${res.statusText}`);
    return true;
  }

  // --- Копирование файла ---
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

  // --- Перемещение файла ---
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

  // --- Загрузка части файла (Range) ---
  async getRange(path, start = 0, end = null) {
    const url = `${this.baseUrl}/${path}`;
    const headers = {};
    if (end !== null) headers['Range'] = `bytes=${start}-${end}`;
    const res = await fetch(url, { headers });
    if (!res.ok && res.status !== 206) throw new Error(`Error fetching range: ${res.statusText}`);
    return res.arrayBuffer();
  }

  // --- Поиск файлов с фильтром ---
  async search(path = '', query = {}) {
    const params = new URLSearchParams(query);
    const url = `${this.baseUrl}/${path}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error searching files: ${res.statusText}`);
    return res.json();
  }
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const btnUp = document.getElementById('btnUp');

btnUp.addEventListener('click', () => {
    if (cwd === '/' || !cwd) return;

    const parts = cwd.split('/').filter(Boolean);
    parts.pop(); // убрать текущий каталог

    const parent = '/' + parts.join('/');
    list(parent === '' ? '/' : parent);
});


cwdEl.contentEditable = "true";
cwdEl.spellcheck = false;

let cwdEditBackup = "";

cwdEl.addEventListener('focus', () => {
    cwdEditBackup = cwd;
    cwdEl.classList.add('editing');
    cwdEl.textContent = cwd;
});

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

cwdEl.addEventListener('blur', () => {
    cwdEl.classList.remove('editing');
    cwdEl.textContent = cwd;
});

//applyViewMode("table");
//list('/');

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

// Скрыть все подменю и снять активные состояния
function hideSubmenus() {
  submenus.forEach(sm => sm.style.display = 'none');
  menuItems.forEach(mi => mi.classList.remove('active'));
  fburger.classList.remove('open');
}

// Показ подменю при наведении на пункт главного меню
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

// Скрывать меню, если мышь не над fburger или подменю
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

document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', () => {
        currentSort = radio.value;
        sortFiles();
        renderFiles();
    });
});



chkFoldersFirst.addEventListener('change', () => {
    sortFoldersFirst = chkFoldersFirst.checked;
    sortFiles();
    renderFiles();
});

chkShowHidden.addEventListener('change', () => {
    showHidden = chkShowHidden.checked;
    renderFiles();
});




// --- режим просмотра ---
//viewMode = settings.view;
//applyViewMode(viewMode);

document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', () => {
        currentSort = radio.value;
        settings.sort = radio.value;

        sortFiles();
        renderFiles();

        saveSettings();
    });
});




sortFoldersFirst = settings.foldersFirst;
showHidden = settings.showHidden;


chkFoldersFirst.addEventListener('change', () => {
    sortFoldersFirst = chkFoldersFirst.checked;
    settings.foldersFirst = sortFoldersFirst;

    sortFiles();
    renderFiles();
    saveSettings();
});

chkShowHidden.addEventListener('change', () => {
    showHidden = chkShowHidden.checked;
    settings.showHidden = showHidden;

    renderFiles();
    saveSettings();
});

function saveSettings() {
    setCookie('fm_settings', JSON.stringify(settings));
}

fburger.addEventListener('click', e => {
    e.stopPropagation();
    fburgerMenu.style.display = fburgerMenu.style.display === 'block' ? 'none' : 'block';
});

// клик вне меню закрывает
document.addEventListener('click', () => {
    fburgerMenu.style.display = 'none';
});

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


applyViewMode(viewMode);

list('/');
