/* ===
 * Управление режимом предпросмотра блока
=== */

// Флаг активного состояния режима предпросмотра
let isPreviewActive = false;

/* ***
 * togglePreviewMode - переключение режима предпросмотра блока
 * - скрывает или показывает панели управления (левую, правую, вкладки)
 * - имитирует клик по кнопке визуального режима
 * - включает/отключает изменение размера для viewEditorContent и сбрасывает его
 * - меняет состояние флага и класс кнопки
*** */
function togglePreviewMode() {
    const blockPreviewButton = document.getElementById('blockPreviewButton');
    if (!blockPreviewButton) {
        return;
    }

    isPreviewActive = !isPreviewActive;
    const displayValue = isPreviewActive ? 'none' : '';

    // Переключение видимости панелей
    ['rightPanel', 'leftPanel', 'editorsTabs'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = displayValue;
        }
    });

    const viewEditor = document.getElementById('viewEditor');
    const viewEditorContent = document.getElementById('viewEditorContent');
    const centerPanel = document.getElementById('centerPanel');

    // Корректировка стилей для обхода проблемы с justify-content: center
    if (viewEditor && viewEditorContent) {
        if (isPreviewActive) {
            viewEditor.style.overflow = 'auto';
            viewEditor.style.justifyContent = 'flex-start';

            viewEditorContent.style.resize = 'both';
            viewEditorContent.style.overflow = 'auto';
            viewEditorContent.style.display = 'inline-block';
            
            centerPanel.style.borderBottom = '1px solid #ccc';
        } else {
            viewEditor.style.overflow = '';
            viewEditor.style.justifyContent = '';

            viewEditorContent.style.resize = '';
            viewEditorContent.style.overflow = '';
            viewEditorContent.style.display = '';
            viewEditorContent.style.minWidth = '';
            viewEditorContent.style.minHeight = '';
            viewEditorContent.style.width = '';
            viewEditorContent.style.height = '';

            centerPanel.style.borderBottom = '';
        }
    }

    // Активация визуального режима и обновление состояния кнопки
    const viewEditorButton = document.getElementById('viewEditorButton');
    if (isPreviewActive && viewEditorButton) {
        viewEditorButton.click();
    }

    blockPreviewButton.classList.toggle('active', isPreviewActive);
}

/* ***
 * handlePreviewClick - обработка нажатия на кнопку предпросмотра
 * - вызывает функцию переключения режима предпросмотра
*** */
function handlePreviewClick() {
    togglePreviewMode();
}

// Добавление обработчика клика на кнопку предпросмотра
const previewButton = document.getElementById('blockPreviewButton');

if (previewButton) {
    previewButton.addEventListener('click', handlePreviewClick);
}