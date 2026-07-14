/* ===
 * Работа с блоками
=== */

// Контейнер для загруженных блоков
const blocksContainers = document.getElementById('blocksContainers');
// Контейнер для вкладок блоков
const blocksTabs = document.getElementById('blocksTabs');

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
    
    if (existingBlock) {
        // Если блок уже загружен, открываем его вкладку
        const existingTab = blocksTabs.querySelector(`.blockTab[data-block-id="${existingBlock.id}"]`);
        openLoadedBlock(existingBlock.id);
    } else {
        // Если блок не загружен, загружаем его и создаём вкладку
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
    name.textContent = path.split('/').pop();
    name.className = 'tabName';
    name.addEventListener('click', () => {
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
    const jsDiv = document.getElementById(blockId + 'Js').querySelector('script');

    // Вставка содержимого в редакторы
    viewEditorСontent.innerHTML = htmlDiv.innerHTML;
    mdEditorContent.textContent = htmlDiv.innerHTML;
    jsEditorContent.innerHTML = jsDiv.innerHTML;
}

function closeBlockTab(blockId) {
    const tab = document.querySelector(`.blockTab[data-blockId="${blockId}"]`);
    const block = document.getElementById(blockId);
    if (tab) {
        blocksTabs.removeChild(tab);
    }
    if (block) {
        blocksContainers.removeChild(block);
    }
}