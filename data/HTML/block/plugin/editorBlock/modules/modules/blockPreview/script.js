/* ===
 * Управление режимом предпросмотра блока
=== */

// Флаг активного состояния режима предпросмотра
let isPreviewActive = false;

/* ***
 * togglePreviewMode - переключение режима предпросмотра блока
 * - скрывает или показывает панели управления
 * - включает или отключает режим предпросмотра
 * - меняет состояние кнопки
*** */
function togglePreviewMode() {
    const blockPreviewButton = document.getElementById('blockPreviewButton');
    if (!blockPreviewButton) {
        return;
    }

    isPreviewActive = !isPreviewActive;

    // Переключение видимости панелей
    ['rightPanel', 'leftPanel', 'editorsTabs'].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.style.display = isPreviewActive ? 'none' : '';
        }
    });

    // Переключение режима предпросмотра
    ['viewEditor', 'viewEditorContent', 'centerPanel'].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.classList.toggle('preview', isPreviewActive);
        }
    });

    // Активация визуального режима
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