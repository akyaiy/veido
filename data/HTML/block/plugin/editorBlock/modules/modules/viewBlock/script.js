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
        document.getElementById(id).style.display = id === editorId ? '' : 'none';
    }
}

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