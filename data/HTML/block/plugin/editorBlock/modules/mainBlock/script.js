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
 * - если path === null, может также принимать начальный HTML-элемент
 * - проверяет, загружен ли блок
 * - если блок уже загружен, открывает его вкладку
 * - если блок не загружен, загружает новый и создаёт вкладку
*** */
async function openBlock(path, initialElement = null) {
    const resolvedPath = normalizeBlockPath(path || (initialElement ? initialElement.getAttribute('data-block-src') : null));
    const existingBlock = resolvedPath ? Array.from(blocksContainers.querySelectorAll('div[data-path]')).find(el => normalizeBlockPath(el.dataset.path) === resolvedPath) : null;

    if (resolvedPath === null && path === null) {
        // Если путь не указан, открываем пустой блок или блок из элемента
        savePreviousBlock(currentBlockId);
        const blockId = await loadBlockContainer(null, initialElement);
        addBlockTab(blockId);
    } else if (existingBlock) {
        // Если блок уже загружен, сохраняем предыдущий и открываем его вкладку
        savePreviousBlock(currentBlockId);
        await openLoadedBlock(existingBlock.id);
    } else {
        // Если блок не загружен, сохраняем предыдущий, загружаем новый и создаём вкладку
        savePreviousBlock(currentBlockId);
        const blockId = await loadBlockContainer(resolvedPath, initialElement);
        addBlockTab(blockId, resolvedPath);
    }
}
window.editorBlock.openBlock = openBlock;

/* ***
 * getBlockPathById - получение пути блока по его идентификатору
 * - принимает идентификатор блока
 * - возвращает путь блока или null, если блок не найден
*** */
function normalizeBlockPath(path) {
    return path ? path.replace(/^\/+/, '') : null;
}

/* ***
 * loadBlockContainer - загрузка блока в контейнер
 * - принимает путь блока
 * - создаёт контейнер блока
 * - загружает содержимое через loadBlock
*** */
async function loadBlockContainer(path, initialElement = null) {
    // Создание уникального идентификатора блока
    let num = 1;
    while (document.getElementById('loadedBlock' + num)) {
        num++;
    }
    const blockId = 'loadedBlock' + num;

    // Создание контейнера блока
    const block = document.createElement('div');
    block.id = blockId;

    // Задаем data-path только если путь передан
    if (path) {
        block.dataset.path = path;
    }

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

    // Убеждаемся, что получаем правильный конструктор Element даже из iframe
    const isElementNode = initialElement && (
        (initialElement.ownerDocument && initialElement instanceof initialElement.ownerDocument.defaultView.Element) ||
        initialElement.nodeType === Node.ELEMENT_NODE
    );

    const isFragmentNode = initialElement && initialElement.nodeType === Node.DOCUMENT_FRAGMENT_NODE;

    if (path !== null) {
        // Загрузка содержимого блока как текст
        await loadBlock(path, htmlDiv.id, true);
    } else if (isElementNode) {
        // Открываем новый блок из переданного DOM-элемента (учитывая элементы из iframe)
        htmlDiv.textContent = initialElement.outerHTML;
        cssDiv.textContent = '';
        jsDiv.textContent = '';
    } else if (isFragmentNode) {
        // Открываем новый блок из переданного фрагмента HTML
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(initialElement.cloneNode(true));
        htmlDiv.textContent = tempDiv.innerHTML;
        cssDiv.textContent = '';
        jsDiv.textContent = '';
    } else if (typeof initialElement === 'string') {
        // Открываем новый блок из HTML-строки
        htmlDiv.textContent = initialElement;
        cssDiv.textContent = '';
        jsDiv.textContent = '';
    } else {
        // Если путь не указан и элемент не передан, создаём пустой текстовый блок
        htmlDiv.textContent = '';
        cssDiv.textContent = '';
        jsDiv.textContent = '';
    }

    return blockId;
}

/* ***
 * addBlockTab - добавление вкладки блока
 * - принимает идентификатор блока и путь
 * - создаёт вкладку с соответствующим названием
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
        // Собираем названия всех текущих вкладок
        const existingNames = Array.from(blocksTabs.querySelectorAll('.tabName')).map(el => el.textContent);
        
        // Находим наименьший свободный номер для *new
        let newNum = 1;
        while (existingNames.includes('*new' + newNum)) {
            newNum++;
        }
        name.textContent = '*new' + newNum;
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
        setEditorReadOnlyState(true);
        const viewEditorContent = document.getElementById('viewEditorContent');
        const mdEditorContent = document.getElementById('mdEditorContent');
        const jsEditorContent = document.getElementById('jsEditorContent');
        if (viewEditorContent) {
            viewEditorContent.innerHTML = '';
            showViewEditorEmptyState();
        }
        if (mdEditorContent) mdEditorContent.textContent = '';
        if (jsEditorContent) jsEditorContent.innerHTML = '';
    }
}

/* ***
 * normalizeViewEditorHtml - удаление пустых строк без изменения HTML-структуры
 * - убирает только строки, состоящие из пробелов/переносов
*** */
function normalizeViewEditorHtml(html) {
    if (!html) {
        return '';
    }

    return html
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n');
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
    const viewEditorContent = document.getElementById('viewEditorContent');
    const mdEditorContent = document.getElementById('mdEditorContent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    // Получение содержимого блока
    const htmlDiv = document.getElementById(blockId + 'Html');
    const cssDiv = document.getElementById(blockId + 'Css');
    const jsDiv = document.getElementById(blockId + 'Js');
    const htmlContent = htmlDiv ? htmlDiv.textContent : '';
    const cssContent = cssDiv ? cssDiv.textContent : '';
    const jsContent = jsDiv ? jsDiv.textContent : '';

    if (window.editorBlock && typeof window.editorBlock.setHistoryInitializing === 'function') {
        window.editorBlock.setHistoryInitializing(true);
    }

    // Вставка содержимого в редакторы
    if (viewEditorContent) {
        viewEditorContent.innerHTML = '';
        showViewEditorEmptyState();

        const iframe = document.createElement('iframe');
        iframe.id = 'viewEditorIframe';

        const safeCss = cssContent || '';
        const md = window.markdownit({ html: true, linkify: true, typographer: true });
        const normalizedHtml = normalizeViewEditorHtml(htmlContent);
        const renderedHtml = md.render(normalizedHtml);
        iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${safeCss}</style>
</head>
<body contenteditable="true" spellcheck="false">${renderedHtml}</body>
</html>`;

        iframe.addEventListener('load', () => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc && jsContent) {
                const scriptEl = iframeDoc.createElement('script');
                scriptEl.type = 'text/javascript';
                scriptEl.text = jsContent;
                iframeDoc.head.appendChild(scriptEl);
            }

            if (iframeDoc && iframeDoc.body) {
                showViewEditorEmptyState();

                const blockLoader = (typeof window.loadBlockAttribute === 'function' && window.loadBlockAttribute)
                    || (typeof loadBlockAttribute === 'function' && loadBlockAttribute);

                if (blockLoader) {
                    blockLoader(iframeDoc.body);
                }

                iframeDoc.body.querySelectorAll('[data-block-src]').forEach(element => {
                    element.setAttribute('contenteditable', 'false');
                    element.querySelectorAll('*').forEach(child => child.setAttribute('contenteditable', 'false'));
                });
            }

            attachIframeSelectionHandlers(iframe);
            if (window.editorBlock && typeof window.editorBlock.initTreeElements === 'function') {
                window.editorBlock.initTreeElements(iframe);
            }
            if (window.editorBlock && typeof window.editorBlock.attachIframeHistoryEvents === 'function') {
                window.editorBlock.attachIframeHistoryEvents(iframe);
            }
            if (window.editorBlock && typeof window.editorBlock.setHistoryInitializing === 'function') {
                window.editorBlock.setHistoryInitializing(false);
            }
            if (window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
                window.editorBlock.saveHistoryState();
            }
            const inputTarget = iframeDoc.body || iframeDoc.documentElement;

            inputTarget.addEventListener('input', () => {
                syncEditors();
                showViewEditorEmptyState();
            });

            iframeDoc.addEventListener('mousedown', (event) => {
                blockEditorSelection(event);
                const iframeWin = iframe.contentWindow;
                const iframeSelection = iframeWin && iframeWin.getSelection ? iframeWin.getSelection() : null;
                textSelectionRangeBeforeClick = (iframeSelection && !iframeSelection.isCollapsed)
                    ? iframeSelection.getRangeAt(0).cloneRange()
                    : null;
            });
            iframeDoc.addEventListener('selectstart', blockEditorSelection);

            iframeDoc.addEventListener('click', handleVisualEditorClick);
            iframeDoc.addEventListener('contextmenu', handleVisualEditorClick);
            iframeDoc.addEventListener('mouseover', handleVisualEditorHover);
            iframeDoc.addEventListener('mouseout', handleVisualEditorMouseOut);

            iframeDoc.addEventListener('contextmenu', window.editorBlock.handleContextMenu);

            iframeDoc.addEventListener('click', window.editorBlock.handleMenuHide);
            iframeDoc.addEventListener('input', window.editorBlock.handleMenuHide);
            iframeDoc.addEventListener('paste', window.editorBlock.handleMenuHide);
            
            iframeDoc.addEventListener('mousedown', window.editorBlock.handleMenuHide);
            iframeDoc.addEventListener('click', window.editorBlock.hideElementMenu);

            if (viewEditorContent.classList.contains('preview') &&
                window.editorBlock && typeof window.editorBlock.loadNestedBlocksInPreview === 'function') {
                window.editorBlock.loadNestedBlocksInPreview();
            }
        });
        viewEditorContent.appendChild(iframe);
    }

    if (mdEditorContent) {
        mdEditorContent.textContent = htmlContent;
    }
    if (jsEditorContent) {
        jsEditorContent.innerHTML = jsContent;
    }

    // Обновление текущего активного блока
    currentBlockId = blockId;
    setEditorReadOnlyState(false);
    setActiveBlockTab(blockId);
}

// Обновление блока при открытии вкладки
document.addEventListener('editorBlock:openLoadedBlock', () => {
    // Сохраняем содержимое предыдущего блока
    savePreviousBlock(currentBlockId);

    // Перезагружаем текущий блок заново в iframe
    if (currentBlockId) {
        openLoadedBlock(currentBlockId);
    }
});

/* ***
 * showViewEditorEmptyState - показать пустое состояние визуального редактора
 * - отображает подсказку, если активного блока нет и в iframe нет содержимого
 * - скрывает подсказку, как только контент появился
*** */
function showViewEditorEmptyState() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    if (!viewEditorContent) {
        return;
    }

    const iframe = viewEditorContent.querySelector('iframe');
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;
    const iframeBody = iframeDoc ? iframeDoc.body : null;
    const htmlContent = iframeBody ? iframeBody.innerHTML : '';
    const hasActualContent = Boolean(htmlContent && htmlContent.trim().replace(/<(br|hr)\s*\/?>/gi, '').trim());

    if (!hasActualContent && !currentBlockId) {
        if (!document.getElementById('viewEditorEmptyState')) {
            const emptyState = document.createElement('div');
            emptyState.id = 'viewEditorEmptyState';
            emptyState.textContent = 'Откройте или создайте редактируемый блок';
            viewEditorContent.style.position = 'relative';
            viewEditorContent.appendChild(emptyState);
        }
        return;
    }

    const emptyState = document.getElementById('viewEditorEmptyState');
    if (emptyState) {
        emptyState.remove();
    }
}


/* ***
 * savePreviousBlock - сохранение содержимого предыдущего блока
 * - сохраняет HTML и JS код в соответствующие контейнеры блока
*** */
function savePreviousBlock(currentBlockId) {
    if (!currentBlockId) return;

    // Контейнеры для содержимого редакторов
    const htmlDiv = document.getElementById(currentBlockId + 'Html');
    const jsDiv = document.getElementById(currentBlockId + 'Js');
    const mdEditorContent = document.getElementById('mdEditorContent');
    const viewEditorContent = document.getElementById('viewEditorContent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    // Если viewEditorContent находится в режиме предпросмотра, выходим
    if (!currentBlockId || (viewEditorContent && viewEditorContent.classList.contains('preview'))) {
        return;
    }

    // Синхронизация содержимого между редакторами
    syncEditors();

    // Сохранение содержимого редакторов в контейнер блока
    if (htmlDiv) {
        const iframe = viewEditorContent ? viewEditorContent.querySelector('iframe') : null;
        let iframeHtml = null;

        if (iframe) {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            iframeHtml = iframeDoc?.body?.innerHTML;
        }

        const mdText = mdEditorContent ? ('value' in mdEditorContent ? mdEditorContent.value : mdEditorContent.textContent) : null;
        const oldHtml = htmlDiv.textContent;

        // Сохраняем новое значение только если оно не пустое, иначе оставляем oldHtml
        if (iframeHtml && iframeHtml.trim() !== '') {
            htmlDiv.textContent = iframeHtml;
        } else if (mdText && mdText.trim() !== '') {
            htmlDiv.textContent = mdText;
        } else if (!oldHtml || oldHtml.trim() === '') {
            htmlDiv.textContent = '';
        }
    }

    if (jsDiv && jsEditorContent) {
        const jsText = ('value' in jsEditorContent) ? jsEditorContent.value : jsEditorContent.textContent;
        if (jsText && jsText.trim() !== '') {
            jsDiv.textContent = jsText;
        }
    }
}
window.editorBlock.savePreviousBlock = savePreviousBlock;

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
    const viewEditorContent = document.getElementById('viewEditorContent');
    const mdEditorContent = document.getElementById('mdEditorContent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    if (!viewEditorContent || !mdEditorContent || !jsEditorContent) {
        return '';
    }

    return JSON.stringify({
        html: viewEditorContent.innerHTML,
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

    const iframe = editorContent.querySelector('iframe');

    if (iframe) {
        iframe.contentWindow.focus();
        return;
    }

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed &&
        (editorContent.contains(selection.anchorNode) || editorContent.contains(selection.focusNode))) {
        return;
    }

    editorContent.focus();

    const range = document.createRange();
    range.selectNodeContents(editorContent);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
}

document.addEventListener('editorBlock:loaded', () => {
    setEditorReadOnlyState(!Boolean(currentBlockId));

    // Редакторы
    const viewEditor = document.getElementById('viewEditor');
    const mdEditor = document.getElementById('mdEditor');
    const jsEditor = document.getElementById('jsEditor');

    // Контейнеры для содержимого редакторов
    const viewEditorContent = document.getElementById('viewEditorContent');
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
    const viewEditorContent = document.getElementById('viewEditorContent');
    const iframe = viewEditorContent ? viewEditorContent.querySelector('iframe') : null;
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;
    const iframeBody = iframeDoc ? iframeDoc.body : null;

    if (activeEditor.id === 'viewEditor') {
        if (iframeBody) {
            mdEditorContent.textContent = iframeBody.innerHTML;
        } else if (viewEditorContent) {
            mdEditorContent.textContent = viewEditorContent.innerHTML;
        }
    } else if (activeEditor.id === 'mdEditor') {
        if (iframeBody) {
            iframeBody.innerHTML = mdEditorContent.textContent;
        } else if (viewEditorContent) {
            viewEditorContent.innerHTML = mdEditorContent.textContent;
        }
    }
}
window.editorBlock.syncEditors = syncEditors;

document.addEventListener('editorBlock:loaded', () => {
    document.addEventListener('mousedown', blockEditorSelection, true);
    document.addEventListener('mouseup', blockEditorSelection, true);
    document.addEventListener('selectstart', blockEditorSelection, true);

    // Контейнеры для содержимого редакторов
    const mdEditorContent = document.getElementById('mdEditorContent');
    const viewEditorContent = document.getElementById('viewEditorContent');

    // Добавление обработчиков ввода для синхронизации между редакторами
    viewEditorContent.addEventListener('input', () => {
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
    const iframeSelection = getIframeSelection();
    const sel = iframeSelection && iframeSelection.rangeCount ? iframeSelection : window.getSelection();
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
window.editorBlock.restoreSelection = restoreSelection;
function restoreSelection() {
    if (!savedRange) return;

    const iframe = getViewIframe();
    const iframeWin = iframe ? iframe.contentWindow : null;
    const iframeSelection = getIframeSelection();
    const parentSelection = window.getSelection ? window.getSelection() : null;
    const sel = iframeSelection || parentSelection;
    if (!sel) return;

    if (iframeWin && typeof iframeWin.focus === 'function') {
        iframeWin.focus();
    }
    if (savedSelectionElement && savedSelectionElement.isConnected) {
        savedSelectionElement.focus();
    }

    sel.removeAllRanges();
    sel.addRange(savedRange.cloneRange());
}

// События для сохранения выделения при начале/завершении клика, при отпускании клавиши и при изменении выделения
document.addEventListener('mousedown', saveSelection);
document.addEventListener('mouseup', saveSelection);
document.addEventListener('keyup', saveSelection);
document.addEventListener('selectionchange', saveSelection);



/* ===
 * Выделение элементов в визуальном редакторе (Outline / Overlay)
=== */

// Текущий выделенный элемент в визуальном редакторе
let activeSelectedElement = null;

// Оригинальный стиль outline выделенного элемента
let originalOutlineStyle = '';

// Хранилище диапазона выделения текста перед совершением клика
let textSelectionRangeBeforeClick = null;

// Вспомогательная переменная для хранения ссылки на overlay выделения
let highlightOverlay = null;

// Вспомогательная переменная для хранения ссылки на hover overlay
let hoverHighlightOverlay = null;

// Сохранение выделенного элемента в глобальном объекте
window.editorBlock.selectedElement = null;

/* ***
 * updateHighlightPosition - обновление позиции и размеров подсветки
 * - пересчитывает координаты overlay относительно выделенного элемента
*** */
function updateHighlightPosition() {
    if (!activeSelectedElement || !highlightOverlay) {
        return;
    }

    const documentRoot = activeSelectedElement.ownerDocument;
    const win = documentRoot ? documentRoot.defaultView : window;
    if (!win) return;

    const rect = activeSelectedElement.getBoundingClientRect();

    Object.assign(highlightOverlay.style, {
        left: `${rect.left + win.scrollX - 1}px`,
        top: `${rect.top + win.scrollY - 1}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
    });
}

/* ***
 * clearElementHighlight - снятие выделения с текущего элемента
 * - удаляет overlay, отписывается от событий и сбрасывает ссылки
*** */
function clearElementHighlight() {
    // Удаление рамки overlay
    if (highlightOverlay) {
        highlightOverlay.remove();
        highlightOverlay = null;
    }

    if (hoverHighlightOverlay) {
        hoverHighlightOverlay.remove();
        hoverHighlightOverlay = null;
    }

    // Восстановление оригинального outline, если он был сохранен
    if (activeSelectedElement) {
        activeSelectedElement.style.outline = originalOutlineStyle;

        // Отписка от событий внутреннего окна iframe, если оно доступно
        const win = activeSelectedElement.ownerDocument?.defaultView;
        if (win) {
            win.removeEventListener('resize', updateHighlightPosition);
            win.removeEventListener('scroll', updateHighlightPosition);
        }
    }

    // Отписка от событий основного окна и документа
    window.removeEventListener('resize', updateHighlightPosition);
    window.removeEventListener('scroll', updateHighlightPosition);
    window.removeEventListener('input', updateHighlightPosition);
    window.removeEventListener('keydown', updateHighlightPosition);

    // Отписка от событий iframe-окна, если она была добавлена
    const iframeWin = activeSelectedElement?.ownerDocument?.defaultView;
    if (iframeWin && iframeWin !== window) {
        iframeWin.removeEventListener('resize', updateHighlightPosition);
        iframeWin.removeEventListener('scroll', updateHighlightPosition);
        iframeWin.removeEventListener('input', updateHighlightPosition);
        iframeWin.removeEventListener('keydown', updateHighlightPosition);
    }

    // Сброс переменных состояния
    activeSelectedElement = null;
    originalOutlineStyle = '';

    // Сброс выделенного элемента в глобальном объекте
    window.editorBlock.selectedElement = null;
    if (typeof currentSelectedEl !== 'undefined') {
        currentSelectedEl = null;
    }

    // Оповещение панелей о снятии выделения
    document.dispatchEvent(new CustomEvent('editorBlock:elementSelected', { detail: null }));
    return null;
}
window.editorBlock.clearElementHighlight = clearElementHighlight;

/* ***
 * highlightElement - выделение элемента через overlay
 * - создаёт рамку внутри документа элемента
 * - удаляет предыдущее выделение
 * - не изменяет HTML элемента
*** */
function highlightElement(element) {
    if (!element) {
        return null;
    }

    clearElementHighlight();

    const documentRoot = element.ownerDocument;
    const win = documentRoot ? documentRoot.defaultView : window;
    const rect = element.getBoundingClientRect();

    const overlay = documentRoot.createElement('div');
    overlay.className = 'elementHighlight';

    Object.assign(overlay.style, {
        position: 'absolute',
        left: `${rect.left + win.scrollX - 1}px`,
        top: `${rect.top + win.scrollY - 1}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: '1px solid #007bff',
        pointerEvents: 'none',
        zIndex: '9999'
    });

    documentRoot.documentElement.appendChild(overlay);

    highlightOverlay = overlay;
    activeSelectedElement = element;
    originalOutlineStyle = element.style.outline;

    window.editorBlock.selectedElement = element;
    if (typeof currentSelectedEl !== 'undefined') {
        currentSelectedEl = element;
    }

    // Подписка на события для пересчета позиции подсветки при скролле, ресайзе и вводе
    window.addEventListener('resize', updateHighlightPosition);
    window.addEventListener('scroll', updateHighlightPosition);
    window.addEventListener('input', updateHighlightPosition);
    window.addEventListener('keydown', updateHighlightPosition);

    if (win && win !== window) {
        win.addEventListener('resize', updateHighlightPosition);
        win.addEventListener('scroll', updateHighlightPosition);
        win.addEventListener('input', updateHighlightPosition);
        win.addEventListener('keydown', updateHighlightPosition);
    }

    document.dispatchEvent(
        new CustomEvent('editorBlock:elementSelected', {
            detail: element
        })
    );

    return null;
}

/* ***
 * clearHoverHighlight - удаление подсветки при наведении
 * - удаляет overlay подсветки при наведении
*** */
function clearHoverHighlight() {
    if (hoverHighlightOverlay) {
        hoverHighlightOverlay.remove();
        hoverHighlightOverlay = null;
    }
}

/* ***
 * highlightHoverElement - подсветка элемента при наведении
 * - создаёт рамку внутри документа элемента при наведении
 * - удаляет предыдущую подсветку
*** */
function highlightHoverElement(element) {
    if (!element || element === activeSelectedElement) {
        return null;
    }

    clearHoverHighlight();

    const documentRoot = element.ownerDocument;
    const win = documentRoot ? documentRoot.defaultView : window;
    const rect = element.getBoundingClientRect();

    const overlay = documentRoot.createElement('div');
    overlay.className = 'elementHighlight hoverHighlight';

    Object.assign(overlay.style, {
        position: 'absolute',
        left: `${rect.left + win.scrollX - 1}px`,
        top: `${rect.top + win.scrollY - 1}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: '1px solid #007bff',
        opacity: '0.4',
        pointerEvents: 'none',
        zIndex: '9998'
    });

    documentRoot.documentElement.appendChild(overlay);
    hoverHighlightOverlay = overlay;

    return null;
}

/* ***
 * isInsideIframeBody - проверка, находится ли элемент внутри body iframe
 * - принимает DOM-элемент target
 * - возвращает true, если элемент является частью тела iframe
*** */
function isInsideIframeBody(target) {
    if (!target) {
        return false;
    }

    const iframe = getViewIframe();
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;
    const body = iframeDoc ? iframeDoc.body : null;

    if (!body) {
        return false;
    }

    const targetNode = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;

    return !!(targetNode && targetNode !== body && body.contains(targetNode));
}

// Глобальная переменная для хранения последнего выделенного элемента
let lastHighlightedElement = null;

/* ***
 * handleVisualEditorClick - обработка клика в визуальном редакторе
 * - принимает объект события клика event
 * - сбрасывает подсветку при клике на контейнер редактора, вне body iframe или на предварительно выделенный текст
 * - при повторном/многократном клике по тому же элементу поднимает выделение к родителю (до contenteditable)
 * - отдает null
*** */
function handleVisualEditorClick(event) {
    const target = event.target;
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (!viewEditorContent || !target) {
        return null;
    }

    if (viewEditorContent.classList.contains('preview')) {
        return null;
    }

    // Если кликнули по самому контейнеру редактора или вне body iframe, сбрасываем выделение
    if (target === viewEditorContent || !isInsideIframeBody(target)) {
        clearElementHighlight();
        lastHighlightedElement = null;
        return null;
    }

    // Проверяем, попал ли клик внутрь выделенного текста
    const eventWindow = (event.view && event.view !== window)
        ? event.view
        : (event.target && event.target.ownerDocument && event.target.ownerDocument.defaultView)
            ? event.target.ownerDocument.defaultView
            : window;
    const selection = eventWindow.getSelection ? eventWindow.getSelection() : null;
    const activeRange = (selection && !selection.isCollapsed)
        ? selection.getRangeAt(0)
        : textSelectionRangeBeforeClick;

    if (activeRange && activeRange.intersectsNode(target)) {
        clearElementHighlight();
        lastHighlightedElement = null;
        textSelectionRangeBeforeClick = null;
        return null;
    }

    let elementToHighlight = target;

    const blockSourceContainer = target && target.closest ? target.closest('[data-block-src]') : null;
    if (blockSourceContainer) {
        elementToHighlight = blockSourceContainer;
    }

    // Сохраняем текущий выбранный элемент и выделяем его
    lastHighlightedElement = elementToHighlight;
    highlightElement(elementToHighlight);

    return null;
}

/* ***
 * handleVisualEditorHover - обработка наведения мыши в визуальном редакторе
 * - принимает объект события наведения event
 * - подсвечивает элемент при наведении, если он не является активным выделенным элементом
 * - отдает null
*** */
function handleVisualEditorHover(event) {
    const target = event.target;
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (!viewEditorContent || !target || viewEditorContent.classList.contains('preview')) {
        return null;
    }

    if (target === viewEditorContent || !isInsideIframeBody(target)) {
        clearHoverHighlight();
        return null;
    }

    const hoverTarget = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
    const blockSourceContainer = hoverTarget && hoverTarget.closest ? hoverTarget.closest('[data-block-src]') : null;
    const elementToHover = blockSourceContainer || hoverTarget;

    if (!elementToHover || elementToHover === activeSelectedElement) {
        clearHoverHighlight();
        return null;
    }

    highlightHoverElement(elementToHover);
    return null;
}

/* ***
 * handleVisualEditorMouseOut - обработка ухода мыши из визуального редактора
 * - принимает объект события ухода мыши event
 * - снимает подсветку при уходе мыши за пределы редактора или iframe body
 * - отдает null
*** */
function handleVisualEditorMouseOut(event) {
    const relatedTarget = event.relatedTarget;
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (!viewEditorContent || !relatedTarget || viewEditorContent.classList.contains('preview')) {
        clearHoverHighlight();
        return null;
    }

    if (relatedTarget === viewEditorContent || !isInsideIframeBody(relatedTarget)) {
        clearHoverHighlight();
        return null;
    }

    return null;
}

// Добавление обработчика клика после загрузки блоков редактора
document.addEventListener('editorBlock:loaded', () => {
    const viewEditorContent = document.getElementById('viewEditorContent');
    if (!viewEditorContent) return;

    // Фиксируем выделение текста в момент нажатия кнопки мыши
    viewEditorContent.addEventListener('mousedown', () => {
        const selection = window.getSelection();
        textSelectionRangeBeforeClick = (selection && !selection.isCollapsed) 
            ? selection.getRangeAt(0).cloneRange() 
            : null;
    });

    viewEditorContent.addEventListener('click', handleVisualEditorClick);
    viewEditorContent.addEventListener('contextmenu', handleVisualEditorClick);
});



/* ===
 * Работа с iframe и выделением
=== */

/* ***
 * getViewIframe - получение элемента iframe редактора
 * - ищет контейнер viewEditorContent
 * - возвращает вложенный iframe или null
*** */
function getViewIframe() {
    // Получение контейнера визуального редактора
    const viewEditorContent = document.getElementById('viewEditorContent');
    return viewEditorContent ? viewEditorContent.querySelector('iframe') : null;
}

/* ***
 * getViewIframeWindow - получение объекта window для iframe
 * - получает iframe через getViewIframe
 * - возвращает contentWindow или null
*** */
function getViewIframeWindow() {
    const iframe = getViewIframe();
    return iframe ? iframe.contentWindow : null;
}

/* ***
 * getIframeSelection - получение выделения внутри iframe
 * - получает окно iframe
 * - возвращает объект Selection или null
*** */
function getIframeSelection() {
    const win = getViewIframeWindow();
    return win ? win.getSelection() : null;
}

/* ***
 * getEditorDocument - получение текущего документа редактора
 * - проверяет наличие активного iframe
 * - возвращает документ iframe или основной document
*** */
function getEditorDocument() {
    const iframe = getViewIframe();
    if (iframe) {
        return iframe.contentDocument || iframe.contentWindow?.document || document;
    }
    return document;
}

/* ***
 * getEditorSelection - получение активного выделения редактора
 * - проверяет выделение внутри iframe
 * - при его отсутствии возвращает выделение основного окна
*** */
function getEditorSelection() {
    const iframeSelection = getIframeSelection();
    if (iframeSelection && iframeSelection.rangeCount > 0) {
        return iframeSelection;
    }
    return window.getSelection ? window.getSelection() : null;
}

/* ***
 * getEditorIframeDocument - получение документа iframe редактора
 * - проверяет наличие активного iframe
 * - возвращает документ iframe или null
*** */
function getEditorIframeDocument() {
    const iframe = getViewIframe();
    return iframe ? (iframe.contentDocument || iframe.contentWindow?.document || null) : null;
}

/* ***
 * getEditorContentByElement - получение содержимого редактора по DOM-элементу
 * - для viewEditor читает содержимое из iframe body
 * - для mdEditor/jsEditor читает из contenteditable
*** */
function getEditorContentByElement(editorElement) {
    if (!editorElement) {
        return '';
    }

    if (editorElement.id === 'viewEditor') {
        const iframeDoc = getEditorIframeDocument();
        const body = iframeDoc ? iframeDoc.body : null;
        return body ? body.innerHTML : '';
    }

    const contentDiv = editorElement.querySelector('[contenteditable]');
    if (!contentDiv) {
        return '';
    }

    if (editorElement.id === 'mdEditor' || editorElement.id === 'jsEditor') {
        return contentDiv.textContent;
    }

    return contentDiv.innerHTML;
}

/* ***
 * setEditorContentByElement - запись содержимого в редактор по DOM-элементу
 * - для viewEditor записывает содержимое в iframe body
 * - для mdEditor/jsEditor записывает в contenteditable
*** */
function setEditorContentByElement(editorElement, content) {
    if (!editorElement) {
        return;
    }

    if (editorElement.id === 'viewEditor') {
        const iframeDoc = getEditorIframeDocument();
        const body = iframeDoc ? iframeDoc.body : null;
        if (body) {
            body.innerHTML = content || '';
        }
        return;
    }

    const contentDiv = editorElement.querySelector('[contenteditable]');
    if (!contentDiv) {
        return;
    }

    if (editorElement.id === 'mdEditor' || editorElement.id === 'jsEditor') {
        contentDiv.textContent = content || '';
    } else {
        contentDiv.innerHTML = content || '';
    }
}

/* ***
 * attachIframeSelectionHandlers - подписка iframe на события выделения
 * - принимает элемент iframe
 * - навешивает обработчики событий мыши, клавиатуры и смены выделения
*** */
function attachIframeSelectionHandlers(iframe) {
    if (!iframe || !iframe.contentDocument) {
        return;
    }

    const iframeDoc = iframe.contentDocument;
    const events = ['mousedown', 'mouseup', 'keyup', 'selectionchange'];
    events.forEach(eventName => {
        iframeDoc.addEventListener(eventName, saveSelection);
    });
}

// Экспорт функций в глобальный объект editorBlock
window.editorBlock.getEditorSelection = getEditorSelection;
window.editorBlock.getEditorDocument = getEditorDocument;
window.editorBlock.getEditorContentByElement = getEditorContentByElement;
window.editorBlock.setEditorContentByElement = setEditorContentByElement;



/* ===
 * Управление активным блоком
=== */

/* ***
 * isBlockActive - проверка наличия активного блока
 * - проверяет наличие активного блока
 * - возвращает результат проверки
*** */
function isBlockActive() {
    return currentBlockId !== null;
}

/* ***
 * setEditorReadOnlyState - переключение режима редактирования
 * - принимает режим редактирования
 * - изменяет состояние редакторов
 * - обновляет состояние iframe
*** */
function setEditorReadOnlyState(readOnly) {

    // Редакторы
    const editors = ['viewEditorContent', 'mdEditorContent', 'jsEditorContent'];

    editors.forEach(id => {
        const editor = document.getElementById(id);

        if (editor === null) {
            return;
        }

        /* const editableValue = readOnly
            ? 'false'
            : (id === 'viewEditorContent' ? 'true' : 'plaintext-only'); */
        if (id === 'viewEditorContent') {
            return;
        }

        const editableValue = readOnly ? 'false' : 'plaintext-only';
        editor.setAttribute('contenteditable', editableValue);
    });

    // iframe редактора
    const iframeBody = document.getElementById('viewEditorContent')
        ?.querySelector('iframe')
        ?.contentDocument?.body;

    if (iframeBody !== undefined && iframeBody !== null) {
        iframeBody.contentEditable = readOnly ? 'false' : 'true';
    }
}

/* ***
 * blockEditorSelection - блокировка изменения выделения
 * - принимает объект события
 * - блокирует изменение выделения без активного блока
*** */
function blockEditorSelection(event) {
    if (currentBlockId !== null) {
        return;
    }

    const target = event.target;

    if (
        target !== null &&
        target.closest('#viewEditorContent, #mdEditorContent, #jsEditorContent')
    ) {
        event.preventDefault();
        event.stopPropagation();
    }
}

// Экспорт проверки активного блока
window.editorBlock.isBlockActive = isBlockActive;



/* ===
 * Изменение размеров панелей
=== */

document.addEventListener('editorBlock:loaded', () => {

// Контейнеры панелей
const topPanel = document.getElementById('topPanel');
const mainPanel = document.getElementById('mainPanel');
const leftPanel = document.getElementById('leftPanel');
const rightPanel = document.getElementById('rightPanel');

// Элементы разделителей панелей
const topResizer = document.getElementById('topPanelResizer');
const leftResizer = document.getElementById('leftPanelResizer');
const rightResizer = document.getElementById('rightPanelResizer');

// Изменение высоты topPanel
attachPanelResizer(topResizer, (e, delta) => {
    const currentHeight = topPanel.getBoundingClientRect().height;
    const newHeight = Math.max(0, currentHeight + delta.y);
    const maxHeight = window.innerHeight;

    if (newHeight <= maxHeight) {
        topPanel.style.height = `${newHeight}px`;
    }
});

// Изменение ширины leftPanel
attachPanelResizer(leftResizer, (e, delta) => {
    const currentWidth = leftPanel.getBoundingClientRect().width;
    const newWidth = Math.max(0, currentWidth + delta.x);
    const maxWidth = mainPanel.offsetWidth - rightPanel.getBoundingClientRect().width;

    if (newWidth <= maxWidth) {
        leftPanel.style.width = `${newWidth}px`;
    }
});

// Изменение ширины rightPanel
attachPanelResizer(rightResizer, (e, delta) => {
    const currentWidth = rightPanel.getBoundingClientRect().width;
    const newWidth = Math.max(0, currentWidth - delta.x);
    const maxWidth = mainPanel.offsetWidth - leftPanel.getBoundingClientRect().width;

    if (newWidth <= maxWidth) {
        rightPanel.style.width = `${newWidth}px`;
    }
});

// Двойной клик: удаляет только свойство height или width из style
topResizer?.addEventListener('dblclick', () => {
    topPanel.style.removeProperty('height');
    if (window.editorBlock?.updateHighlightPosition) window.editorBlock.updateHighlightPosition();
});

leftResizer?.addEventListener('dblclick', () => {
    leftPanel.style.removeProperty('width');
    if (window.editorBlock?.updateHighlightPosition) window.editorBlock.updateHighlightPosition();
});

rightResizer?.addEventListener('dblclick', () => {
    rightPanel.style.removeProperty('width');
    if (window.editorBlock?.updateHighlightPosition) window.editorBlock.updateHighlightPosition();
});

});

/* ***
 * attachPanelResizer - навешивание логики перетаскивания
 * - принимает элемент разделителя resizer
 * - принимает функцию обратного вызова onMove
*** */
function attachPanelResizer(resizer, onMove) {
    if (!resizer) return;

    resizer.addEventListener('mousedown', event => {
        event.preventDefault();

        let startX = event.clientX;
        let startY = event.clientY;

        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            iframe.style.pointerEvents = 'none';
        });

        function onMouseMove(e) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            startX = e.clientX;
            startY = e.clientY;

            onMove(e, { x: deltaX, y: deltaY });

            if (window.editorBlock && typeof window.editorBlock.updateHighlightPosition === 'function') {
                window.editorBlock.updateHighlightPosition();
            }
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            iframes.forEach(iframe => {
                iframe.style.pointerEvents = 'auto';
            });
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}



/* ===
 * Селективное преобразование HTML в Markdown через DOM-дерево
=== */

// Список сложных HTML-тегов, которые должны оставаться как HTML без изменений
const complexHtmlTags = new Set([
    'DIV',
    'TABLE',
    'THEAD',
    'TBODY',
    'TR',
    'TD',
    'TH',
    'BUTTON',
    'FORM',
    'INPUT',
    'SELECT',
    'TEXTAREA',
    'SECTION',
    'ARTICLE',
    'HEADER',
    'FOOTER',
    'NAV',
    'MAIN',
    'ASIDE',
    'FIGURE',
    'FIGCAPTION',
    'CODE',
    'PRE',
    'VIDEO',
    'AUDIO',
    'CANVAS',
    'SVG',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'PARAM',
    'SOURCE',
    'TRACK'
]);

/* ***
 * isComplexElement - проверка, является ли элемент сложным HTML-блоком
 * - принимает DOM-узел element
 * - проверяет тег на соответствие списку сложных тегов
 * - проверяет наличие классов или сложных атрибутов
 * - возвращает true, если элемент нужно оставить в HTML
*** */
function isComplexElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    const tagName = element.tagName.toUpperCase();

    if (complexHtmlTags.has(tagName)) {
        return true;
    }

    if (element.classList && element.classList.length > 0) {
        return true;
    }

    return false;
}

/* ***
 * parseDomNodeToMd - рекурсивное преобразование узла DOM в Markdown или HTML
 * - принимает DOM-узел node
 * - принимает уровень вложенности списка depth
 * - обходит дочерние элементы
 * - конвертирует поддерживаемые элементы в Markdown
 * - возвращает сгенерированную строку
*** */
function parseDomNodeToMd(node, depth = 0) {
    if (!node) {
        return '';
    }

    // Текстовые узлы
    if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent.trim()) {
            return '';
        }

        return node.textContent;
    }

    // Обрабатываем только узлы элементов
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
    }

    // Если узел является сложной структурой, оставляем его чистым HTML
    if (isComplexElement(node)) {
        return `\n\n${node.outerHTML}\n\n`;
    }

    const tagName = node.tagName.toUpperCase();

    // Рекурсивный обход детей
    let childrenContent = '';

    for (const child of node.childNodes) {
        const nextDepth = (tagName === 'UL' || tagName === 'OL') ? depth + 1 : depth;

        childrenContent += parseDomNodeToMd(child, nextDepth);
    }

    const trimmedChildren = childrenContent.trim();

    switch (tagName) {
        case 'H1':
            return `# ${trimmedChildren}\n\n`;

        case 'H2':
            return `## ${trimmedChildren}\n\n`;

        case 'H3':
            return `### ${trimmedChildren}\n\n`;

        case 'H4':
            return `#### ${trimmedChildren}\n\n`;

        case 'H5':
            return `##### ${trimmedChildren}\n\n`;

        case 'H6':
            return `###### ${trimmedChildren}\n\n`;

        case 'P':
            return `${trimmedChildren}\n\n`;

        case 'STRONG':
        case 'B':
            return `**${trimmedChildren}**`;

        case 'EM':
        case 'I':
            return `*${trimmedChildren}*`;

        case 'A': {
            const href = node.getAttribute('href') || '';

            return `[${trimmedChildren}](${href})`;
        }

        case 'IMG': {
            const src = node.getAttribute('src') || '';
            const alt = node.getAttribute('alt') || '';

            return `![${alt}](${src})\n\n`;
        }

        case 'UL':
        case 'OL':
            return `${childrenContent}\n`;

        case 'LI': {
            let itemText = '';
            let nestedLists = '';

            // Разделяем текст элемента и вложенные списки
            for (const child of node.childNodes) {
                const childTag = child.nodeType === Node.ELEMENT_NODE
                    ? child.tagName.toUpperCase()
                    : '';

                if (childTag === 'UL' || childTag === 'OL') {
                    nestedLists += parseDomNodeToMd(child, depth);
                } else {
                    itemText += parseDomNodeToMd(child, depth);
                }
            }

            const indent = '    '.repeat(Math.max(0, depth - 1));
            const cleanItemText = itemText.replace(/\s+/g, ' ').trim();

            return `${indent}- ${cleanItemText}\n${nestedLists}`;
        }

        case 'BLOCKQUOTE':
            return `> ${trimmedChildren}\n\n`;

        case 'BR':
            return '\n';

        default:
            return childrenContent;
    }
}

/* ***
 * cleanMixedContent - очистка и нормализация строк
 * - принимает преобразованный текст
 * - убирает избыточные пустые строки
 * - возвращает результирующий Markdown
*** */
function cleanMixedContent(text) {
    if (!text) {
        return '';
    }

    let cleanText = text;

    // Замена 3 и более переносов подряд на 2 переноса (одна пустая строка между блоками)
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n');

    return cleanText.trim();
}

/* ***
 * convertHtmlToMd - главная функция избирательного преобразования HTML в MD
 * - принимает строку с HTML-содержимым
 * - парсит документ через DOMParser
 * - конвертирует поддерживаемые элементы в Markdown
 * - сохраняет сложные структуры (div, table и др.) как HTML
*** */
function convertHtmlToMd(htmlString) {
    if (!htmlString) {
        return '';
    }

    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(htmlString, 'text/html');
    const body = parsedDoc.body;

    let markdownResult = '';

    for (const child of body.childNodes) {
        markdownResult += parseDomNodeToMd(child, 0);
    }

    markdownResult = cleanMixedContent(markdownResult);

    return markdownResult;
}

window.editorBlock.convertHtmlToMd = convertHtmlToMd;