/* ===
 * Управление режимом предпросмотра блока
=== */

// Флаг активного состояния режима предпросмотра
let isPreviewActive = false;

/* ***
 * getPreviewEditorIframe - получение iframe визуального редактора
 * - ищет контейнер viewEditorContent
 * - возвращает вложенный iframe или null
*** */
function getPreviewEditorIframe() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    return viewEditorContent ? viewEditorContent.querySelector('iframe') : null;
}

/* ***
 * setPreviewEditorReadOnly - переключение режима чтения для iframe предпросмотра
 * - отключает contenteditable в iframe и в контейнерах редакторов
 * - используется для изоляции предпросмотра от редактирования
*** */
function setPreviewEditorReadOnly(readOnly) {
    const viewEditorContent = document.getElementById('viewEditorContent');
    const mdEditorContent = document.getElementById('mdEditorContent');
    const jsEditorContent = document.getElementById('jsEditorContent');

    if (viewEditorContent) {
        // viewEditorContent.setAttribute('contenteditable', readOnly ? 'false' : 'true');
    }
    if (mdEditorContent) {
        mdEditorContent.setAttribute('contenteditable', readOnly ? 'false' : 'plaintext-only');
    }
    if (jsEditorContent) {
        jsEditorContent.setAttribute('contenteditable', readOnly ? 'false' : 'plaintext-only');
    }

    const iframe = getPreviewEditorIframe();
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;
    const iframeBody = iframeDoc ? iframeDoc.body : null;

    if (iframeBody) {
        iframeBody.contentEditable = readOnly ? 'false' : 'true';
        iframeBody.setAttribute('contenteditable', readOnly ? 'false' : 'true');
    }
}

/* ***
 * loadNestedBlocksInPreview - запуск загрузки вложенных блоков внутри iframe предпросмотра
 * - находит iframe редактора
 * - берет документ фрейма
 * - вызывает loadBlockAttribute для его body
*** */
function loadNestedBlocksInPreview() {
    const loader = (typeof window.loadBlockAttribute === 'function' && window.loadBlockAttribute)
        || (typeof loadBlockAttribute === 'function' && loadBlockAttribute);
    if (!loader) return;

    const iframe = getPreviewEditorIframe();
    const iframeDoc = iframe ? (iframe.contentDocument || iframe.contentWindow?.document) : null;
    if (!iframeDoc || !iframeDoc.body) return;

    loader(iframeDoc.body);
}
window.editorBlock.loadNestedBlocksInPreview = loadNestedBlocksInPreview;

/* ***
 * togglePreviewMode - переключение режима предпросмотра блока
 * - инвертирует флаг isPreviewActive
 * - скрывает или показывает панели управления (rightPanel, leftPanel, editorsTabs)
 * - добавляет/удаляет класс preview у центральных блоков
 * - переключает на визуальный режим и загружает вложенные блоки
 * - меняет класс active у кнопки предпросмотра
*** */
async function togglePreviewMode() {
    const blockPreviewButton = document.getElementById('blockPreviewButton');
    if (!blockPreviewButton) {
        return;
    }

    const shouldActivatePreview = !isPreviewActive;
    isPreviewActive = shouldActivatePreview;

    // Получение текущего активного блока
    let activeBlockTab = document.querySelector('.blockTab.active');
    let currentBlockId = activeBlockTab ? activeBlockTab.dataset.blockId : null;

    // Сохранение текущего блока перед переключением режима
    window.editorBlock.savePreviousBlock(currentBlockId);

    // Переключение видимости панелей
    ['rightPanel', 'leftPanel', 'editorsTabs'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = isPreviewActive ? 'none' : '';
        }
    });

    // Переключение класса предпросмотра
    if (shouldActivatePreview) {
        if (window.editorBlock && typeof window.editorBlock.clearElementHighlight === 'function') {
            window.editorBlock.clearElementHighlight();
        }

        const iframe = getPreviewEditorIframe();
        const iframeSelection = iframe?.contentWindow?.getSelection();
        if (iframeSelection) {
            iframeSelection.removeAllRanges();
        }
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
        }

        ['viewEditor', 'viewEditorContent', 'centerPanel'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('preview');
            }
        });
    }

    // Активация визуального режима и загрузка блоков
    const viewEditorButton = document.getElementById('viewEditorButton');
    if (shouldActivatePreview && viewEditorButton) {
        viewEditorButton.click();

        if (window.editorBlock && typeof window.editorBlock.hideAllPagePropertiesWindows === 'function') {
            window.editorBlock.hideAllPagePropertiesWindows();
        }

        await new Promise(resolve => {
            setTimeout(resolve, 100);
        });

        setPreviewEditorReadOnly(true);
        await loadNestedBlocksInPreview();
    } else {
        setPreviewEditorReadOnly(false);

        activeBlockTab = document.querySelector('.blockTab.active');
        currentBlockId = activeBlockTab ? activeBlockTab.dataset.blockId : null;
        const currentBlock = currentBlockId ? document.getElementById(currentBlockId) : null;
        const blockPath = currentBlock ? currentBlock.dataset.path || null : null;

        if (currentBlockId && blockPath && window.editorBlock && typeof window.editorBlock.openBlock === 'function') {
            await window.editorBlock.openBlock(blockPath);
        }

        ['viewEditor', 'viewEditorContent', 'centerPanel'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('preview');
            }
        });
    }

    blockPreviewButton.classList.toggle('active', isPreviewActive);
}

/* ***
 * handlePreviewClick - обработка нажатия на кнопку предпросмотра
 * - вызывает togglePreviewMode
*** */
function handlePreviewClick() {
    togglePreviewMode();
}

// Добавление обработчика клика на кнопку предпросмотра
const previewButton = document.getElementById('blockPreviewButton');
if (previewButton) {
    previewButton.addEventListener('click', handlePreviewClick);
}

/* ***
 * applyViewEditorSize - применение размеров к viewEditorContent и iframe body
 * принимает ширину и высоту
 * изменяет размер контейнера viewEditorContent
 * изменяет размер body внутри iframe, если он доступен
 * сохраняет размеры в настройках текущего блока
*** */
const applyViewEditorSize = (width, height) => {
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (viewEditorContent) {
        if (typeof width !== 'undefined') {
            viewEditorContent.style.width = width;
        }
        if (typeof height !== 'undefined') {
            viewEditorContent.style.height = height;
        }
    }

    const iframeEl = typeof getPreviewEditorIframe === 'function' ? getPreviewEditorIframe() : null;
    if (iframeEl) {
        try {
            const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
            if (iframeDoc && iframeDoc.body) {
                if (typeof width !== 'undefined') {
                    iframeDoc.body.style.width = width;
                }
                if (typeof height !== 'undefined') {
                    iframeDoc.body.style.height = height;
                }
            }
        } catch (e) {}
    }

    const blockId = window.editorBlock?.currentBlockId || null;
    const settingsEl = blockId ? document.getElementById(blockId + 'Settings') : null;

    if (settingsEl) {
        if (typeof width !== 'undefined') {
            settingsEl.dataset.viewEditorWidth = width;
        }
        if (typeof height !== 'undefined') {
            settingsEl.dataset.viewEditorHeight = height;
        }
    }
};

/* ***
 * initViewEditorMenu - инициализация меню выбора размера viewEditor
 * получает меню выбора размера и контейнер viewEditorContent
 * проверяет наличие элементов и повторную инициализацию
 * применяет выбранные ширину и высоту через общую функцию applyViewEditorSize
 * сохраняет размеры в настройках текущего блока
 * обрабатывает изменение выбранного размера
*** */
function initViewEditorMenu() {
    const menuSelect = document.getElementById('viewEditorMenuSelect');
    const viewEditorContent = document.getElementById('viewEditorContent');

    if (!menuSelect || !viewEditorContent || menuSelect.dataset.bound === 'true') {
        return;
    }

    const parseDimension = (value) => {
        if (!value || value === 'auto') {
            return 'auto';
        }

        const normalized = String(value).trim();

        if (!normalized) {
            return 'auto';
        }

        if (normalized.includes('%')) {
            return normalized;
        }

        const numeric = Number.parseFloat(normalized);
        return Number.isFinite(numeric) ? `${numeric}px` : normalized;
    };

    menuSelect.addEventListener('change', () => {
        const value = menuSelect.value;

        if (!value || value === 'custom') {
            return;
        }

        const [rawWidth, rawHeight] = value.split('x');
        const width = parseDimension(rawWidth);
        const height = parseDimension(rawHeight);

        applyViewEditorSize(width, height);
    });

    menuSelect.dataset.bound = 'true';
}


/* ***
 * initPreviewResize - инициализация изменения размера viewEditor
 * получает контейнер viewEditorContent и элемент изменения размера
 * проверяет наличие элементов и повторную инициализацию
 * изменяет размер контейнера мышью
 * учитывает текущий масштаб элемента
 * ограничивает минимальный и максимальный размер
 * синхронизирует размер iframe
 * сохраняет размер текущего блока
*** */
function initPreviewResize() {
    const viewEditorContent = document.getElementById('viewEditorContent');
    const resizeHandle = document.getElementById('viewEditorResizeHandle');

    if (!viewEditorContent || !resizeHandle || viewEditorContent.dataset.resizeInitialized === 'true') {
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const minSize = 20;
    let lastWidth = 0;
    let lastHeight = 0;

    /* ***
     * getCurrentScale - получение текущего масштаба элемента
     * принимает DOM-элемент
     * получает масштаб из CSS transform или zoom
     * возвращает текущий масштаб
    *** */
    const getCurrentScale = (el) => {
        const transform = window.getComputedStyle(el).transform;

        if (transform && transform !== 'none') {
            const matrix = transform.match(/matrix\((.+)\)/);

            if (matrix) {
                const values = matrix[1].split(', ');
                return parseFloat(values[0]);
            }
        }

        const zoom = parseFloat(window.getComputedStyle(el).zoom);

        if (!isNaN(zoom) && zoom !== 1) {
            return zoom;
        }

        return 1;
    };

    /* ***
     * onMouseMove - изменение размера viewEditorContent
     * принимает событие движения мыши
     * проверяет активность изменения размера
     * рассчитывает новую ширину и высоту с учетом масштаба
     * ограничивает размеры границами родительского элемента
     * изменяет размеры viewEditorContent
     * синхронизирует размеры iframe
    *** */
    const onMouseMove = (event) => {
        if (!isResizing) {
            return;
        }

        const scale = getCurrentScale(viewEditorContent);
        const deltaX = (event.clientX - startX) / scale * 2;
        const deltaY = (event.clientY - startY) / scale * 2;

        let nextWidth = Math.max(minSize, Math.round(startWidth + deltaX));
        let nextHeight = Math.max(minSize, Math.round(startHeight + deltaY));

        try {
            const scale = getCurrentScale(viewEditorContent) || 1;
            const parentEl = viewEditorContent.parentElement || document.documentElement;
            const parentRect = parentEl.getBoundingClientRect();
            const maxAllowedW = Math.max(minSize, Math.floor(parentRect.width / scale));
            const maxAllowedH = Math.max(minSize, Math.floor(parentRect.height / scale));

            if (nextWidth > maxAllowedW) {
                nextWidth = maxAllowedW;
            }

            if (nextHeight > maxAllowedH) {
                nextHeight = maxAllowedH;
            }
        } catch (e) {
        }

        lastWidth = nextWidth;
        lastHeight = nextHeight;

        applyViewEditorSize(nextWidth + 'px', nextHeight + 'px');

        const iframeEl = typeof getPreviewEditorIframe === 'function' ? getPreviewEditorIframe() : null;

        if (iframeEl) {
            try {
                iframeEl.style.pointerEvents = 'none';
                iframeEl.style.width = '100%';
                iframeEl.style.height = '100%';

                const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;

                if (iframeDoc && iframeDoc.body) {
                    iframeDoc.body.style.boxSizing = 'border-box';
                    iframeDoc.body.style.margin = '0';
                    iframeDoc.body.style.minWidth = '0';
                    iframeDoc.body.style.minHeight = '0';
                }
            } catch (e) {
            }
        }
    };

    /* ***
     * onMouseUp - завершение изменения размера
     * завершает изменение размера
     * удаляет обработчики мыши
     * восстанавливает взаимодействие с iframe
     * сохраняет последний размер в настройках блока
    *** */
    const onMouseUp = () => {
        isResizing = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const iframeEl = typeof getPreviewEditorIframe === 'function' ? getPreviewEditorIframe() : null;

        if (iframeEl) {
            try {
                iframeEl.style.pointerEvents = 'auto';
            } catch (e) {
            }
        }

        try {
            const currentBlockId = window.editorBlock?.currentBlockId || null;
            const settingsEl = currentBlockId ? document.getElementById(currentBlockId + 'Settings') : null;

            if (settingsEl && lastWidth && lastHeight) {
                settingsEl.dataset.viewEditorWidth = lastWidth + 'px';
                settingsEl.dataset.viewEditorHeight = lastHeight + 'px';
            }
        } catch (e) {
        }
    };

    /* ***
     * resizeHandle mousedown - запуск изменения размера
     * принимает событие нажатия мыши
     * получает текущий размер и масштаб контейнера
     * сохраняет начальную позицию мыши
     * сохраняет начальные размеры контейнера
     * запускает обработчики изменения размера
    *** */
    resizeHandle.addEventListener('mousedown', (event) => {
        const rect = viewEditorContent.getBoundingClientRect();
        const scale = getCurrentScale(viewEditorContent);

        isResizing = true;
        startX = event.clientX;
        startY = event.clientY;
        startWidth = rect.width / scale;
        startHeight = rect.height / scale;
        lastWidth = startWidth;
        lastHeight = startHeight;

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        event.preventDefault();
    });

    viewEditorContent.dataset.resizeInitialized = 'true';

    if (window.editorBlock) {
        window.editorBlock.initPreviewResize = initPreviewResize;
    }
}

document.addEventListener('editorBlock:loaded', async () => {
    initPreviewResize();
    initViewEditorMenu();
});