/* ===
 * Переключение режимов редактора editorBlock
 * === */

/* ***
 * switchEditor - переключение между режимами редактора
 * - скрывает неактивные редакторы
 * - показывает выбранный редактор
*** */
function switchEditor(editorId) {
    const editors = [
        'viewEditor',
        'mdEditor',
        'jsEditor'
    ];

    // Переключение отображения редакторов
    for (const id of editors) {
        const editor = document.getElementById(id);

        if (id === editorId) {
            editor.style.display = '';
            editor.classList.add('active');
        } else {
            editor.style.display = 'none';
            editor.classList.remove('active');
        }
    }
}
switchEditor('viewEditor');

// Кнопки переключения режимов редактора
document.getElementById('viewEditorButton').onclick = () => {
    switchEditor('viewEditor');
};
document.getElementById('mdEditorButton').onclick = () => {
    switchEditor('mdEditor');
};
document.getElementById('jsEditorButton').onclick = () => {
    switchEditor('jsEditor');
};