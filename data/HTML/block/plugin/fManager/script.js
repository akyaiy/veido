
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

function ensureContainers() {
    let tiles = document.getElementById('files_tiles');
    let cols = document.getElementById('files_columns');
    if (!tiles) {
        tiles = document.createElement('div');
        tiles.id = 'files_tiles';
        tiles.style.display = 'none';
        tiles.style.gridTemplateColumns = 'repeat(auto-fill,minmax(120px,1fr))';
        tiles.style.gap = '12px';
        tiles.style.padding = '8px';
        mainEl.appendChild(tiles);
    }
    if (!cols) {
        cols = document.createElement('div');
        cols.id = 'files_columns';
        cols.style.display = 'none';
        cols.style.padding = '4px';
        cols.style.columnWidth = '220px';
        cols.style.columnGap = '12px';
        cols.style.columnFill = 'auto';
        cols.style.height = 'calc(100vh - 200px)';
        cols.style.overflowY = 'hidden';
        cols.style.overflowX = 'auto';
        cols.style.width = '100%';
        mainEl.appendChild(cols);
    }
}

function applyViewMode() {
    ensureContainers();
    const tiles = document.getElementById('files_tiles');
    const cols = document.getElementById('files_columns');
    document.body.classList.remove('view-tiles', 'view-columns', 'view-table');
    if (viewMode === 'tiles') {
        document.body.classList.add('view-tiles');
        filesTable.style.display = 'none';
        cols.style.display = 'none';
        tiles.style.display = 'grid';
        tiles.style.gridTemplateColumns = 'repeat(auto-fill,minmax(100px,1fr))';
        tiles.style.gap = '10px';
    } else if (viewMode === 'columns') {
        document.body.classList.add('view-columns');
        filesTable.style.display = 'none';
        tiles.style.display = 'none';
        cols.style.display = '';
        cols.style.columnWidth = '220px';
        cols.style.columnGap = '12px';
        cols.style.columnFill = 'auto';
        cols.style.height = 'calc(100% - 8px)';
        cols.style.overflowY = 'hidden';
        cols.style.overflowX = 'auto';
        cols.style.width = '100%';
    } else {
        document.body.classList.add('view-table');
        filesTable.style.display = '';
        tiles.style.display = 'none';
        cols.style.display = 'none';
    }
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



async function list(path) {
    let data;
    try {
        const urlPath = path === '/' ? '' : path;
        const res = await fetch(`/api/files${urlPath}`);
        if (!res.ok) {
            alert('Ошибка списка файлов');
            return;
        }
        data = await res.json();
    } catch (err) {
        console.error('Ошибка списка файлов', err);
        return;
    }

    cwd = path;
    cwdEl.textContent = cwd;

    ensureContainers();

    const tiles = document.getElementById('files_tiles');
    const cols = document.getElementById('files_columns');

    tbody.innerHTML = '';
    tiles.innerHTML = '';
    cols.innerHTML = '';

    data.sort((a, b) =>
        a.isDir === b.isDir ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1)
    );

    for (const f of data) {
        const icon = f.isDir ? '📁' : '📄';
        const nameEsc = escapeHtml(f.name);
        const fullPath = (cwd === '/' ? '' : cwd) + '/' + f.name;

        const openItem = () => {
            if (f.isDir) list(fullPath);
            else downloadFile(fullPath);
        };

        // ----- TABLE VIEW -----
        if (viewMode === 'table') {
            const tr = document.createElement('tr');
            tr.className = 'file-row';
            tr.innerHTML = `
                <td class="file-name"><span class="icon">${icon}</span> ${nameEsc}</td>
                <td>${f.isDir ? '—' : f.size}</td>
                <td>${f.modTime || ''}</td>
            `;
            tr.ondblclick = openItem;
            tbody.appendChild(tr);
        }

        // ----- COLUMNS VIEW -----
        else if (viewMode === 'columns') {
            const item = document.createElement('div');
            item.className = 'col-item';
            item.innerHTML = `
                <div class="icon">${icon}</div>
                <div class="name">${nameEsc}</div>
            `;
            item.ondblclick = openItem;
            cols.appendChild(item);
        }

        // ----- TILES VIEW -----
        else if (viewMode === 'tiles') {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.innerHTML = `
                <div class="tile-icon">${icon}</div>
                <div class="tile-name">${nameEsc}</div>
            `;
            tile.ondblclick = openItem;
            tiles.appendChild(tile);
        }
    }

    const toolbarBottom = document.getElementById('toolbarBottom');
    toolbarBottom.style.display = 'none';

    if (window.listTfootAct) {
        listTfoot(window.listTfootAct);
    }
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

// // --- Пример использования ---
// (async () => {
//   const client = new FilesApiClient();

//   // Получение списка файлов
//   const files = await client.list('docs');
//   console.log(files);

//   // Просмотр содержимого файла
//   const content = await client.getFile('docs/file.txt');
//   console.log(content);

//   // Загрузка нового файла
//   // await client.upload('docs', myFileInput.files[0]);

//   // Создание папки
//   // await client.mkdir('docs/new-folder');

// })();


/******************************************************************************************************************************************************* */
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