const cwdEl = document.getElementById('cwd');
const mainEl = document.getElementById('main');
const filesTable = document.getElementById('files');
const tbody = document.querySelector('#files tbody');
const closeBtn = document.getElementById('closeBtn');
closeBtn.addEventListener('click', () => {
    const fm = document.getElementById("fManager");
    if (fm) fm.remove();
    document.querySelectorAll('[data-dynamic="fManager"]').forEach(el => el.remove());
});
let cwd = '/';
let viewMode = 'table';

function applyViewMode() {
    document.body.className =
        document.body.className.replace(/\bview-\w+/g, '');

    document.body.classList.add('view-' + viewMode);
    renderFiles();
}


const fburger = document.getElementById('fburger');
const fburgerMenu = document.getElementById('fburgerMenu');

// открыть / закрыть меню
fburger.addEventListener('click', e => {
    e.stopPropagation();
    fburger.classList.toggle('open');
});

// клик вне меню — закрыть
document.addEventListener('click', () => {
    fburger.classList.remove('open');
});

fburgerMenu.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', e => {
        e.stopPropagation(); // ⬅ ВАЖНО

        viewMode = item.dataset.view;
        applyViewMode();
        list(cwd);

        fburger.classList.remove('open');
    });
});

let currentFiles = [];

async function list(path) {
    const urlPath = path === '/' ? '' : path;
    const res = await fetch(`/api/files${urlPath}`);
    if (!res.ok) return alert('Ошибка списка файлов');

    currentFiles = await res.json();

    cwd = path;
    cwdEl.textContent = cwd;
    //console.log(currentFiles)
    currentFiles.sort((a, b) => {
        // сначала папки
        if (a.isDir !== b.isDir) {
            return b.isDir - a.isDir;
        }

        // затем по имени
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });   
    renderFiles();
}

// function renderFiles() {
//     const container = files_view;
//     container.innerHTML = '';

//     if (viewMode === 'table') {
//         renderTable(container);
//     } else if (viewMode === 'columns') {
//         renderColumns(container);
//     } else if (viewMode === 'tiles') {
//         renderTiles(container);
//     }
// }

function renderFiles() {
  const container = document.getElementById('files_view');
  container.innerHTML = '';

  currentFiles.forEach(f => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.path = (cwd === '/' ? '' : cwd) + '/' + f.name;

    const icon = f.isDir ? '📁' : '📄';
    const nameEsc = escapeHtml(f.name);

    item.innerHTML = `
        <div class="file-icon">${icon}</div>
        <div class="file-name">${nameEsc}</div>
        ${viewMode === 'table' ? `<div>${f.size || '—'}</div><div>${f.modTime || ''}</div>` : ''}
    `;

    item.ondblclick = () => {
      const path = (cwd === '/' ? '' : cwd) + '/' + f.name;
      f.isDir ? list(path) : downloadFile(path);
    };

    container.appendChild(item);
  });
}


function renderTable(container) {
    const table = document.createElement('table');
     table.innerHTML = `
         <tbody></tbody>
     `;
    const tbody = table.querySelector('tbody');

    currentFiles.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${f.isDir ? '📁' : '📄'} ${escapeHtml(f.name)}</td>
            <td>${f.isDir ? '—' : f.size}</td>
            <td>${f.modTime || ''}</td>
        `;
        tr.ondblclick = () => f.isDir ? list(cwd + '/' + f.name) : downloadFile(cwd + '/' + f.name);
        tbody.appendChild(tr);
    });

    container.appendChild(table);
}

function renderColumns(container) {
    const cols = document.createElement('div');
    cols.className = 'files-columns';

    currentFiles.forEach(f => {
        const icon = f.isDir ? '📁' : '📄';
        const nameEsc = escapeHtml(f.name);
        const fullPath = (cwd === '/' ? '' : cwd) + '/' + f.name;

        const item = document.createElement('div');
        item.className = 'col-item';
        item.innerHTML = `
            <div class="icon">${icon}</div>
            <div class="name">${nameEsc}</div>
        `;

        item.ondblclick = () => {
            if (f.isDir) list(fullPath);
            else downloadFile(fullPath);
        };

        cols.appendChild(item);
    });

    container.appendChild(cols);
}

function renderTiles(container) {
    // Очищаем контейнер перед добавлением
    container.innerHTML = '';

    const tiles = document.createElement('div');
    tiles.className = 'files-tiles';

    currentFiles.forEach(f => {
        const icon = f.isDir ? '📁' : '📄';
        const nameEsc = escapeHtml(f.name);
        const fullPath = (cwd === '/' ? '' : cwd) + '/' + f.name;

        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.path = fullPath;

        tile.innerHTML = `
            <div class="tile-icon">${icon}</div>
            <div class="tile-name">${nameEsc}</div>
        `;

        tile.ondblclick = () => {
            if (f.isDir) list(fullPath);
            else downloadFile(fullPath);
        };

        tiles.appendChild(tile);
    });

    container.appendChild(tiles);
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


applyViewMode();
list('/');



function listTfoot(act) {
    const toolbarBottom = document.getElementById('toolbarBottom');
    toolbarBottom.style.display = '';

    const closeBtn = document.getElementById('closeBtn');
    closeBtn.onclick = () => {
        window.listTfootAct = "";
    };

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
}