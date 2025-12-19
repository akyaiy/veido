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
const center = document.getElementById('center-panel');

let active = false;
let sx, sy, sw, sh;

handle.onmousedown = e => {
    e.preventDefault();
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    sw = center.offsetWidth;
    sh = center.offsetHeight;
    document.onmousemove = move;
    document.onmouseup = () => active = false;
};

function move(e) {
    if (!active) return;

    let w = sw + e.clientX - sx;
    let h = sh + e.clientY - sy;

    if (w < 260) w = 260;
    if (h < 140) h = 140;

    center.style.width = w + 'px';
    center.style.height = h + 'px';
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
    let container = document.getElementById('loadedBlock');
    if (!container) {
        container = document.createElement('div');
        container.id = 'loadedBlock';
        mainEl.appendChild(container);
    }

    let existingTab;
    tabs.querySelectorAll('.tab').forEach(t => {
        if (t.dataset.path === path) existingTab = t;
    });

    function switchTo(blockId, tabEl) {
        tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (tabEl) tabEl.classList.add('active');
        Array.from(container.children).forEach(ch => ch.style.display = ch.id === blockId ? '' : 'none');
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
    container.appendChild(block);

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.path = path;
    tabEl.dataset.blockId = blockId;
    tabEl.textContent = path.split('/').filter(Boolean).pop() || path;
    tabEl.onclick = () => switchTo(blockId, tabEl);
    tabs.appendChild(tabEl);

    switchTo(blockId, tabEl);
    loadBlock(path, blockId);
}
