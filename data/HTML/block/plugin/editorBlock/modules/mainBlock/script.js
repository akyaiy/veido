/* ===
 * Работа с блоками
=== */

// Контейнер для загруженных блоков
const blocksContainers = document.getElementById('blocksContainers');
// Контейнер для вкладок блоков
const blocksTabs = document.getElementById('blocksTabs');
// Текущий активный блок
let currentBlockId = null;

/* ***
 * openBlock - открытие блока
 * - принимает путь блока
 * - проверяет, загружен ли блок
 * - если блок уже загружен, открывает его вкладку
 * - если блок не загружен, загружает его и создаёт вкладку
*** */
async function openBlock(path) {
    // Проверка, загружен ли блок
    const existingBlock = Array.from(blocksContainers.querySelectorAll('div[data-path]')).find(el => el.dataset.path === path);
    
    if (path === null) {
        // Если путь не указан, открываем пустой блок
        savePreviousBlock(currentBlockId);
        const blockId = await loadBlockContainer(null);
        addBlockTab(blockId);
    } else if (existingBlock) {
        // Если блок уже загружен, сохраняем предыдущий и открываем его вкладку
        savePreviousBlock(currentBlockId);
        const blockId = await openLoadedBlock(existingBlock.id);
    } else {
        // Если блок не загружен, сохраняем предыдущий, загружаем новый и создаём вкладку
        savePreviousBlock(currentBlockId);
        const blockId = await loadBlockContainer(path);
        addBlockTab(blockId, path);
    }
}
window.editorBlock.openBlock = openBlock;

/* ***
 * loadBlockContainer - загрузка блока в контейнер
 * - принимает путь блока
 * - создаёт контейнер блока
 * - загружает содержимое через loadBlock
*** */
async function loadBlockContainer(path) {
    // Создание уникального идентификатора блока
    let num = 1;
    while (document.getElementById('loadedBlock' + num)) {
        num++;
    }
    const blockId = 'loadedBlock' + num;

    // Создание контейнера блока
    const block = document.createElement('div');
    block.id = blockId;
    block.dataset.path = path;

    const htmlDiv = document.createElement('div');
    htmlDiv.id = blockId + 'Html';
    const cssDiv = document.createElement('div');
    cssDiv.id = blockId + 'Css';
    const jsDiv = document.createElement('div');
    jsDiv.id = blockId + 'Js';

    blocksContainers.appendChild(block);
    block.appendChild(htmlDiv);
    block.appendChild(cssDiv);
    block.appendChild(jsDiv);

    if (path !== null) {
        // Загрузка содержимого блока
        await loadBlock(path, htmlDiv.id, true);

        // Перенос CSS блока
        document.querySelectorAll('style[data-dynamic="' + htmlDiv.id + '"]').forEach(style => {
            cssDiv.appendChild(style.cloneNode(true));
            style.remove();
        });

        // Перенос JS блока
        document.querySelectorAll('script[data-dynamic="' + htmlDiv.id + '"]').forEach(script => {
            jsDiv.appendChild(script.cloneNode(true));
            script.remove();
        });
    } else {
        // Если путь не указан, создаём пустой блок
        htmlDiv.innerHTML = '';
        cssDiv.appendChild(document.createElement('style'));
        jsDiv.appendChild(document.createElement('script'));
    }

    return blockId;
}

/* ***
 * addBlockTab - добавление вкладки блока
 * - принимает идентификатор блока
 * - создаёт вкладку
*** */
function addBlockTab(blockId, path) {
    // Создание вкладки блока
    const tab = document.createElement('div');
    tab.className = 'blockTab';
    tab.dataset.blockId = blockId;

    const name = document.createElement('span');
    if (path) {
        name.textContent = path.split('/').pop();
    } else {
        name.textContent = '*new';
    }
    name.className = 'tabName';
    name.addEventListener('click', () => {
        savePreviousBlock(currentBlockId);
        openLoadedBlock(blockId);
    });

    const close = document.createElement('span');
    close.textContent = '×';
    close.className = 'tabClose';
    close.addEventListener('click', () => {
        closeBlockTab(blockId);
    });

    // Добавление вкладки в контейнер
    tab.appendChild(name);
    tab.appendChild(close);

    blocksTabs.appendChild(tab);

    // Открытие загруженного блока
    openLoadedBlock(blockId);
}

/* ***
 * setActiveBlockTab - установка активной вкладки блока
 * - принимает идентификатор блока
 * - устанавливает класс active для соответствующей вкладки
*** */
function setActiveBlockTab(blockId) {
    // Снятие класса active со всех вкладок
    blocksTabs.querySelectorAll('.blockTab.active').forEach(tab => tab.classList.remove('active'));
    // Установка активной вкладки блока
    const newTab = blocksTabs.querySelector(`.blockTab[data-block-id="${blockId}"]`);
    if (newTab) newTab.classList.add('active');
}

/* ***
 * closeBlockTab - закрытие вкладки блока
 * - принимает идентификатор блока
 * - удаляет вкладку и контейнер блока
*** */
function closeBlockTab(blockId) {
    // Удаление вкладки и контейнера блока
    const tab = blocksTabs.querySelector(`.blockTab[data-block-id="${blockId}"]`);
    const block = document.getElementById(blockId);
    if (tab) blocksTabs.removeChild(tab);
    if (block) blocksContainers.removeChild(block);

    // Если закрываемый блок был активным, очистить текущий активный блок и редакторы
    if (currentBlockId === blockId) {
        currentBlockId = null;
        const viewEditorСontent = document.getElementById('viewEditorСontent');
        const mdEditorContent = document.getElementById('mdEditorContent');
        const jsEditorContent = document.getElementById('jsEditorContent');
        if (viewEditorСontent) viewEditorСontent.innerHTML = '';
        if (mdEditorContent) mdEditorContent.textContent = '';
        if (jsEditorContent) jsEditorContent.innerHTML = '';
    }
}

/* ***
 * openLoadedBlock - загрузка сохраненного блока в редакторы
 * - принимает ID загружаемого блока
 * - вставляет HTML-код в редактор представления
 * - оборачивает и вставляет CSS-код в тег style
 * - оборачивает и вставляет JS-код в тег script
*** */
function openLoadedBlock(blockId) {
    if (!blockId) {
        return;
    }

    // Редакторы
    const viewEditorСontent = document.getElementById('viewEditorСontent');
    const mdEditorContent = document.getElementById('mdEditorContent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    // Получение содержимого блока
    const htmlDiv = document.getElementById(blockId + 'Html');
    const jsScript = document.getElementById(blockId + 'Js')?.querySelector('script');
    const htmlContent = htmlDiv ? htmlDiv.innerHTML : '';
    const jsContent = jsScript ? jsScript.innerHTML : '';

    // Вставка содержимого в редакторы
    viewEditorСontent.innerHTML = htmlContent;
    mdEditorContent.textContent = htmlContent;
    jsEditorContent.innerHTML = jsContent;

    // Обновление текущего активного блока
    currentBlockId = blockId;
    setActiveBlockTab(blockId);
}

/* ***
 * savePreviousBlock - сохранение содержимого предыдущего блока
 * - сохраняет HTML и JS код в соответствующие контейнеры блока
*** */
function savePreviousBlock(currentBlockId) {
    if (!currentBlockId) return;

    // Синхронизация содержимого между редакторами
    syncEditors();

    // Контейнеры для содержимого редакторов
    const htmlDiv = document.getElementById(currentBlockId + 'Html');
    const jsDiv = document.getElementById(currentBlockId + 'Js');
    const viewEditorСontent = document.getElementById('viewEditorСontent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    // Сохранение содержимого редакторов в контейнер блока
    htmlDiv.innerHTML = viewEditorСontent.innerHTML;

    let script = jsDiv.querySelector('script');
    if (!script) {
        script = document.createElement('script');
        jsDiv.appendChild(script);
    }
    script.setAttribute('data-dynamic', currentBlockId + 'Html');
    script.setAttribute('type', 'text/plain');
    script.innerHTML = jsEditorContent.innerHTML;
}

/* ***
 * newBlock - создание нового блока
 * - открывает пустой блок в редакторе
*** */
function newBlock() {
    openBlock(null);
}
window.editorBlock.newBlock = newBlock;

/* ***
 * saveBlock - сохранение текущего блока
 * // Заменить потом!!!!!
*** */
function saveBlock() {
    const viewEditorСontent = document.getElementById('viewEditorСontent');
    const mdEditorContent = document.getElementById('mdEditorContent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    if (!viewEditorСontent || !mdEditorContent || !jsEditorContent) {
        return '';
    }

    return JSON.stringify({
        html: viewEditorСontent.innerHTML,
        md: mdEditorContent.textContent,
        js: jsEditorContent.innerHTML,
        blockId: currentBlockId
    });
}
window.editorBlock.saveBlock = saveBlock;



/* ===
 * Редакторы 
=== */

/* ***
 * focusEditor - фокусировка на редакторе
 * - принимает контейнер содержимого редактора
 * - устанавливает курсор в редакторе
*** */
function focusEditor(editorContent) {
    if (!editorContent) {
        return;
    }

    // Если внутри редактора уже есть активное выделение, не сбрасываем его
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed &&
        (editorContent.contains(selection.anchorNode) || editorContent.contains(selection.focusNode))) {
        return;
    }

    // Устанавливаем фокус в содержимом редактора
    editorContent.focus();

    const range = document.createRange();
    range.selectNodeContents(editorContent);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
}

document.addEventListener('editorBlockLoaded', () => {
    // Редакторы
    const viewEditor = document.getElementById('viewEditor');
    const mdEditor = document.getElementById('mdEditor');
    const jsEditor = document.getElementById('jsEditor');

    // Контейнеры для содержимого редакторов
    const viewEditorContent = document.getElementById('viewEditorСontent');
    const mdEditorContent = document.getElementById('mdEditorContent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    // Добавление обработчиков кликов для редакторов
    viewEditor.addEventListener('click', event => {
        if (event.target !== event.currentTarget) {
            return;
        }

        focusEditor(viewEditorContent);
    });

    mdEditor.addEventListener('click', event => {
        if (event.target !== event.currentTarget) {
            return;
        }

        focusEditor(mdEditorContent);
    });
    
    jsEditor.addEventListener('click', event => {
        if (event.target !== event.currentTarget) {
            return;
        }

        focusEditor(jsEditorContent);
    });
});

/* ***
 * syncEditors - синхронизация содержимого между редакторами
 * - если активен viewEditor, копирует его содержимое в mdEditor
 * - если активен mdEditor, копирует его содержимое в viewEditor
*** */
function syncEditors() {
    const activeEditor = document.querySelector('#viewBlock > .active');

    const mdEditorContent = document.getElementById('mdEditorContent');
    const viewEditorСontent = document.getElementById('viewEditorСontent');

    if (activeEditor.id === 'viewEditor') {
        mdEditorContent.textContent = viewEditorСontent.innerHTML;
    } else if (activeEditor.id === 'mdEditor') {
        viewEditorСontent.innerHTML = mdEditorContent.textContent;
    }
}
window.editorBlock.syncEditors = syncEditors;

document.addEventListener('editorBlockLoaded', () => {
    // Контейнеры для содержимого редакторов
    const mdEditorContent = document.getElementById('mdEditorContent');
    const viewEditorСontent = document.getElementById('viewEditorСontent');

    // Добавление обработчиков ввода для синхронизации между редакторами
    viewEditorСontent.addEventListener('input', () => {
        syncEditors();
    });
    mdEditorContent.addEventListener('input', () => {
        syncEditors();
    });
});



/* ===
 * Логика выделения элементов в редакторе
=== */

// Сохранение выделения 
let savedRange = null;
let savedSelectionElement = null;

/* ***
 * saveSelection - сохранение текущего выделения
 * - сохраняет текущий range в savedRange
 * - проверяет, находится ли выделение внутри contenteditable
 * - если да, сохраняет range
*** */
function saveSelection() {
    // Проверка, есть ли текущее выделение
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Получение узла, содержащего выделение
    let node = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    // Проверка, находится ли узел внутри contenteditable
    const editableElement = node ? node.closest('[contenteditable="true"], [contenteditable="plaintext-only"]') : null;
    if (editableElement) {
        const range = sel.getRangeAt(0);
        if (editableElement.contains(range.commonAncestorContainer)) {
            savedRange = range.cloneRange();
            savedSelectionElement = editableElement;
        }
    }
}

/* ***
 * restoreSelection - восстановление сохранённого выделения
 * - восстанавливает ранее сохранённый range
 * - возвращает фокус редактируемому элементу
*** */
window.restoreSelection = restoreSelection;
function restoreSelection() {
    if (!savedRange) return;

    const sel = window.getSelection();
    if (!sel) return;

    if (savedSelectionElement && savedSelectionElement.isConnected) {
        savedSelectionElement.focus();
    }

    sel.removeAllRanges();
    sel.addRange(savedRange);
}

// События для сохранения выделения при начале/завершении клика, при отпускании клавиши и при изменении выделения
document.addEventListener('mousedown', saveSelection);
document.addEventListener('mouseup', saveSelection);
document.addEventListener('keyup', saveSelection);
document.addEventListener('selectionchange', saveSelection);