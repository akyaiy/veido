const cwdEl = document.getElementById('cwd');
const mainEl = document.getElementById('main');
const filesTable = document.getElementById('files');
const tbody = document.querySelector('#files tbody');
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
        cols.style.padding = '8px';
        cols.style.columnWidth = '220px';
        cols.style.columnGap = '16px';
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
        cols.style.columnGap = '16px';
        cols.style.columnFill = 'auto';
        cols.style.height = 'calc(100% - 16px)';
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

document.getElementById('viewMode').addEventListener('change', e => {
    viewMode = e.target.value;
    applyViewMode();
    list(cwd);
});

function relPath(p) {
    if (!p) return '/';
    if (p.startsWith('/')) return p;
    return '/' + p;
}

async function list(path) {
    const res = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) { console.error('Ошибка списка'); return; }
    const data = await res.json();
    cwd = path;
    cwdEl.textContent = cwd;

    ensureContainers();
    const tiles = document.getElementById('files_tiles');
    const cols = document.getElementById('files_columns');

    tbody.innerHTML = '';
    tiles.innerHTML = '';
    cols.innerHTML = '';

    if (path !== '/') {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3"><button id="btnUpRow">⬆ Вверх</button></td>`;
        tbody.appendChild(tr);
        tr.querySelector('button').addEventListener('click', () => {
            const up = cwd.split('/').slice(0, -1).join('/') || '/';
            list(up);
        });

        const upTile = document.createElement('div');
        upTile.className = 'tile up-tile';
        upTile.style.display = 'flex';
        upTile.style.flexDirection = 'column';
        upTile.style.alignItems = 'center';
        upTile.style.justifyContent = 'center';
        upTile.style.padding = '8px';
        upTile.innerHTML = `<div class="tile-icon" style="font-size:40px">⬆</div><div class="tile-name" style="margin-top:6px;font-size:12px">Вверх</div>`;
        upTile.addEventListener('dblclick', () => {
            const up = cwd.split('/').slice(0, -1).join('/') || '/';
            list(up);
        });
        tiles.appendChild(upTile);

        const upCol = document.createElement('div');
        upCol.className = 'col-item';
        upCol.style.display = 'block';
        upCol.style.breakInside = 'avoid';
        upCol.style.padding = '8px';
        upCol.style.width = '100%';
        upCol.innerHTML = `<div style="display:flex;align-items:center;"><div style="width:40px;display:flex;justify-content:center;font-size:20px">⬆</div><div style="padding-left:8px">Вверх</div></div><hr style="border:none;border-bottom:1px solid rgba(0,0,0,0.08);margin:8px 0 0 0">`;
        upCol.addEventListener('dblclick', () => {
            const up = cwd.split('/').slice(0, -1).join('/') || '/';
            list(up);
        });
        cols.appendChild(upCol);
    }

    data.sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));

    for (const f of data) {
        const icon = f.isDir ? '📁' : '📄';
        const nameEsc = escapeHtml(f.name);

        if (viewMode === 'table') {
            const tr = document.createElement('tr');
            const name = `${icon} ${nameEsc}`;
            tr.innerHTML = `<td style="text-align:left;padding:10px 16px;">${name}</td><td style="padding:10px 16px">${f.isDir ? '—' : f.size}</td><td style="padding:10px 16px">${f.modTime || ''}</td>`;
            tbody.appendChild(tr);

            tr.addEventListener('dblclick', () => {
                if (f.isDir) list((cwd === '/' ? '' : cwd) + '/' + f.name);
                else window.location = `/api/files/download?path=${encodeURIComponent((cwd === '/' ? '' : cwd) + '/' + f.name)}`;
            });

            tr.addEventListener('contextmenu', async e => {
                e.preventDefault();
                const action = prompt('Введите действие: delete/view');
                const p = (cwd === '/' ? '' : cwd) + '/' + f.name;
                if (action === 'delete') {
                    if (!confirm('Удалить?')) return;
                    const form = new FormData();
                    form.append('path', p);
                    await fetch('/api/files/delete', { method: 'POST', body: form });
                    list(cwd);
                } else if (action === 'view' && !f.isDir) {
                    const r = await fetch(`/api/files/view?path=${encodeURIComponent(p)}`);
                    const text = await r.text();
                    const w = window.open('', '_blank');
                    w.document.write(`<pre>${escapeHtml(text)}</pre>`);
                }
            });
        } else if (viewMode === 'columns') {
            const item = document.createElement('div');
            item.className = 'col-item';
            item.style.display = 'block';
            item.style.breakInside = 'avoid';
            item.style.padding = '8px';
            item.style.width = '100%';
            item.innerHTML = `<div style="display:flex;align-items:center;"><div style="width:40px;display:flex;justify-content:center">${icon}</div><div style="padding-left:8px;flex:1">${nameEsc}</div></div><hr style="border:none;border-bottom:1px solid rgba(0,0,0,0.08);margin:8px 0 0 0">`;
            cols.appendChild(item);

            item.addEventListener('dblclick', () => {
                if (f.isDir) list((cwd === '/' ? '' : cwd) + '/' + f.name);
                else window.location = `/api/files/download?path=${encodeURIComponent((cwd === '/' ? '' : cwd) + '/' + f.name)}`;
            });

            item.addEventListener('contextmenu', async e => {
                e.preventDefault();
                const action = prompt('Введите действие: delete/view');
                const p = (cwd === '/' ? '' : cwd) + '/' + f.name;
                if (action === 'delete') {
                    if (!confirm('Удалить?')) return;
                    const form = new FormData();
                    form.append('path', p);
                    await fetch('/api/files/delete', { method: 'POST', body: form });
                    list(cwd);
                } else if (action === 'view' && !f.isDir) {
                    const r = await fetch(`/api/files/view?path=${encodeURIComponent(p)}`);
                    const text = await r.text();
                    const w = window.open('', '_blank');
                    w.document.write(`<pre>${escapeHtml(text)}</pre>`);
                }
            });
        } else if (viewMode === 'tiles') {
            const tilesContainer = document.getElementById('files_tiles');
            if (!tilesContainer) continue;

            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.style.display = 'flex';
            tile.style.flexDirection = 'column';
            tile.style.alignItems = 'center';
            tile.style.justifyContent = 'center';
            tile.style.padding = '6px';
            tile.style.boxSizing = 'border-box';
            tile.innerHTML = `<div class="tile-icon" style="font-size:36px;display:flex;justify-content:center">${icon}</div><div class="tile-name" style="margin-top:6px;font-size:12px;text-align:center">${nameEsc}</div>`;
            tilesContainer.appendChild(tile);

            tile.addEventListener('dblclick', () => {
                if (f.isDir) list((cwd === '/' ? '' : cwd) + '/' + f.name);
                else window.location = `/api/files/download?path=${encodeURIComponent((cwd === '/' ? '' : cwd) + '/' + f.name)}`;
            });

            tile.addEventListener('contextmenu', async e => {
                e.preventDefault();
                const action = prompt('Введите действие: delete/view');
                const p = (cwd === '/' ? '' : cwd) + '/' + f.name;
                if (action === 'delete') {
                    if (!confirm('Удалить?')) return;
                    const form = new FormData();
                    form.append('path', p);
                    await fetch('/api/files/delete', { method: 'POST', body: form });
                    list(cwd);
                } else if (action === 'view' && !f.isDir) {
                    const r = await fetch(`/api/files/view?path=${encodeURIComponent(p)}`);
                    const text = await r.text();
                    const w = window.open('', '_blank');
                    w.document.write(`<pre>${escapeHtml(text)}</pre>`);
                }
            });
        }
    }
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.getElementById('btnUpload').addEventListener('click', async () => {
    const input = document.getElementById('uploadFile');
    if (!input.files.length) return alert('Выберите файл');
    const file = input.files[0];
    const form = new FormData();
    const p = cwd === '/' ? '' : cwd;
    form.append('path', p);
    form.append('file', file);
    const res = await fetch('/api/files/upload', { method: 'POST', body: form });
    if (res.status === 201) list(cwd);
    else alert('Ошибка загрузки');
});

document.getElementById('btnMkdir').addEventListener('click', async () => {
    const name = document.getElementById('newFolderName').value.trim();
    if (!name) return;
    const form = new FormData();
    form.append('path', cwd === '/' ? '' : cwd);
    form.append('name', name);
    const res = await fetch('/api/files/mkdir', { method: 'POST', body: form });
    if (res.status === 201) {
        document.getElementById('newFolderName').value = '';
        list(cwd);
    } else alert('Ошибка создания');
});

applyViewMode();
list('/');

const closeBtn = document.getElementById('closeBtn');
closeBtn.addEventListener('click', () => {
    const fm = document.getElementById("fManager");
    if (fm) fm.remove();
    document.querySelectorAll('[data-dynamic="fManager"]').forEach(el => el.remove());
});
