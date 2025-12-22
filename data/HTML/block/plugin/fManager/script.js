// const DAV_ROOT = '/api/dav';
// let cwd = '/';

// async function fetchDAV(path, options = {}) {
//     const url = DAV_ROOT + path;

//     const finalOptions = {
//         ...options,
//         headers: {
//             ...(options.headers || {}),
//             'Content-Type': 'application/json', // можно убрать, если тело не JSON
//         },
//     };

//     return apiProtected(url, finalOptions);
// }

// const cwdEl = document.getElementById('cwd');
// const mainEl = document.getElementById('main');
// const filesTable = document.getElementById('files');
// const tbody = document.querySelector('#files tbody');
// //let cwd = '/';
// let viewMode = 'table';

// function fetchWithAuth(url, options = {}) {
//     const token = localStorage.getItem("access_token");
//     const headers = options.headers || {};

//     if (token) {
//         headers["Authorization"] = "Bearer " + token;
//     }

//     return fetch(url, {
//         ...options,
//         headers
//     });
// }


// function ensureContainers() {
//     let tiles = document.getElementById('files_tiles');
//     let cols = document.getElementById('files_columns');
//     if (!tiles) {
//         tiles = document.createElement('div');
//         tiles.id = 'files_tiles';
//         tiles.style.display = 'none';
//         tiles.style.gridTemplateColumns = 'repeat(auto-fill,minmax(120px,1fr))';
//         tiles.style.gap = '12px';
//         tiles.style.padding = '8px';
//         mainEl.appendChild(tiles);
//     }
//     if (!cols) {
//         cols = document.createElement('div');
//         cols.id = 'files_columns';
//         cols.style.display = 'none';
//         cols.style.padding = '4px';
//         cols.style.columnWidth = '220px';
//         cols.style.columnGap = '12px';
//         cols.style.columnFill = 'auto';
//         cols.style.height = 'calc(100vh - 200px)';
//         cols.style.overflowY = 'hidden';
//         cols.style.overflowX = 'auto';
//         cols.style.width = '100%';
//         mainEl.appendChild(cols);
//     }
// }

// function applyViewMode() {
//     ensureContainers();
//     const tiles = document.getElementById('files_tiles');
//     const cols = document.getElementById('files_columns');
//     document.body.classList.remove('view-tiles', 'view-columns', 'view-table');
//     if (viewMode === 'tiles') {
//         document.body.classList.add('view-tiles');
//         filesTable.style.display = 'none';
//         cols.style.display = 'none';
//         tiles.style.display = 'grid';
//         tiles.style.gridTemplateColumns = 'repeat(auto-fill,minmax(100px,1fr))';
//         tiles.style.gap = '10px';
//     } else if (viewMode === 'columns') {
//         document.body.classList.add('view-columns');
//         filesTable.style.display = 'none';
//         tiles.style.display = 'none';
//         cols.style.display = '';
//         cols.style.columnWidth = '220px';
//         cols.style.columnGap = '12px';
//         cols.style.columnFill = 'auto';
//         cols.style.height = 'calc(100% - 8px)';
//         cols.style.overflowY = 'hidden';
//         cols.style.overflowX = 'auto';
//         cols.style.width = '100%';
//     } else {
//         document.body.classList.add('view-table');
//         filesTable.style.display = '';
//         tiles.style.display = 'none';
//         cols.style.display = 'none';
//     }
// }

// document.getElementById('viewMode').addEventListener('change', e => {
//     viewMode = e.target.value;
//     applyViewMode();
//     list(cwd);
// });


// async function list(path) {
//     let data;
//     try {
//         data = await apiProtected(`/api/files/list?path=${encodeURIComponent(path)}`);
//     } catch (err) {
//         console.error('Ошибка списка', err);
//         return;
//     }

//     cwd = path;
//     cwdEl.textContent = cwd;

//     ensureContainers();

//     const tiles = document.getElementById('files_tiles');
//     const cols = document.getElementById('files_columns');

//     tbody.innerHTML = '';
//     tiles.innerHTML = '';
//     cols.innerHTML = '';

//     // ---- Добавить кнопку "Вверх"
//     if (path !== '/') {
//         const upPath = cwd.split('/').slice(0, -1).join('/') || '/';

//         // Таблица
//         const tr = document.createElement('tr');
//         tr.innerHTML = `<td colspan="3"><button id="btnUpRow">⬆ Вверх</button></td>`;
//         tr.querySelector('button').onclick = () => list(upPath);
//         tbody.appendChild(tr);

//         // Плитка
//         const upTile = document.createElement('div');
//         upTile.className = 'tile up-tile';
//         upTile.style.display = 'flex';
//         upTile.style.flexDirection = 'column';
//         upTile.style.alignItems = 'center';
//         upTile.style.justifyContent = 'center';
//         upTile.style.padding = '6px';
//         upTile.innerHTML = `
//             <div class="tile-icon" style="font-size:36px">⬆</div>
//             <div class="tile-name" style="margin-top:4px;font-size:12px">Вверх</div>`;
//         upTile.ondblclick = () => list(upPath);
//         tiles.appendChild(upTile);

//         // Колонки
//         const upCol = document.createElement('div');
//         upCol.className = 'col-item';
//         upCol.style.padding = '4px';
//         upCol.innerHTML = `
//             <div style="display:flex;align-items:center;">
//                 <div style="width:32px;text-align:center;font-size:18px">⬆</div>
//                 <div style="padding-left:6px">Вверх</div>
//             </div>`;
//         upCol.ondblclick = () => list(upPath);
//         cols.appendChild(upCol);
//     }

//     // ---- Сортировка
//     data.sort((a, b) =>
//         a.isDir === b.isDir ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1)
//     );

//     // ---- Заполнение списка
//     for (const f of data) {
//         const icon = f.isDir ? '📁' : '📄';
//         const nameEsc = escapeHtml(f.name);
//         const fullPath = (cwd === '/' ? '' : cwd) + '/' + f.name;

//         const openItem = () => {
//             if (f.isDir) list(fullPath);
//             else downloadFile(fullPath); // авторизованный download
//         };

//         // ----- TABLE
//         if (viewMode === 'table') {
//             const tr = document.createElement('tr');
//             tr.innerHTML = `
//                 <td style="text-align:left;padding:10px 16px;">${icon} ${nameEsc}</td>
//                 <td style="padding:10px 16px">${f.isDir ? '—' : f.size}</td>
//                 <td style="padding:10px 16px">${f.modTime || ''}</td>
//             `;
//             tr.ondblclick = openItem;
//             tbody.appendChild(tr);
//         }

//         // ----- COLUMNS
//         else if (viewMode === 'columns') {
//             const item = document.createElement('div');
//             item.className = 'col-item';
//             item.style.padding = '4px';
//             item.innerHTML = `
//                 <div style="display:flex;align-items:center;">
//                     <div style="width:32px;text-align:center">${icon}</div>
//                     <div style="padding-left:6px;flex:1">${nameEsc}</div>
//                 </div>`;
//             item.ondblclick = openItem;
//             cols.appendChild(item);
//         }

//         // ----- TILES
//         else if (viewMode === 'tiles') {
//             const tile = document.createElement('div');
//             tile.className = 'tile';
//             tile.style.display = 'flex';
//             tile.style.flexDirection = 'column';
//             tile.style.alignItems = 'center';
//             tile.style.justifyContent = 'center';
//             tile.style.padding = '6px';
//             tile.innerHTML = `
//                 <div class="tile-icon" style="font-size:36px">${icon}</div>
//                 <div class="tile-name" style="margin-top:4px;font-size:12px;text-align:center">${nameEsc}</div>`;
//             tile.ondblclick = openItem;
//             tiles.appendChild(tile);
//         }
//     }

//     const toolbarBottom = document.getElementById('toolbarBottom');
//     toolbarBottom.style.display = 'none';

//     if (window.listTfootAct) {
//         listTfoot(window.listTfootAct);
//     }
// }

// 

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

const f_burger = document.getElementById('f_burger');
const f_burgerMenu = document.getElementById('f_burgerMenu');

// открыть / закрыть меню
f_burger.addEventListener('click', e => {
    e.stopPropagation();
    f_burger.classList.toggle('open');
});

// клик вне меню — закрыть
document.addEventListener('click', () => {
    f_burger.classList.remove('open');
});

f_burgerMenu.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', e => {
        e.stopPropagation(); // ⬅ ВАЖНО

        viewMode = item.dataset.view;
        applyViewMode();
        list(cwd);

        f_burger.classList.remove('open');
    });
});


async function list(path) {
    let data;

    try {
        data = await apiProtected(`/api/files/list?path=${encodeURIComponent(path)}`);
    } catch (err) {
        console.error('Ошибка списка', err);
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

    // дальше код без изменений
    data.sort((a, b) =>
        a.isDir === b.isDir ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1)
    );

    // ---- Заполнение списка
    for (const f of data) {
        const icon = f.isDir ? '📁' : '📄';
        const nameEsc = escapeHtml(f.name);
        const fullPath = (cwd === '/' ? '' : cwd) + '/' + f.name;

        const openItem = () => {
            if (f.isDir) list(fullPath);
            else downloadFile(fullPath); // авторизованный download
        };

        // ----- TABLE
        if (viewMode === 'table') {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:left;padding:10px 16px;">${icon} ${nameEsc}</td>
                <td style="padding:10px 16px">${f.isDir ? '—' : f.size}</td>
                <td style="padding:10px 16px">${f.modTime || ''}</td>
            `;
            tr.ondblclick = openItem;
            tbody.appendChild(tr);
        }

        // ----- COLUMNS
        else if (viewMode === 'columns') {
            const item = document.createElement('div');
            item.className = 'col-item';
            item.style.padding = '4px';
            item.innerHTML = `
                <div style="display:flex;align-items:center;">
                    <div style="width:32px;text-align:center">${icon}</div>
                    <div style="padding-left:6px;flex:1">${nameEsc}</div>
                </div>`;
            item.ondblclick = openItem;
            cols.appendChild(item);
        }

        // ----- TILES
        else if (viewMode === 'tiles') {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.style.display = 'flex';
            tile.style.flexDirection = 'column';
            tile.style.alignItems = 'center';
            tile.style.justifyContent = 'center';
            tile.style.padding = '6px';
            tile.innerHTML = `
                <div class="tile-icon" style="font-size:36px">${icon}</div>
                <div class="tile-name" style="margin-top:4px;font-size:12px;text-align:center">${nameEsc}</div>`;
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

