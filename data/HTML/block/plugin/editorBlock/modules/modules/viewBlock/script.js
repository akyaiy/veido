/* ===
 * Переключение режимов редактора editorBlock
 * === */

/* ***
 * switchEditor - переключение между режимами редактора
 * - скрывает неактивные редакторы
 * - показывает выбранный редактор
 * - преобразует HTML в Markdown при открытии mdEditor
*** */
function switchEditor(editorId) {
    const editors = [
        'viewEditor',
        'mdEditor',
        'jsEditor'
    ];
    const currentActiveEditor = document.querySelector('#viewBlock > .active');

    // Переключение отображения редакторов
    for (const id of editors) {
        const editor = document.getElementById(id);
        const button = document.getElementById(id + 'Button');

        if (id === editorId) {
            editor.style.display = '';
            editor.classList.add('active');
            if (button) button.classList.add('active');
        } else {
            editor.style.display = 'none';
            editor.classList.remove('active');
            if (button) button.classList.remove('active');
        }
    }

    if (editorId === 'mdEditor') {
        const mdEditorContent = document.getElementById('mdEditorContent');
        const iframe = document.querySelector('#viewEditorContent iframe');
        const html = iframe.contentDocument.body.innerHTML || '';

        if (mdEditorContent && window.editorBlock.convertHtmlToMd) {
            mdEditorContent.textContent = window.editorBlock.convertHtmlToMd(html);
        }
    }
}
switchEditor('viewEditor');

// Кнопки переключения режимов редактора
document.getElementById('viewEditorButton').onclick = () => {
    switchEditor('viewEditor');
    document.dispatchEvent(new CustomEvent('editorBlock:openLoadedBlock'));
};
document.getElementById('mdEditorButton').onclick = () => {
    switchEditor('mdEditor');
};
document.getElementById('jsEditorButton').onclick = () => {
    switchEditor('jsEditor');
};