const inputPopup = document.getElementById('inputPopup');
const createPopup = document.getElementById('createPopup');

const actionTable = {
    'Редактировать': () => console.log('Редактировать'),
    'Удалить': () => console.log('Удалить'),
    'Копировать': () => console.log('Скопировано')
};

let menuDiv = document.querySelector('.window-menu');
if (!menuDiv) {
    menuDiv = document.createElement('div');
    menuDiv.className = 'window-menu';
    menuDiv.style.position = 'absolute';
    menuDiv.style.display = 'none';
    document.body.appendChild(menuDiv);
}

function parseJSONSafe(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch (e) { return null; }
}

function splitMenuText(text) {
    if (!text) return [];
    return String(text).split(',').map(s => s.trim()).filter(Boolean);
}

function buildMenu(items) {
    menuDiv.innerHTML = '';
    items.forEach(label => {
        const it = document.createElement('div');
        it.className = 'window-item';
        it.textContent = label;
        it.addEventListener('click', (e) => {
            e.stopPropagation();
            if (actionTable[label]) actionTable[label]();
            hideMenu();
        });
        menuDiv.appendChild(it);
    });
}

function showMenuAt(x, y, items) {
    if (!items || !items.length) return;
    buildMenu(items);
    menuDiv.style.display = 'block';
    menuDiv.style.left = x + 'px';
    menuDiv.style.top = y + 'px';
    const rect = menuDiv.getBoundingClientRect();
    if (rect.right > window.innerWidth) menuDiv.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menuDiv.style.top = (y - rect.height) + 'px';
    setTimeout(() => document.addEventListener('click', hideMenu, { once: true }), 0);
}

function hideMenu() {
    menuDiv.style.display = 'none';
}

function showOverlayMessage(text) {
    if (!text) return;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const popup = document.createElement('div');
    popup.className = 'window-popup';
    const content = document.createElement('div');
    content.textContent = String(text);
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    popup.appendChild(content);
    popup.appendChild(closeBtn);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function popupFileFromSections(title, sections, afterClose) {
    const popup = document.createElement('div');
    popup.className = 'window-panel';
    const header = document.createElement('div');
    header.className = 'window-header';
    header.textContent = 'Свойства: ' + (title || '');
    const tabs = document.createElement('div');
    tabs.className = 'window-tabs';
    const tabButtons = [];
    const tabContents = [];
    const keys = Object.keys(sections || {});

    keys.forEach((name, i) => {
        const t = document.createElement('div');
        t.className = 'window-tab' + (i === 0 ? ' active' : '');
        t.textContent = name;
        t.addEventListener('click', () => switchTab(i));
        tabButtons.push(t);
        tabs.appendChild(t);

        const content = document.createElement('div');
        content.className = 'window-content' + (i === 0 ? ' active' : '');
        const val = sections[name];

        if (Array.isArray(val)) {
            val.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'window-row';
                if (Array.isArray(row) && row.length >= 2) {
                    const k = document.createElement('span');
                    k.textContent = row[0];
                    const v = document.createElement('span');
                    v.textContent = row[1];
                    rowEl.append(k, v);
                } else {
                    rowEl.textContent = String(row);
                }
                content.appendChild(rowEl);
            });
        } else if (val && typeof val === 'object') {
            Object.keys(val).forEach(kname => {
                const rowEl = document.createElement('div');
                rowEl.className = 'window-row';
                const k = document.createElement('span');
                k.textContent = kname + ':';
                const v = document.createElement('span');
                v.textContent = String(val[kname]);
                rowEl.append(k, v);
                content.appendChild(rowEl);
            });
        } else {
            content.innerHTML = String(val || '');
        }

        tabContents.push(content);
    });

    function switchTab(i) {
        tabButtons.forEach((t, idx) => t.classList.toggle('active', idx === i));
        tabContents.forEach((c, idx) => c.classList.toggle('active', idx === i));
    }

    const buttons = document.createElement('div');
    buttons.className = 'window-buttons';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'ОК';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Отмена';
    okBtn.onclick = close;
    cancelBtn.onclick = close;
    buttons.append(okBtn, cancelBtn);

    let offsetX, offsetY, dragging = false;

    header.addEventListener('mousedown', (e) => {
        dragging = true;
        offsetX = e.clientX - popup.offsetLeft;
        offsetY = e.clientY - popup.offsetTop;
        header.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (dragging) {
            popup.style.left = (e.clientX - offsetX) + 'px';
            popup.style.top = (e.clientY - offsetY) + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
    });

    function close() {
        popup.remove();
        if (typeof afterClose === 'function') afterClose();
    }

    popup.append(header, tabs, ...tabContents, buttons);
    document.body.append(popup);
}

function handleCommand(raw, opts) {
    if (!raw) return;
    const parsed = typeof raw === 'string' ? parseJSONSafe(raw.trim()) : raw;
    if (!parsed || !parsed.act) return;

    if (parsed.act === 'message' && opts && opts.source === 'button') {
        const text = parsed.text || '';
        if (!text) return;
        showOverlayMessage(text);
        return;
    }

    if (parsed.act === 'menu' && opts && opts.source === 'context') {
        const items = Array.isArray(parsed.text)
            ? parsed.text.map(s => String(s).trim()).filter(Boolean)
            : splitMenuText(String(parsed.text || ''));

        if (!items.length) return;

        const x = opts.coords && typeof opts.coords.x === 'number' ? opts.coords.x : (parsed.x || 0);
        const y = opts.coords && typeof opts.coords.y === 'number' ? opts.coords.y : (parsed.y || 0);

        showMenuAt(x, y, items);
        return;
    }

    if (parsed.act === 'file' && opts && opts.source === 'button') {
        const sections = parsed.text && typeof parsed.text === 'object' ? parsed.text : null;
        const title = sections && sections['Общие'] && sections['Общие']['Имя']
            ? sections['Общие']['Имя']
            : parsed.title || '';

        if (!sections) return;

        popupFileFromSections(title, sections);
        return;
    }
}

createPopup.addEventListener('click', () => {
    const raw = (inputPopup && inputPopup.value) ? inputPopup.value : '';
    handleCommand(raw, { source: 'button' });
});

document.addEventListener('contextmenu', (e) => {
    const raw = (inputPopup && inputPopup.value) ? inputPopup.value : '';
    const parsed = parseJSONSafe(raw);
    if (!parsed || parsed.act !== 'menu') return;

    e.preventDefault();
    handleCommand(raw, { source: 'context', coords: { x: e.pageX, y: e.pageY } });
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideMenu();
});
