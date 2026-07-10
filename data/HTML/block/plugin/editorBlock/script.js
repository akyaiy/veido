/* ===
 * Инициализация модулей редактора editorBlock
* ===/

/* ***
 * loadEditorBlock - загрузка всех модулей editorBlock
 * - загружает основной каркас редактора
 * - загружает все дополнительные модули редактора
*** */

async function loadEditorBlock() {
    // Загрузка основного модуля редактора
    await loadBlock('plugin/editorBlock/modules/mainBlock', 'editorBlock');

    // Путь к папке с дополнительными модулями
    const modulesPath = 'plugin/editorBlock/modules/modules';

    // Список модулей editorBlock
    const modules = [
        'attributesElement',
        'blocksTabs',
        'editorHistory',
        'insertingElements',
        'modalWindows',
        'viewBlock',
        'blockPreview',
        'colorPicker',
        'eventsEditor',
        'jsEditor',
        'propertiesElement',
        'viewEditor',
        'blocksContainers',
        'contextMenu',
        'fileMenu',
        'mdEditor',
        'propertiesText'
    ];


    // Загрузка дополнительных модулей
    for (const moduleName of modules) {
        await loadBlock(`${modulesPath}/${moduleName}`, moduleName);
    }
}

// Вызов функции загрузки всех модулей editorBlock
loadEditorBlock();