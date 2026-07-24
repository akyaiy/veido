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
        viewEditorContent.setAttribute('contenteditable', readOnly ? 'false' : 'true');
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