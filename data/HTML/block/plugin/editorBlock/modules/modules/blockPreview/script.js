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
 * initPreviewResize - изменение размера с учетом CSS scale и центрирования
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

    // Вспомогательная функция для получения текущего scale элемента
    const getCurrentScale = (el) => {
        const transform = window.getComputedStyle(el).transform;
        if (transform && transform !== 'none') {
            const matrix = transform.match(/matrix\((.+)\)/);
            if (matrix) {
                const values = matrix[1].split(', ');
                return parseFloat(values[0]); // значение scaleX
            }
        }
        // Если используется старый zoom
        const zoom = parseFloat(window.getComputedStyle(el).zoom);
        if (!isNaN(zoom) && zoom !== 1) {
            return zoom;
        }
        return 1;
    };

    const onMouseMove = (event) => {
        if (!isResizing) return;

        // Получаем актуальный масштаб контейнера, чтобы скорректировать дельту мыши
        const scale = getCurrentScale(viewEditorContent);

        // Делим смещение мыши на scale, чтобы движение было точным при любом зуме
        const deltaX = (event.clientX - startX) / scale * 2;
        const deltaY = (event.clientY - startY) / scale * 2;

        let nextWidth = Math.max(minSize, Math.round(startWidth + deltaX));
        let nextHeight = Math.max(minSize, Math.round(startHeight + deltaY));

        // Не позволяем выходить за пределы родителя (учитываем текущий scale)
        try {
            const scale = getCurrentScale(viewEditorContent) || 1;
            const parentEl = viewEditorContent.parentElement || document.documentElement;
            const parentRect = parentEl.getBoundingClientRect();
            const maxAllowedW = Math.max(minSize, Math.floor(parentRect.width / scale));
            const maxAllowedH = Math.max(minSize, Math.floor(parentRect.height / scale));
            if (nextWidth > maxAllowedW) nextWidth = maxAllowedW;
            if (nextHeight > maxAllowedH) nextHeight = maxAllowedH;
        } catch (e) {
            // silent
        }

        lastWidth = nextWidth;
        lastHeight = nextHeight;

        viewEditorContent.style.width = nextWidth + 'px';
        viewEditorContent.style.height = nextHeight + 'px';

        // Синхронизация с iframe: iframe растягиваем на 100% контейнера, размеры контента задаются в body
        const iframeEl = getPreviewEditorIframe();
        if (iframeEl) {
            try {
                iframeEl.style.pointerEvents = 'none';
                iframeEl.style.width = '100%';
                iframeEl.style.height = '100%';
                const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
                if (iframeDoc && iframeDoc.body) {
                    iframeDoc.body.style.boxSizing = 'border-box';
                    iframeDoc.body.style.margin = '0';
                    iframeDoc.body.style.width = nextWidth + 'px';
                    iframeDoc.body.style.height = nextHeight + 'px';
                    iframeDoc.body.style.minWidth = '0';
                    iframeDoc.body.style.minHeight = '0';
                }
            } catch (e) {
                // silent
            }
        }
    };

    const onMouseUp = () => {
        isResizing = false;
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const iframeEl = getPreviewEditorIframe();
        if (iframeEl) {
            try { iframeEl.style.pointerEvents = 'auto'; } catch (e) { /* silent */ }
        }
        try {
            const currentBlockId = window.editorBlock?.currentBlockId || null;
            const settingsEl = currentBlockId ? document.getElementById(currentBlockId + 'Settings') : null;
            if (settingsEl && lastWidth && lastHeight) {
                settingsEl.dataset.viewEditorWidth = lastWidth + 'px';
                settingsEl.dataset.viewEditorHeight = lastHeight + 'px';
            }
        } catch (e) {
            // silent
        }
    };

    resizeHandle.addEventListener('mousedown', (event) => {
        const rect = viewEditorContent.getBoundingClientRect();
        const scale = getCurrentScale(viewEditorContent);

        isResizing = true;
        startX = event.clientX;
        startY = event.clientY;
        
        // Корректируем начальный размер с учетом getBoundingClientRect (он возвращает уже масштабированные пиксели)
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
});