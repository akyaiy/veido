/* ===
 * Инициализация модулей редактора editorBlock
=== */

window.editorBlock = window.editorBlock || {};

/* ***
 * loadEditorBlock - загрузка всех модулей editorBlock
 * - загружает основной каркас редактора
 * - загружает все дополнительные модули редактора
*** */
async function loadEditorBlock() {
    // Загрузка основного каркаса редактора
    await loadBlock('plugin/editorBlock/modules/mainBlock', 'editorBlock', false);
    await loadBlock('plugin/editorBlock/modules/modules/viewBlock', 'viewBlock');

    // Путь к папке с модулями
    const modulesPath = 'plugin/editorBlock/modules/modules';

    // Список модулей editorBlock
    const modules = [
        'blocksTabs',
        'editorHistory',
        'insertingElements',
        'modalWindows',
        'blockPreview',
        'colorPicker',
        'blocksContainers',
        'contextMenu',
        'fileMenu',
        'pageProperties',

        'rightPanelTabs',
        'propertiesText',
        'eventsEditor',
        'attributesElement',
        'propertiesElement',
        'cssEditor',
        'treeElements',

        'viewEditor',
        'viewEditorMenu',
        'mdEditor',
        'jsEditor'
    ];

    // Загрузка модулей параллельно и ожидание завершения всех
    const loadPromises = modules.map(moduleName => {
        let modulePath = `${modulesPath}/${moduleName}`;

        if (moduleName !== 'mainBlock') {
            modulePath = `${modulesPath}/${moduleName}`;
        }

        return loadBlock(modulePath, moduleName);
    });

    await Promise.all(loadPromises);
}

/* ***
 * initEditorBlock - инициализация редактора
 * - загружает все модули editorBlock
 * - вызывает событие после завершения загрузки
*** */
async function initEditorBlock() {
    await loadEditorBlock();
    document.dispatchEvent(new Event('editorBlock:loaded'));
}
// Инициализация редактора
initEditorBlock();

/* ***
 * initSvgIcons - инициализация SVG-иконок
 * - ищет все SVG с атрибутом use
 * - создает элемент <use> с указанным id
 * - применяет цвет и фон, если указаны
*** */
function initSvgIcons() {
    // Поиск всех SVG с атрибутом use
    document.querySelectorAll('svg[use]').forEach(svg => {
        // Получение значений атрибутов
        const id = svg.getAttribute('use');
        const color = svg.getAttribute('use-color');
        const background = svg.getAttribute('use-background');

        // Создание SVG <use> элемента
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', './static/img/icons.svg#' + id);

        // Применение цвета
        if (color) svg.style.color = color;
        else svg.style.color = "#000000";

        // Применение фона
        if (background) svg.style.background = background;
        else svg.style.background = "";

        // Вставка иконки в SVG
        svg.appendChild(use);
    });
}

// Запуск инициализации после загрузки блоков
document.addEventListener('editorBlock:loaded', initSvgIcons);



// Заменить потом!!!!!
document.addEventListener('editorBlock:loaded', async () => {
    // await window.editorBlock.openBlock("/pages/about");
    // await window.editorBlock.openBlock("pages/userSlava/login");
    // await window.editorBlock.openBlock("/pages/example4");
    // await window.editorBlock.openBlock("/pages/loadBlockAttribute");
    await window.editorBlock.openBlock("/pages/example2");
    
    await window.editorBlock.openBlock("/pages/example5");
    // await document.getElementById("jsEditorButton").click();
    // await document.getElementById("codeWizardToggle").click();
});