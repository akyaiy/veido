/* ***
 * handleSaveClick - обработка нажатия кнопки сохранения
*** */
function handleSaveClick() {
    console.log('save');
}

/* ***
 * handleRunClick - обработка запуска действия
*** */
function handleRunClick() {
    console.log('run');
}

/* ***
 * handleStopClick - обработка остановки действия
*** */
function handleStopClick() {
    console.log('stop');
}

/* ***
 * handleSearchInput - обработка ввода в поле поиска
*** */
function handleSearchInput() {
    console.log('input');
}

/* ***
 * handleCardHover - обработка наведения на карточку
*** */
function handleCardHover() {
    console.log('hover');
}

/* ***
 * handleHelpClick - обработка нажатия ссылки помощи
*** */
function handleHelpClick() {
    console.log('help');
}

// Привязка событий через getElementById
document.getElementById('saveButton').onclick = handleSaveClick;
document.getElementById('searchInput').oninput = handleSearchInput;
document.getElementById('helpLink').onclick = handleHelpClick;

// Привязка событий через переменную
const title = document.getElementById('title');
title.onclick = handleSaveClick;

// Привязка событий по классу
document.querySelectorAll('.actionButton').forEach(el => el.onclick = handleRunClick);
document.querySelectorAll('.primary').forEach(el => el.onmouseenter = handleRunClick);
document.querySelectorAll('.secondary').forEach(el => el.onmouseleave = handleStopClick);
document.querySelectorAll('.card').forEach(el => el.ondblclick = handleCardHover);