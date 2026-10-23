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

// Путь текущего файла
let editorBlockFileUri = null;

// Преобразование пути в VFS URI
function editorBlockUri(path) {
    return path.includes(':///')
        ? path
        : window.VFS_ROOT + path.replace(/^\/+/, '');
}

// Сохранение блока
async function saveEditorBlock(saveAs = false) {
    const blockId = window.editorBlock.currentBlockId;
    if (!blockId) return;

    const block = document.getElementById(blockId);
    if (!block) return;

    // Получение пути папки
    let path = block.dataset.path;

    // Запрос пути для нового блока или "Сохранить как"
    if (!path || saveAs) {
        path = prompt('Введите путь к папке:', path || 'pages/new');
        if (!path || !path.trim()) return;
    }

    path = path.trim().replace(/^\/+|\/+$/g, '');

    // Сохранение изменений редактора
    window.editorBlock.savePreviousBlock(blockId);

    const html = document.getElementById(blockId + 'Html')?.textContent ?? '';
    const css = document.getElementById(blockId + 'Css')?.textContent ?? '';
    const js = document.getElementById(blockId + 'Js')?.textContent ?? '';

    try {
        // Сохранение трёх файлов
        for (const [name, content] of [
            ['content.md', html],
            ['style.css', css],
            ['script.js', js]
        ]) {
            const uri = editorBlockUri(path + '/' + name);

            if (await window.vfs.exists(uri)) {
                await window.vfs.write(uri, content);
            } else {
                await window.vfs.create(
                    uri,
                    new Blob([content], { type: 'text/plain' })
                );
            }
        }

        // Запоминаем путь папки для следующего сохранения
        block.dataset.path = path;
    } catch (error) {
        console.error('Ошибка сохранения блока:', error);
    }
}

/* ***
 * executeFileMenuAction - выполнение действия файлового меню
 * - принимает действие (save, saveAs, open, new, pageProperties)
 * - выполняет соответствующее действие
*** */
async function executeFileMenuAction(action) {
    switch (action) {
        case 'save':
            await saveEditorBlock();
            break;

        case 'saveAs':
            await saveEditorBlock(true);
            break;

        case 'open': {
            const path = await window.editorBlock.prompt(
                'Введите путь к файлу для открытия:'
            );

            if (!path || !path.trim()) return;

            try {
                await window.editorBlock.openBlock(path.replace(/^\/+/, ''));
            } catch (error) {
                console.error('Ошибка открытия блока:', error);
            }
            break;
        }

        case 'new':
            window.editorBlock.newBlock();
            editorBlockFileUri = null;
            break;

        case 'pageProperties':
            if (window.editorBlock &&
                typeof window.editorBlock.openPageProperties === 'function') {
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