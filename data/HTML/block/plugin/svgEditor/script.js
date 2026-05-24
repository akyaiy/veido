// === Загрузка блоков редактора ===

// Название блоков для редактора
const editorBlocks = [
    "topPanel",
    "leftPanel",
    "centerPanel",
    "rightPanel"
];

// Функция для загрузки блоков редактора 
function loadEditorBlocks() {
    editorBlocks.forEach((blockName) => {
        loadBlock(`plugin/svgEditor/${blockName}`, blockName);
    });
}
loadEditorBlocks();