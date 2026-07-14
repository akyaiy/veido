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

function selectFileMenu(event) {
    const selectedItem = event.target;
    const filePath = selectedItem.getAttribute('data-action');
    switch (filePath) {
        case 'save':
            console.log('Сохранение файла...');
            break;

        case 'saveAs':
            console.log('Сохранение файла...');
            break;

        case 'open':
            const filePath = prompt('Введите путь к файлу для открытия:');
            window.editorBlock.openBlock(filePath);
            break;

        case 'new':
            console.log('Создание нового файла...');
            window.editorBlock.newBlock();
            break;

        default:
            console.log('Неизвестное действие:', filePath);
    }
}

// Обработка выбора пункта меню
fileMenuList.addEventListener('click', selectFileMenu);