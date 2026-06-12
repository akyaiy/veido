// === Общие ===

// Выбранный элемент
window.selectedElementsSvg = [];

// глобальный режим редактора
window.modeSvgEditor = "selection";



// === Загрузка блоков редактора ===

// Название блоков для редактора
const editorBlocks = [
    "centerPanel",
    "leftPanel",
    "rightPanel",
    "topPanel",
    "topPanel2"
];

// Функция для загрузки блоков редактора 
async function loadEditorBlocks() {
    // Загрузка блоков редактора
    for (const blockName of editorBlocks) {
        await loadBlock(`plugin/svgEditor/${blockName}`, blockName);
    }

    // Событие, сигнализирующее о том, что блоки редактора загружены
    document.dispatchEvent(new Event("svgEditorBlocksLoaded"));
}
loadEditorBlocks();