// Переключает вкладки CSS и JS
const tabs = document.querySelectorAll('#css-js-tabs .tab');
const cssPanel = document.getElementById('css-panel');
const jsPanel = document.getElementById('js-panel');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (tab.dataset.tab === 'css') {
            cssPanel.style.display = 'flex';
            jsPanel.style.display = 'none';
        } else {
            cssPanel.style.display = 'none';
            jsPanel.style.display = 'flex';
        }
    });
});


// Изменение размера блока перетаскиванием мыши
const handle = document.querySelector('.small-handle');
const loadedBlock = document.getElementById('loadedBlock');

let active = false;
let sx, sy, sw, sh;

handle.onmousedown = e => {
    e.preventDefault();
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    sw = loadedBlock.offsetWidth;
    sh = loadedBlock.offsetHeight;

    document.onmousemove = move;
    document.onmouseup = () => {
        active = false;
        document.onmousemove = null;
    };
};

function move(e) {
    if (!active) return;

    let deltaX = (e.clientX - sx);
    let deltaY = (e.clientY - sy);

    let w = sw + deltaX;
    let h = sh + deltaY;

    loadedBlock.style.width = w + 'px';
    loadedBlock.style.height = h + 'px';
}


// Загрузка и управление вкладками блоков
const tabOpen = document.getElementById('tab-open');
const content = document.getElementById('content');

tabOpen.onclick = () => {
    let fm = document.createElement('div');
    fm.id = 'fManager';
    content.appendChild(fm);

    window.listTfootAct = "loadBlock";
    loadBlock('plugin/fManager', 'fManager');
};

window.newLoadedBlock = newLoadedBlock;
async function newLoadedBlock(path) {
    let tabs = document.getElementById('blocks-tabs');
    let container = document.getElementById('loadedBlockMain');
    if (!container) {
        container = document.createElement('div');
        container.id = 'loadedBlockMain';
        mainEl.appendChild(container);
    }

    let existingTab;
    tabs.querySelectorAll('.tab').forEach(t => {
        if (t.dataset.path === path) existingTab = t;
    });

    function switchTo(blockId, tabEl) {
        tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (tabEl) tabEl.classList.add('active');
        Array.from(container.children).forEach(ch => {
            if (ch !== handle) ch.style.display = ch.id === blockId ? '' : 'none';
        });
    }

    if (existingTab) {
        switchTo(existingTab.dataset.blockId, existingTab);
        return;
    }

    let num = 1;
    while (document.getElementById('loadedBlock_' + num)) num++;
    const blockId = 'loadedBlock_' + num;

    const block = document.createElement('div');
    block.id = blockId;

    const viewDiv = document.createElement('div');
    viewDiv.id = blockId + '_view';
    viewDiv.className = 'loadedBlock_view';
    viewDiv.contentEditable = 'true';
    viewDiv.oninput = () => syncViewToHtml(blockId);

    const htmlDiv = document.createElement('div');
    htmlDiv.id = blockId + '_html';
    htmlDiv.style.display = 'none';

    const scriptsDiv = document.createElement('div');
    scriptsDiv.id = blockId + '_scripts';

    block.appendChild(viewDiv);
    block.appendChild(htmlDiv);
    block.appendChild(scriptsDiv);
    container.appendChild(block);

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.path = path;
    tabEl.dataset.blockId = blockId;
    tabEl.textContent = path.split('/').filter(Boolean).pop() || path;
    tabEl.onclick = () => switchTo(blockId, tabEl);
    tabs.appendChild(tabEl);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.marginLeft = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = e => closeBlock(e, block, tabEl);

    tabEl.appendChild(closeBtn);

    switchTo(blockId, tabEl);

    await loadBlock(path, viewDiv.id, ["js", "html"]);
}
document.getElementById('center-tab-pre-html').addEventListener('input', () => {
    if (document.querySelector('#center-tabs .center-tab.active')?.dataset.tab !== 'html') return;

    const blockId = getActiveBlockId();
    if (blockId) syncHtmlToView(blockId);
});

function closeBlock(e, block, tabEl) {
    e.stopPropagation();

    const container = document.getElementById('loadedBlockMain');
    if (container && block) container.removeChild(block);
    if (tabEl.parentNode) tabEl.parentNode.removeChild(tabEl);

    centerPreHtml.textContent = '';
    centerPreJs.textContent = '';
    centerContent.style.display = 'none';
    document.getElementById('loadedBlock').style.display = '';

    const tagLabel = document.getElementById('tag-label');
    if (tagLabel) tagLabel.textContent = 'TAG';

    const attrId = document.getElementById('attr-id');
    const attrClass = document.getElementById('attr-class');
    if (attrId) attrId.value = '';
    if (attrClass) attrClass.value = '';

    const attrTable = document.getElementById('attributes-table');
    if (attrTable) {
        attrTable.innerHTML = '<tr><td contenteditable="true" data-placeholder="name"></td><td contenteditable="true" data-placeholder="value"></td></tr>';
    }

    const propTable = document.getElementById('properties-table');
    if (propTable) {
        propTable.innerHTML = '<tr><td contenteditable="true" data-placeholder="property"></td><td contenteditable="true" data-placeholder="value"></td></tr>';
    }

    const jsTable = document.getElementById('editor-js-panel');
    if (jsTable) {
        jsTable.querySelectorAll('td[contenteditable="true"]').forEach(td => td.textContent = '');
    }

    const cssPanel = document.getElementById('css-panel');
    const jsPanel = document.getElementById('js-panel');
    if (cssPanel) cssPanel.style.display = '';
    if (jsPanel) jsPanel.style.display = 'none';
}


// Вкладки view / html / js блока
const centerTabs = document.querySelectorAll('#center-tabs .center-tab');
const centerContent = document.getElementById('center-tab-content');
const centerPreHtml = document.getElementById('center-tab-pre-html');
const centerPreJs = document.getElementById('center-tab-pre-js');
/* const btnLoadFromView = document.getElementById('btn-load-from-view');
const btnApplyToView = document.getElementById('btn-apply-to-view'); */
const btnApplyJs = document.getElementById('btn-apply-js');

function getActiveBlockId() {
    const tab = document.querySelector('#blocks-tabs .tab.active');
    if (tab && tab.dataset.blockId) return tab.dataset.blockId;
    const container = document.getElementById('loadedBlockMain');
    if (!container) return null;
    for (const ch of container.children) {
        if (getComputedStyle(ch).display !== 'none') return ch.id;
    }
    return null;
}

function applyJs(blockId) {
    const content = centerPreJs.textContent || '';

    let scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (!scriptEl) {
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
        scriptEl = document.createElement('script');
        scriptEl.setAttribute('data-dynamic', blockId + '_view');
        wrap.appendChild(scriptEl);
    }

    scriptEl.type = '';

    if (!content.trim()) {
        scriptEl.textContent = '';
        return;
    }

    const wrapped = `
(() => {
    try {
${content}
        if (typeof pageInit === "function") pageInit();
    } catch (e) {
        console.error("Block script error:", e);
    }
})();
`;
    scriptEl.textContent = wrapped;

    try {
        eval(scriptEl.textContent);
    } catch (e) {
        console.error(e);
    }
}

function updateCenterControls(mode) {
    /* btnLoadFromView.style.display = mode === 'html' ? '' : 'none';
    btnApplyToView.style.display = mode === 'html' ? '' : 'none'; */
    btnApplyJs.style.display = mode === 'js' ? '' : 'none';
}

function showView(blockId) {
    centerContent.style.display = 'none';
    updateCenterControls('view');
    const container = document.getElementById('loadedBlockMain');
    if (!container) return;
    Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = '';
}

function showHtml(blockId) {
    centerContent.style.display = '';
    centerPreHtml.style.display = '';
    centerPreJs.style.display = 'none';
    updateCenterControls('html');

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';

    const htmlContainer = document.getElementById(blockId + '_html');
    if (htmlContainer && !centerPreHtml.dataset.userEdited) {
        centerPreHtml.textContent = htmlContainer.innerHTML;
    }
}
centerPreHtml.addEventListener('input', () => {
    centerPreHtml.dataset.userEdited = '1';
});

function showJs(blockId) {
    centerContent.style.display = '';
    centerPreHtml.style.display = 'none';
    centerPreJs.style.display = '';
    updateCenterControls('js');

    const scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    let code = scriptEl ? scriptEl.textContent : '';

    code = code
        .replace(/^\s*\(\(\)\s*=>\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*if\s*\(\s*typeof pageInit[\s\S]*?\)\s*pageInit\(\);\s*/s, '')
        .replace(/\s*}\s*catch[\s\S]*?}\s*\}\)\s*\(\s*\)\s*;?\s*$/s, '');

    centerPreJs.textContent = code;

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';
}

centerTabs.forEach(tab => {
    tab.onclick = () => {
        centerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const blockId = getActiveBlockId();
        if (!blockId) return;
        if (tab.dataset.tab === 'view') showView(blockId);
        if (tab.dataset.tab === 'html') showHtml(blockId);
        if (tab.dataset.tab === 'js') showJs(blockId);
    };
});

/* btnLoadFromView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;
    htmlDiv.innerHTML = view.innerHTML;
    centerPreHtml.textContent = htmlDiv.innerHTML;
};

btnApplyToView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;

    const md = window.markdownit({ html: true, linkify: true, typographer: true });
    const rendered = centerPreHtml.textContent;

    htmlDiv.innerHTML = rendered;
    view.innerHTML = rendered;
}; */

function syncViewToHtml(blockId) {
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;

    htmlDiv.innerHTML = view.innerHTML;
    centerPreHtml.textContent = htmlDiv.innerHTML;
}

function syncHtmlToView(blockId) {
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;

    const html = centerPreHtml.textContent;
    htmlDiv.innerHTML = html;
    view.innerHTML = html;
}

btnApplyJs.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    applyJs(blockId);
};


// Добавление HTML-элементов в view и HTML-редактор
document.getElementById('elements-ul').addEventListener('click', e => {
    const el = e.target.closest('.add-el');
    if (!el) return;

    const tag = el.dataset.el;
    if (!tag) return;

    handleLoadedBlockView(tag);
    handlePreHtml(tag, el.textContent.includes('</>'));
});

function handleLoadedBlockView(tag) {
    const sel = document.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node) return;

    const view = node.closest('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return;

    const voidTags = ['img','input','br','hr','meta','link','source'];
    const newEl = document.createElement(tag);
    if (!voidTags.includes(tag)) newEl.textContent = tag;

    range.insertNode(newEl);
    range.setStartAfter(newEl);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
}

function handlePreHtml(tag, wantsClosing) {
    const pre = document.getElementById('center-tab-pre-html');
    if (!pre || pre.contentEditable !== "true") return;

    const snippet = wantsClosing ? `<${tag}></${tag}>` : `<${tag}>`;
    const sel = document.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node || !pre.contains(node)) return;

    const textNode = document.createTextNode(snippet);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}


// Выбор элемента 
let currentSelectedEl = null;

document.addEventListener('click', e => {
    const clicked = e.target;

    const view = clicked.closest('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return;

    if (!view.contains(clicked)) return;

    const el = clicked.closest('[id^="loadedBlock_"][id$="_view"], [id^="loadedBlock_"][id$="_view"] *') || view;

    updateCssPanel(el);
    updatePropertiesPanel(el);
    updateTagLabel(el);
    updateJsPanel(el);
});

function updateTagLabel(el) {
    const label = document.getElementById('tag-label');
    if (!label) return;
    let name = el.tagName.toLowerCase();
    label.textContent = name;
}


// Редактирование id и class элемента
function updateCssPanel(el) {
    currentSelectedEl = el;
    const idInput = document.getElementById('attr-id');
    const classInput = document.getElementById('attr-class');
    const attrsTable = document.getElementById('attributes-table');
    if (idInput) idInput.value = el.id || '';
    if (classInput) classInput.value = el.className || '';
    if (!attrsTable) return;
    attrsTable.innerHTML = '';
    const names = el.getAttributeNames().filter(n => n !== 'id' && n !== 'class');
    names.forEach(name => createAttrRow(name, el.getAttribute(name) || ''));
    ensureEmptyAttrRow();
}

document.getElementById('attr-id')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    const v = e.target.value.trim();
    v ? currentSelectedEl.id = v : currentSelectedEl.removeAttribute('id');
});

document.getElementById('attr-class')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    currentSelectedEl.className = e.target.value;
});


// Редактирование атрибутов элемента
function createAttrRow(name, value) {
    const attrsTable = document.getElementById('attributes-table');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');

    td1.contentEditable = 'true';
    td1.dataset.placeholder = 'name';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = 'value';

    td1.textContent = name || '';
    td2.textContent = value || '';
    td1.dataset.prev = name || '';

    tr.append(td1, td2);

    if (name || value) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = () => removeAttrRow(tr, td1);
        tr.appendChild(td3);
    }

    attrsTable.appendChild(tr);
}

function removeAttrRow(tr, td1) {
    const prev = td1.dataset.prev || '';
    if (prev && currentSelectedEl) {
        currentSelectedEl.removeAttribute(prev);
    }
    tr.remove();
    ensureEmptyAttrRow();
}

function ensureEmptyAttrRow() {
    const t = document.getElementById('attributes-table');
    if (!t) return;

    const last = t.lastElementChild;
    if (
        !last ||
        last.children[0].textContent.trim() ||
        last.children[1].textContent.trim()
    ) {
        createAttrRow('', '');
    }
}

document.getElementById('attributes-table')?.addEventListener('input', e => {
    const td = e.target.closest('td');
    if (!td) return;

    const tr = td.parentNode;
    const nameTd = tr.children[0];
    const valTd = tr.children[1];

    const prev = nameTd.dataset.prev || '';
    const nameNow = nameTd.textContent.trim();
    const valNow = valTd.textContent;

    if (td === nameTd) {
        if (prev && prev !== nameNow && currentSelectedEl) {
            currentSelectedEl.removeAttribute(prev);
        }
        if (nameNow && currentSelectedEl) {
            currentSelectedEl.setAttribute(nameNow, valNow);
        }
        nameTd.dataset.prev = nameNow;
    } else {
        if (nameNow && currentSelectedEl) {
            currentSelectedEl.setAttribute(nameNow, valNow);
        }
    }

    if ((nameNow || valNow) && tr.children.length === 2) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = () => removeAttrRow(tr, nameTd);
        tr.appendChild(td3);
    }

    if (tr === tr.parentNode.lastElementChild && nameNow) {
        ensureEmptyAttrRow();
    }
});

document.getElementById('attributes-table')?.addEventListener('blur', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    const nameTd = tr.children[0];
    const prev = nameTd.dataset.prev || '';
    const nameNow = nameTd.textContent.trim();
    if (!nameNow && prev && currentSelectedEl) currentSelectedEl.removeAttribute(prev);
    if (!nameNow && tr !== tr.parentNode.lastElementChild) {
        tr.remove();
        ensureEmptyAttrRow();
    }
}, true);


// Редактирование свойства элемента
function getBlockIdFromEl(el) {
    let node = el;
    while (node) {
        if (node.id && node.id.endsWith('_view')) return node.id.replace(/_view$/, '');
        node = node.parentElement;
    }
    return null;
}

function updatePropertiesPanel(el) {
    const table = document.getElementById('properties-table');
    if (!table) return;
    table.innerHTML = '';
    const blockId = getBlockIdFromEl(el) || getActiveBlockId() || 'loadedBlock_1';
    let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
    const css = styleEl ? styleEl.textContent : '';
    const rules = parseCssToRules(css);
    const existingMap = new Map();
    const existingOrder = [];
    rules.forEach(r => {
        if (!existingMap.has(r.selector)) {
            existingMap.set(r.selector, r.decls);
            existingOrder.push(r.selector);
        }
    });
    const matchedSet = new Set();
    rules.forEach(r => {
        try {
            if (el.matches(r.selector)) matchedSet.add(r.selector);
        } catch (e) {
            const selStripped = r.selector.replace(/::[a-zA-Z0-9\-\(\)]+/g, '').trim();
            try { if (selStripped && el.matches(selStripped)) matchedSet.add(r.selector); } catch (e2) {}
        }
    });
    const candidates = [];
    const id = el.id ? '#' + el.id : null;
    const classes = Array.from(el.classList || []);
    const tag = el.tagName.toLowerCase();
    if (id) candidates.push(id);
    classes.forEach(c => candidates.push('.' + c));
    candidates.push(tag);
    const order = [];
    existingOrder.forEach(s => { if (matchedSet.has(s) && !order.includes(s)) order.push(s); });
    candidates.forEach(s => { if (!order.includes(s)) order.push(s); });
    if (order.length === 0) order.push(buildSelector(el));
    order.forEach(sel => {
        const trSel = document.createElement('tr');
        const tdSel = document.createElement('td');
        tdSel.colSpan = 3;
        tdSel.textContent = sel;
        trSel.appendChild(tdSel);
        table.appendChild(trSel);
        const decls = existingMap.get(sel) || '';
        decls.split(';').map(v => v.trim()).filter(Boolean).forEach(line => {
            const i = line.indexOf(':');
            const p = i !== -1 ? line.slice(0, i).trim() : '';
            const v = i !== -1 ? line.slice(i + 1).trim() : '';
            createPropRow(p, v, true);
        });
        createAddPropRow();
    });
}

function parseCssToRules(css) {
    const out = [];
    const re = /([^{]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        const selectorText = m[1].trim();
        const decls = m[2].trim();
        const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean);
        selectors.forEach(sel => out.push({ selector: sel, decls }));
    }
    return out;
}

function buildSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.className) return '.' + el.className.split(' ').filter(Boolean).join('.');
    return el.tagName.toLowerCase();
}

function createPropRow(prop, val, deletable) {
    const table = document.getElementById('properties-table');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    td1.contentEditable = 'true';
    td1.dataset.placeholder = td1.dataset.placeholder || 'property';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = td2.dataset.placeholder || 'value';
    td1.textContent = prop || '';
    td2.textContent = val || '';
    tr.append(td1, td2);
    if (deletable) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = () => {
            tr.remove();
            rebuildStyleForActive();
        };
        tr.appendChild(td3);
    }
    table.appendChild(tr);
}

function createAddPropRow() {
    const table = document.getElementById('properties-table');
    const last = table.lastElementChild;
    if (last && last.children.length === 2 && !last.children[0].textContent.trim() && !last.children[1].textContent.trim()) return;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    td1.contentEditable = 'true';
    td1.dataset.placeholder = 'property';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = 'value';
    td1.textContent = '';
    td2.textContent = '';
    tr.append(td1, td2);
    table.appendChild(tr);
}

document.getElementById('properties-table')?.addEventListener('input', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    if (tr.children.length === 2) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (prop && val) {
            if (!tr.children[2]) {
                const td3 = document.createElement('td');
                td3.textContent = '×';
                td3.style.cursor = 'pointer';
                td3.onclick = () => {
                    tr.remove();
                    rebuildStyleForActive();
                };
                tr.appendChild(td3);
            }
            ensureAddRowExists();
        }
    }
    rebuildStyleForActive();
});

document.getElementById('properties-table')?.addEventListener('blur', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    if (tr.children.length === 3) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (!prop && !val) {
            tr.remove();
            rebuildStyleForActive();
        }
    } else if (tr.children.length === 2) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (!prop && !val && tr !== tr.parentNode.lastElementChild) {
            tr.remove();
        } else {
            tr.children[0].dataset.placeholder = tr.children[0].dataset.placeholder || 'property';
            tr.children[1].dataset.placeholder = tr.children[1].dataset.placeholder || 'value';
        }
    }
}, true);

function ensureAddRowExists() {
    const table = document.getElementById('properties-table');
    const last = table.lastElementChild;
    if (!last || last.children.length !== 2) createAddPropRow();
    else {
        last.children[0].dataset.placeholder = last.children[0].dataset.placeholder || 'property';
        last.children[1].dataset.placeholder = last.children[1].dataset.placeholder || 'value';
    }
}

function rebuildStyleForActive() {
    const table = document.getElementById('properties-table');
    if (!table) return;
    const rows = Array.from(table.children);
    const newMap = new Map();
    let currentSelector = null;
    rows.forEach(r => {
        if (r.children.length === 1 || (r.children.length === 1 && r.children[0].colSpan === 3)) {
            currentSelector = r.children[0].textContent.trim();
            if (currentSelector && !newMap.has(currentSelector)) newMap.set(currentSelector, []);
        } else if (r.children.length >= 2 && currentSelector) {
            const p = r.children[0].textContent.trim();
            const v = r.children[1].textContent.trim();
            if (p && v) newMap.get(currentSelector).push(p + ': ' + v + ';');
        }
    });
    const activeEl = currentSelectedEl;
    const blockId = getBlockIdFromEl(activeEl) || getActiveBlockId() || 'loadedBlock_1';
    let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
    let existingCss = '';
    if (styleEl) existingCss = styleEl.textContent;
    const existingRules = parseCssToRules(existingCss);
    const existingOrder = existingRules.map(r => r.selector);
    const existingMap = new Map();
    existingRules.forEach(r => {
        if (!existingMap.has(r.selector)) existingMap.set(r.selector, r.decls);
    });
    const processed = new Set();
    const out = [];
    existingOrder.forEach(sel => {
        if (newMap.has(sel)) {
            const decls = newMap.get(sel).join(' ');
            out.push(sel + ' { ' + decls + ' }');
            processed.add(sel);
        } else {
            const decls = existingMap.get(sel);
            if (decls && decls.trim()) out.push(sel + ' { ' + decls + ' }');
        }
    });
    Array.from(newMap.keys()).forEach(sel => {
        if (!processed.has(sel) && sel) {
            const decls = newMap.get(sel).join(' ');
            if (decls) out.push(sel + ' { ' + decls + ' }');
        }
    });
    const cssText = out.join('\n');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-dynamic', blockId + '_view');
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain') || document.head;
        wrap.appendChild(styleEl);
    }
    styleEl.textContent = cssText;
}


// Редактирование js элемента

const jsTable = document.getElementById('editor-js-panel');

jsTable.innerHTML = '';

const events = [
    [
        'onclick',
        'ondblclick',
        'oncontextmenu'
    ],
    [
        'oninput',
        'onchange',
        'onfocus',
        'onblur',
        'onkeydown',
        'onkeyup',
        'onkeypress'
    ],
    [
        'onmouseover',
        'onmouseout',
        'onmouseenter',
        'onmouseleave',
        'ontouchstart',
        'ontouchmove',
        'ontouchend',
        'onpointerdown',
        'onpointerup',
        'onpointermove'
    ]
];

events.forEach((group, gi) => {
    group.forEach(ev => {
        const tr = document.createElement('tr');
        const tdEvent = document.createElement('td');
        const tdName = document.createElement('td');

        tdEvent.textContent = ev;
        tdEvent.contentEditable = 'false';

        tdName.contentEditable = 'true';
        tdName.dataset.placeholder = 'name';

        tr.appendChild(tdEvent);
        tr.appendChild(tdName);
        jsTable.appendChild(tr);
    });

    if (gi < events.length - 1) {
        const trHr = document.createElement('tr');
        const tdHr = document.createElement('td');
        tdHr.colSpan = 2;
        tdHr.innerHTML = '<hr>';
        trHr.appendChild(tdHr);
        jsTable.appendChild(trHr);
    }
});

function updateJsPanel(el) {
    const table = document.getElementById('editor-js-panel');
    const rows = Array.from(table.querySelectorAll('tr'));

    rows.forEach(tr => {
        const tdName = tr.children[1];
        if (tdName) tdName.textContent = '';
        tr.onclick = null;
        const tdEvent = tr.children[0];
        if (tdEvent) tdEvent.onclick = null;
    });

    const blockId = getBlockIdFromEl(el) || getActiveBlockId() || 'loadedBlock_1';
    const script = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (!script) return;

    const txt = script.textContent;
    const entries = [];

    const addListenerRe = /([^\n;]+?)\.addEventListener\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_$]+|function\b)/g;
    let m;

    while ((m = addListenerRe.exec(txt)) !== null) {
        const selector = resolveSelectorFromExpr(m[1].trim(), txt);
        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    const onAssignRe = /([^\n;]+?)\.on([a-zA-Z]+)\s*=\s*([A-Za-z0-9_$]+|function\b)/g;
    while ((m = onAssignRe.exec(txt)) !== null) {
        const selector = resolveSelectorFromExpr(m[1].trim(), txt);
        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    const matched = entries.filter(en => {
        if (!en.selector) return false;
        try {
            return el.matches(en.selector);
        } catch {
            const s = en.selector.replace(/::[a-zA-Z0-9\-\(\)]+/g, '').trim();
            try { return s && el.matches(s); } catch { return false; }
        }
    });

    if (!matched.length) {
        table.removeEventListener('blur', onJsTableBlur, true);
        table.removeEventListener('input', onJsTableInput);
        return;
    }

    const eventToSelector = new Map();
    matched.forEach(en => eventToSelector.set(en.event, en.selector));

    rows.forEach(tr => {
        const tdEvent = tr.children[0];
        const tdName = tr.children[1];
        if (!tdEvent || !tdName) return;

        const evName = tdEvent.textContent.trim();
        const found = matched.find(m => m.event === evName);
        if (!found) return;

        tdName.textContent = found.handler || '';

        tdEvent.onclick = () => {
            const jsTab = document.querySelector('#center-tabs .center-tab[data-tab="js"]');
            if (jsTab) jsTab.click();
            if (found.handler) {
                highlightInJsEditor('function ' + found.handler + '(', txt);
            } else {
                highlightInJsEditor(found.raw, txt);
            }
        };
    });

    table.removeEventListener('blur', onJsTableBlur, true);
    table.addEventListener('blur', onJsTableBlur, true);
    table.removeEventListener('input', onJsTableInput);
    table.addEventListener('input', onJsTableInput);

    function onJsTableInput(e) {
        const td = e.target.closest('td');
        if (!td) return;
        const tr = td.parentNode;
        if (!tr) return;
        const tdEvent = tr.children[0];
        const tdName = tr.children[1];
        if (!tdEvent || !tdName) return;
        if (td !== tdName) return;
        const ev = tdEvent.textContent.trim();
        const handler = tdName.textContent.trim();
        const selector = eventToSelector.get(ev);
        if (!selector) return;
        updateScriptAssignment(blockId, selector, ev, handler);
    }

    function onJsTableBlur(e) {
        const td = e.target.closest('td');
        if (!td) return;
        const tr = td.parentNode;
        if (!tr) return;
        const tdEvent = tr.children[0];
        const tdName = tr.children[1];
        if (!tdEvent || !tdName) return;
        if (td !== tdName) return;
        const ev = tdEvent.textContent.trim();
        const handler = tdName.textContent.trim();
        const selector = eventToSelector.get(ev);
        if (!selector) return;
        updateScriptAssignment(blockId, selector, ev, handler);
    }

    function updateScriptAssignment(blockId, selector, eventFull, handlerName) {
        const scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
        if (!scriptEl) return;
        let s = scriptEl.textContent;
        const ev = eventFull.replace(/^on/, '');

        const lhsCandidates = buildLhsCandidates(selector, s);

        const assignRegexFor = lhs => {
            return new RegExp('(^|\\n)\\s*' + escapeRegExp(lhs) + '\\.on' + ev + '\\s*=\\s*[^;\\n]*;?', 'g');
        };

        lhsCandidates.forEach(lhs => {
            s = s.replace(assignRegexFor(lhs), '');
        });

        if (handlerName) {
            const preferredLhs = lhsCandidates[0] || (selector.startsWith('#') ? "document.getElementById('" + selector.slice(1) + "')" : "document.querySelector('" + selector.replace(/'/g, "\\'") + "')");
            const line = preferredLhs + '.on' + ev + ' = ' + handlerName + ';';
            const insertBeforeIdx = findInsertIndexBeforeClosingIIFE(s);
            if (insertBeforeIdx !== -1) {
                s = s.slice(0, insertBeforeIdx) + '\n' + line + '\n' + s.slice(insertBeforeIdx);
            } else {
                s = s.trimEnd() + '\n' + line + '\n';
            }
        }

        scriptEl.textContent = s;
        // обновляем centerPreJs если открыт
        const blockPre = document.getElementById('center-tab-pre-js');
        const activeBlock = getActiveBlockId();
        if (blockPre && (getBlockIdFromEl(el) || activeBlock) === blockId) blockPre.textContent = scriptEl.textContent;
    }

    function buildLhsCandidates(selector, scriptText) {
        const out = [];
        const id = selector.startsWith('#') ? selector.slice(1) : null;
        const escapedSel = escapeRegExp(id || selector);
        const varAssignRe = new RegExp('\\b(var|let|const)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*document\\.(getElementById|querySelector(All)?)\\(\\s*[\'"]' + escapedSel + '[\'"]\\s*\\)', 'g');
        let mm;
        while ((mm = varAssignRe.exec(scriptText)) !== null) {
            out.push(mm[2]);
        }
        if (id) out.push("document.getElementById('" + id + "')");
        out.push("document.querySelector('" + selector.replace(/'/g, "\\'") + "')");
        return out;
    }

    function findInsertIndexBeforeClosingIIFE(text) {
        const iife = '})();';
        const idx = text.lastIndexOf(iife);
        if (idx !== -1) return idx;
        const lastClose = text.lastIndexOf('}');
        if (lastClose !== -1) return lastClose + 1;
        return -1;
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

function highlightInJsEditor(search, fullText) {
    const pre = document.getElementById('center-tab-pre-js');
    if (!pre) return;

    const idx = fullText.indexOf(search);
    if (idx === -1) return;

    let pos = 0;
    let node;
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);

    while ((node = walker.nextNode())) {
        const next = pos + node.length;
        if (idx >= pos && idx < next) {
            const range = document.createRange();
            range.setStart(node, idx - pos);
            range.setEnd(node, Math.min(node.length, idx - pos + search.length));

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const span = document.createElement('span');
            range.surroundContents(span);

            span.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                const parent = span.parentNode;
                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                parent.removeChild(span);
            }, 800);

            pre.focus();
            return;
        }
        pos = next;
    }
}

function resolveSelectorFromExpr(expr, scriptText) {
    expr = expr.trim();

    const idRe = /^document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)$/;
    const qsRe = /^document\.querySelector(All)?\(\s*['"]([^'"]+)['"]\s*\)$/;

    let m = idRe.exec(expr);
    if (m) return '#' + m[1];

    m = qsRe.exec(expr);
    if (m) return m[2];

    const varNameMatch = expr.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    if (!varNameMatch) return null;

    const varName = varNameMatch[0];

    const varAssignRe = new RegExp(
        '\\b(var|let|const)\\s+' + varName +
        '\\s*=\\s*document\\.(getElementById|querySelector(All)?)\\(\\s*[\'"]([^\'"]+)[\'"]\\s*\\)',
        'g'
    );

    let mm;
    while ((mm = varAssignRe.exec(scriptText)) !== null) {
        if (mm[2] === 'getElementById') return '#' + mm[4];
        return mm[4];
    }

    return null;
}
