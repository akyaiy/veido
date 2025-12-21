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

    const scriptsDiv = document.createElement('div');
    scriptsDiv.id = blockId + '_scripts';

    block.appendChild(viewDiv);
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
    };
    tabEl.appendChild(closeBtn);

    switchTo(blockId, tabEl);

    loadBlock(path, viewDiv.id);

    const moveBodyScripts = () => {
        const scripts = document.querySelectorAll(
            'script[data-dynamic="' + viewDiv.id + '"]'
        );
        if (!scripts.length) return false;

        scripts.forEach(s => {
            scriptsDiv.appendChild(s);
        });

        return true;
    };

    const observer = new MutationObserver(() => {
        if (moveBodyScripts()) observer.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}


const centerTabs = document.querySelectorAll('#center-tabs .center-tab');

let centerContent = document.getElementById('center-tab-content');
if (!centerContent) {
    centerContent = document.createElement('div');
    centerContent.id = 'center-tab-content';

    const pre = document.createElement('pre');
    pre.id = 'center-tab-pre';
    pre.contentEditable = 'true';
    centerContent.appendChild(pre);

    document.getElementById('center-panel').appendChild(centerContent);
}
const centerPre = document.getElementById('center-tab-pre');

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

let lastCenterMode = 'view';

function applyJs(blockId) {
    const content = centerPre ? centerPre.textContent || '' : '';
    if (!content) return;

    const wrapped = `
        function blockJs_${blockId}() {
            try {
${content.split('\n').map(line => '                ' + line).join('\n')}
            } catch (e) {
                console.error("Error in block ${blockId}:", e);
            }
        }
        blockJs_${blockId}();
    `;

    eval(wrapped);
}

function showView(blockId) {
    if (centerContent.style.display !== 'none') {
        if (lastCenterMode === 'html') {
            const view = document.getElementById(blockId + '_view');
            if (view) view.innerHTML = centerPre.textContent;
        } else if (lastCenterMode === 'js') {
            const scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
            if (scriptEl) scriptEl.textContent = centerPre.textContent;
            applyJs(blockId);
        }
    }

    centerContent.style.display = 'none';

    const container = document.getElementById('loadedBlockMain');
    if (!container) return;

    Array.from(container.children).forEach(ch => {
        if (ch !== handle) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    const loadedBlock = document.getElementById('loadedBlock');
    if (loadedBlock) loadedBlock.style.display = '';

    lastCenterMode = 'view';
}

function showHtml(blockId) {
    if (centerContent.style.display !== 'none' && lastCenterMode === 'js') {
        const scriptEl = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
        if (scriptEl) scriptEl.textContent = centerPre.textContent;
        applyJs(blockId);
    }

    const view = document.getElementById(blockId + '_view');

    centerContent.style.display = '';
    centerPre.textContent = view ? view.innerHTML : '';

    const container = document.getElementById('loadedBlockMain');
    if (container) {
        Array.from(container.children).forEach(ch => {
            if (ch !== handle) ch.style.display = 'none';
        });
    }
    const loadedBlock = document.getElementById('loadedBlock');
    if (loadedBlock) loadedBlock.style.display = 'none';

    lastCenterMode = 'html';
}

function showJs(blockId) {
    if (centerContent.style.display !== 'none' && lastCenterMode === 'html') {
        const view = document.getElementById(blockId + '_view');
        if (view) view.innerHTML = centerPre.textContent;
    }

    const scriptsWrap = document.getElementById(blockId + '_scripts');

    centerContent.style.display = '';
    if (!scriptsWrap) {
        centerPre.textContent = '';
    } else {
        const scripts = Array.from(scriptsWrap.querySelectorAll('script'));
        centerPre.textContent = scripts
            .map(s => s.textContent || s.innerText || '')
            .join('\n\n');
    }

    const container = document.getElementById('loadedBlockMain');
    if (container) {
        Array.from(container.children).forEach(ch => {
            if (ch !== handle) ch.style.display = 'none';
        });
    }
    const loadedBlock = document.getElementById('loadedBlock');
    if (loadedBlock) loadedBlock.style.display = 'none';

    applyJs(blockId);

    lastCenterMode = 'js';
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

document.addEventListener('click', e => {
    const tab = e.target.closest('#blocks-tabs .tab');
    if (!tab) return;

    const blockId = tab.dataset.blockId;
    if (!blockId) return;

    const activeCenterTab = document.querySelector('#center-tabs .center-tab.active');
    if (!activeCenterTab) return;

    if (activeCenterTab.dataset.tab === 'view') showView(blockId);
    if (activeCenterTab.dataset.tab === 'html') showHtml(blockId);
    if (activeCenterTab.dataset.tab === 'js') showJs(blockId);
});
