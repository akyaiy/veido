const cwdEl = document.getElementById('cwd');
const tbody = document.querySelector('#files tbody');
let cwd = '/';
let viewMode = 'table';

function applyViewMode() {
  const root = document.body;
  root.classList.remove('view-tiles', 'view-columns', 'view-table');
  if (viewMode === 'tiles') root.classList.add('view-tiles');
  else if (viewMode === 'columns') root.classList.add('view-columns');
  else root.classList.add('view-table');
}

document.getElementById('viewMode').addEventListener('change', e => {
  viewMode = e.target.value;
  applyViewMode();
});

function relPath(p) {
  if (!p) return '/';
  if (p.startsWith('/')) return p;
  return '/' + p;
}

async function list(path) {
  const res = await fetch(`/api/files/list?path=${encodeURIComponent(path)}`);
  if (!res.ok) { alert('Ошибка списка'); return; }
  const data = await res.json();
  cwd = path;
  cwdEl.textContent = cwd;
  tbody.innerHTML = '';

  if (path !== '/') {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="3"><button id="btnUp">⬆ Вверх</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('button').addEventListener('click', () => {
      const up = cwd.split('/').slice(0, -1).join('/') || '/';
      list(up);
    });
  }

  data.sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));

  for (const f of data) {
    const tr = document.createElement('tr');
    const name = f.isDir ? `📁 ${f.name}` : `📄 ${f.name}`;
    tr.innerHTML = `
      <td>${name}</td>
      <td>${f.isDir ? '—' : f.size}</td>
      <td>${f.modTime || ''}</td>
    `;
    tbody.appendChild(tr);

    tr.addEventListener('dblclick', () => {
      if (f.isDir) {
        const np = (cwd === '/' ? '' : cwd) + '/' + f.name;
        list(np);
      } else {
        const p = (cwd === '/' ? '' : cwd) + '/' + f.name;
        window.location = `/api/files/download?path=${encodeURIComponent(p)}`;
      }
    });

    tr.addEventListener('contextmenu', async (e) => {
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

function escapeHtml(s) {
  return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
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


closeBtn.addEventListener('click', () => {
    const fm = document.getElementById("fManager");
    if (fm) fm.remove();
    document.querySelectorAll('[data-dynamic="fManager"]').forEach(el => el.remove());
});
