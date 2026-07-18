/* ===
 * Состояние модуля Modal Windows
=== */

// Активные callback-функции для текущих окон
let activeConfirmCallback = null;
let activePromptCallback = null;

// Очереди для независимого отображения окон
const alertQueue = [];
const interactiveQueue = [];

// Флаги занятости окон в данный момент
let isAlertActive = false;
let isInteractiveActive = false;

// Таймер для автоматического скрытия alert
let alertTimeoutId = null;



/* ===
 * Элементы интерфейса
=== */

// Элементы окна Alert
const modalAlert = document.getElementById('modalAlert');
const modalAlertBtn = document.getElementById('modalAlertBtn');

// Элементы окна Confirm
const modalConfirm = document.getElementById('modalConfirm');
const modalConfirmOkBtn = document.getElementById('modalConfirmOkBtn');
const modalConfirmCancelBtn = document.getElementById('modalConfirmCancelBtn');

// Элементы окна Prompt
const modalPrompt = document.getElementById('modalPrompt');
const modalPromptInput = document.getElementById('modalPromptInput');
const modalPromptOkBtn = document.getElementById('modalPromptOkBtn');
const modalPromptCancelBtn = document.getElementById('modalPromptCancelBtn');



/* ===
 * Логика управления очередями
=== */

/* ***
 * processAlertQueue - обработка очереди уведомлений Alert
 * - проверяет флаг активности и наличие элементов в массиве
 * - отображает элемент, запускает таймер на 3 секунды для автоскрытия
*** */
function processAlertQueue() {
    if (isAlertActive || alertQueue.length === 0) {
        return;
    }

    isAlertActive = true;
    const currentAlert = alertQueue.shift();

    modalAlert.querySelector('.modalText').textContent = currentAlert.text;
    modalAlert.style.display = 'block';

    alertTimeoutId = setTimeout(function() {
        handleAlertClose();
    }, 3000);
}

/* ***
 * processInteractiveQueue - обработка очереди окон Confirm и Prompt
 * - извлекает задачу из массива и проверяет ее тип (confirm или prompt)
 * - настраивает callback функции и выводит нужное окно на экран
*** */
function processInteractiveQueue() {
    if (isInteractiveActive || interactiveQueue.length === 0) {
        return;
    }

    isInteractiveActive = true;
    const currentTask = interactiveQueue.shift();

    if (currentTask.type === 'confirm') {
        modalConfirm.querySelector('.modalText').textContent = currentTask.text;
        activeConfirmCallback = currentTask.callback;
        modalConfirm.style.display = 'block';
    } else if (currentTask.type === 'prompt') {
        modalPrompt.querySelector('.modalText').textContent = currentTask.text;
        modalPromptInput.value = currentTask.defaultValue;
        activePromptCallback = currentTask.callback;
        modalPrompt.style.display = 'block';
        modalPromptInput.focus();
    }
}



/* ===
 * Публичные методы модуля
=== */

/* ***
 * showAlert - добавление информационного уведомления в очередь
 * - принимает строку сообщения text
*** */
function showAlert(text) {
    alertQueue.push({ text: text });
    processAlertQueue();
}

/* ***
 * showConfirm - добавление окна подтверждения в очередь
 * - принимает строку вопроса text и callback функцию
*** */
function showConfirm(text, callback) {
    interactiveQueue.push({
        type: 'confirm',
        text: text,
        callback: typeof callback === 'function' ? callback : null
    });
    processInteractiveQueue();
}

/* ***
 * showPrompt - добавление окна ввода данных в очередь
 * - принимает строку заголовка text, дефолтное значение и callback функцию
*** */
function showPrompt(text, defaultValue = '', callback) {
    interactiveQueue.push({
        type: 'prompt',
        text: text,
        defaultValue: defaultValue,
        callback: typeof callback === 'function' ? callback : null
    });
    processInteractiveQueue();
}

function prompt(text, defaultValue = '') {
    return new Promise(resolve => {
        showPrompt(text, defaultValue, resolve);
    });
}

function confirm(text) {
    return new Promise(resolve => {
        showConfirm(text, resolve);
    });
}

function alert(text) {
    showAlert(text);
    return Promise.resolve();
}

/* ***
 * closeAllModals - принудительный сброс и очистка всех окон
 * - скрывает все элементы и обнуляет очереди задач
*** */
function closeAllModals() {
    clearTimeout(alertTimeoutId);
    
    modalAlert.style.display = 'none';
    modalConfirm.style.display = 'none';
    modalPrompt.style.display = 'none';
    
    alertQueue.length = 0;
    interactiveQueue.length = 0;
    
    isAlertActive = false;
    isInteractiveActive = false;
    
    activeConfirmCallback = null;
    activePromptCallback = null;
}

// Экспорт методов модуля в глобальную область видимости
window.editorBlock = window.editorBlock || {};
window.editorBlock.showAlert = showAlert;
window.editorBlock.showConfirm = showConfirm;
window.editorBlock.showPrompt = showPrompt;
window.editorBlock.alert = alert;
window.editorBlock.confirm = confirm;
window.editorBlock.prompt = prompt;
window.editorBlock.closeAllModals = closeAllModals;



/* ===
 * Обработчики событий модуля
=== */

/* ***
 * handleAlertClose - внутренняя функция закрытия текущего Alert
 * - скрывает окно, сбрасывает флаг активности и запускает очередь дальше
*** */
function handleAlertClose() {
    clearTimeout(alertTimeoutId);
    modalAlert.style.display = 'none';
    isAlertActive = false;
    processAlertQueue();
}

/* ***
 * handleConfirmOk - клик по кнопке Да
*** */
function handleConfirmOk() {
    if (activeConfirmCallback) {
        activeConfirmCallback(true);
    }
    modalConfirm.style.display = 'none';
    isInteractiveActive = false;
    activeConfirmCallback = null;
    processInteractiveQueue();
}

/* ***
 * handleConfirmCancel - клик по кнопке Отмена в подтверждении
*** */
function handleConfirmCancel() {
    if (activeConfirmCallback) {
        activeConfirmCallback(false);
    }
    modalConfirm.style.display = 'none';
    isInteractiveActive = false;
    activeConfirmCallback = null;
    processInteractiveQueue();
}

/* ***
 * handlePromptOk - клик по кнопке OK в окне ввода
*** */
function handlePromptOk() {
    if (activePromptCallback) {
        activePromptCallback(modalPromptInput.value);
    }
    modalPrompt.style.display = 'none';
    isInteractiveActive = false;
    activePromptCallback = null;
    processInteractiveQueue();
}

/* ***
 * handlePromptCancel - клик по кнопке Отмена в окне ввода
*** */
function handlePromptCancel() {
    if (activePromptCallback) {
        activePromptCallback(null);
    }
    modalPrompt.style.display = 'none';
    isInteractiveActive = false;
    activePromptCallback = null;
    processInteractiveQueue();
}

// Добавление обработчиков взаимодействия с кнопками окон
modalAlertBtn.addEventListener('click', handleAlertClose);
modalConfirmOkBtn.addEventListener('click', handleConfirmOk);
modalConfirmCancelBtn.addEventListener('click', handleConfirmCancel);
modalPromptOkBtn.addEventListener('click', handlePromptOk);
modalPromptCancelBtn.addEventListener('click', handlePromptCancel);