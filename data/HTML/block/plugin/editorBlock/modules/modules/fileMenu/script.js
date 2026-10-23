/* ===
 * Базовые элементы файлового меню
=== */

// Список файлового меню
const fileMenuList = document.getElementById('fileMenuList');

// Кнопка файлового меню
const fileMenuButton = document.getElementById('fileMenuButton');



/* ===
 * Открытие и закрытие меню файлов
=== */
    
/* ***
 * openFileMenu - открытие меню файлов
 * - проверяет, был ли клик внутри меню файлов
 * - если да, ничего не делает
 * - если нет, открывает или закрывает меню файлов
*** */
function openFileMenu(event) {
    if (fileMenuList.style.display === 'none') {
        fileMenuList.style.display = '';
    } else {
        fileMenuList.style.display = 'none';
    }
}

/***
 * closeFileMenu - закрытие меню файлов
 * - проверяет, был ли клик вне меню файлов
 * - если да, скрывает меню файлов
*** */
function closeFileMenu(event) {
    if (!fileMenuButton || !fileMenuList || !fileMenuButton.isConnected || !fileMenuList.isConnected) {
        return;
    }

    if (!fileMenuButton.contains(event.target)) {
        fileMenuList.style.display = 'none';
    }
}

// Открытие меню файлов при клике на кнопку
fileMenuButton.addEventListener('click', openFileMenu);

// Закрытие меню файлов при клике вне его 
document.addEventListener('click', closeFileMenu);



/* ===
 * Действия файлового меню
=== */

async function executeFileMenuAction(action) {
    let blockContent = null;

    switch (action) {
        case 'save':
            blockContent = window.editorBlock.saveBlock();

            // Заменить потом!!!!!
            const blob = new Blob([blockContent], { type: 'application/zip' });
            const downloadUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = 'block.json';
            downloadLink.click();
            URL.revokeObjectURL(downloadUrl);

            break;

        case 'saveAs':
            blockContent = window.editorBlock.saveBlock();

            // Заменить потом!!!!!
            const blob2 = new Blob([blockContent], { type: 'application/zip' });
            const downloadUrl2 = URL.createObjectURL(blob2);
            const downloadLink2 = document.createElement('a');
            downloadLink2.href = downloadUrl2;
            downloadLink2.download = 'block.json';
            downloadLink2.click();
            URL.revokeObjectURL(downloadUrl2);

            break;

        case 'open':
            const path = await window.editorBlock.prompt('Введите путь к файлу для открытия:');
            if (path === null || path.trim() === '') return;
            await window.editorBlock.openBlock(path);
            break;

        case 'new':
            window.editorBlock.newBlock();
            break;

        case 'pageProperties':
            if (window.editorBlock && typeof window.editorBlock.openPageProperties === 'function') {
                window.editorBlock.openPageProperties();
            }
            break;

        default:
            console.log('Неизвестное действие:', action);
    }
}

// Обработка выбора пункта меню
fileMenuList.addEventListener('click', selectFileMenu);



/* ===
 * Меню файла и горячие клавиши
=== */

/* ***
 * selectFileMenu - обработка выбора пункта меню файла
 * - получает действие из дата-атрибута и вызывает его выполнение
 * - отдает null
*** */
async function selectFileMenu(event) {
    const selectedItem = event.target;
    const action = selectedItem.getAttribute('data-action');

    if (!action) {
        return;
    }

    await executeFileMenuAction(action);
}

/* ***
 * handleFileMenuKeyboardShortcuts - обработка горячих клавиш меню файла
 * - перехватывает комбинации Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O
 * - поддерживает любую раскладку клавиатуры
 * - отдает null
*** */
function handleFileMenuKeyboardShortcuts(event) {
    if (!event || !event.ctrlKey || event.altKey) {
        return;
    }

    const code = event.code;

    if (code === 'KeyS') {
        const editor = window.editorBlock;
        if (!editor || typeof editor.isBlockActive !== 'function' || !editor.isBlockActive()) {
            return;
        }

        event.preventDefault();
        executeFileMenuAction(event.shiftKey ? 'saveAs' : 'save');
        return;
    }

    if (code === 'KeyO') {
        event.preventDefault();
        executeFileMenuAction('open');
    }
}

/* ***
 * attachFileMenuShortcutHandlers - добавление обработчика горячих клавиш меню файла
 * - принимает документ редактора
 * - добавляет обработчик keydown только один раз
*** */
function attachFileMenuShortcutHandlers(targetDocument) {
    if (!targetDocument || targetDocument.fileMenuShortcutsBound) {
        return;
    }

    targetDocument.addEventListener('keydown', handleFileMenuKeyboardShortcuts);
    targetDocument.fileMenuShortcutsBound = true;
}

// Инициализация обработчиков горячих клавиш меню файла для текущего документа
attachFileMenuShortcutHandlers(document);
window.editorBlock.attachFileMenuShortcutHandlers = attachFileMenuShortcutHandlers;