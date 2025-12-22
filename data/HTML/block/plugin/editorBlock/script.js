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
function newLoadedBlock(path) {
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
closeBtn.onclick = e => {
    e.stopPropagation();
    const container = document.getElementById('loadedBlockMain');
    if (container && block) container.removeChild(block);
    if (tabEl.parentNode) tabEl.parentNode.removeChild(tabEl);

    centerPreHtml.textContent = '';
    centerPreJs.textContent = '';
    centerContent.style.display = 'none';
    document.getElementById('loadedBlock').style.display = '';
};

    tabEl.appendChild(closeBtn);

    switchTo(blockId, tabEl);

    loadBlock(path, viewDiv.id);
}


const centerTabs = document.querySelectorAll('#center-tabs .center-tab');
const centerContent = document.getElementById('center-tab-content');
const centerPreHtml = document.getElementById('center-tab-pre-html');
const centerPreJs = document.getElementById('center-tab-pre-js');
const btnLoadFromView = document.getElementById('btn-load-from-view');
const btnApplyToView = document.getElementById('btn-apply-to-view');
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
    if (!content) return;
    const funcName = 'blockJs_' + blockId + '_view';
    const wrapped = [];
    wrapped.push('function ' + funcName + '() {');
    wrapped.push('try {');
    wrapped.push(content);
    wrapped.push('} catch (e) { console.error(e); }');
    wrapped.push('}');
    wrapped.push(funcName + '();');

    let scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (!scriptEl) {
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
        scriptEl = document.createElement('script');
        scriptEl.setAttribute('data-dynamic', blockId + '_view');
        wrap.appendChild(scriptEl);
    }
    scriptEl.textContent = wrapped.join('\n');
    try { eval(scriptEl.textContent); } catch (e) { console.error(e); }
}

function updateCenterControls(mode) {
    btnLoadFromView.style.display = mode === 'html' ? '' : 'none';
    btnApplyToView.style.display = mode === 'html' ? '' : 'none';
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
    centerPreJs.textContent = scriptEl ? scriptEl.textContent : '';

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

btnLoadFromView.onclick = () => {
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
    const rendered = md.render(centerPreHtml.textContent);

    htmlDiv.innerHTML = rendered;
    view.innerHTML = rendered;
};

btnApplyJs.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    applyJs(blockId);
};


document.getElementById('elements-ul').addEventListener('click', e => {
    const el = e.target.closest('.add-el');
    if (!el) return;

    const tag = el.dataset.el;
    if (!tag) return;

    handleLoadedBlockView(tag);
    handlePreHtml(tag, el.textContent.includes('</>'));
});

function handleLoadedBlockView(tag) {
    const view = document.getElementById('loadedBlock_1_view');
    if (!view) return;

    const sel = document.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node || !view.contains(node)) return;

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


let currentSelectedEl = null;

document.addEventListener('click', e => {
    const view = document.getElementById('loadedBlock_1_view');
    if (!view) return;
    const clicked = e.target;
    if (!view.contains(clicked)) return;
    const el = clicked.closest('#loadedBlock_1_view, #loadedBlock_1_view *') || view;
    updateCssPanel(el);
});

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
    ensureEmptyRow();
}

function createAttrRow(name, value) {
    const attrsTable = document.getElementById('attributes-table');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    const td3 = document.createElement('td');
    td1.setAttribute('contenteditable', 'true');
    td1.setAttribute('data-placeholder', 'name');
    td2.setAttribute('contenteditable', 'true');
    td2.setAttribute('data-placeholder', 'value');
    td1.textContent = name || '';
    td2.textContent = value || '';
    td1.dataset.prev = name || '';
    td3.innerHTML = '×';
    td3.style.cursor = 'pointer';
    td3.addEventListener('click', () => {
        const prev = td1.dataset.prev || '';
        if (prev && currentSelectedEl) currentSelectedEl.removeAttribute(prev);
        tr.remove();
        ensureEmptyRow();
    });
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    attrsTable.appendChild(tr);
}

function ensureEmptyRow() {
    const attrsTable = document.getElementById('attributes-table');
    if (!attrsTable) return;
    const last = attrsTable.lastElementChild;
    if (!last) {
        createAttrRow('', '');
        return;
    }
    const nameTd = last.children[0];
    const valueTd = last.children[1];
    if (!nameTd || nameTd.textContent.trim() !== '' || (valueTd && valueTd.textContent.trim() !== '')) {
        createAttrRow('', '');
    }
}

document.getElementById('attr-id')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    const v = e.target.value.trim();
    if (v) currentSelectedEl.id = v; else currentSelectedEl.removeAttribute('id');
});

document.getElementById('attr-class')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    const v = e.target.value;
    currentSelectedEl.className = v;
});

document.getElementById('attributes-table')?.addEventListener('input', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    const nameTd = tr.children[0];
    const valueTd = tr.children[1];
    const prev = nameTd.dataset.prev || '';
    const nameNow = nameTd.textContent.trim();
    const valueNow = valueTd.textContent;
    if (td === nameTd) {
        if (prev && prev !== nameNow && currentSelectedEl) currentSelectedEl.removeAttribute(prev);
        if (nameNow && currentSelectedEl) currentSelectedEl.setAttribute(nameNow, valueNow);
        nameTd.dataset.prev = nameNow;
        if (isLastRow(tr) && nameNow) ensureEmptyRow();
    } else {
        if (nameNow && currentSelectedEl) currentSelectedEl.setAttribute(nameNow, valueNow);
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
    if (!nameNow && !isLastRow(tr)) {
        tr.remove();
        ensureEmptyRow();
    }
}, true);

function isLastRow(tr) {
    const attrsTable = document.getElementById('attributes-table');
    return attrsTable && attrsTable.lastElementChild === tr;
}
