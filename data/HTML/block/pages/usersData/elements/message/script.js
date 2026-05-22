// Главный контейнер сообщения
const usersDataMessage = document.getElementById("usersDataMessage");

// текст сообщения
const usersDataMessageText = document.getElementById("usersDataMessageText");

// Кнопки управления сообщением
const usersDataMessageClose = document.getElementById("usersDataMessageClose");
const usersDataMessageActions = document.getElementById("usersDataMessageActions");
const usersDataMessageCancel = document.getElementById("usersDataMessageCancel");
const usersDataMessageOk = document.getElementById("usersDataMessageOk");

// Таймер автоскрытия
let messageTimer = null;

// Обработчик confirm
let confirmResolver = null;



// === Работа с сообщением ===

// Очистка таймера сообщения
function clearUsersDataMessageTimer() {
    if (!messageTimer) {
        return;
    }

    clearTimeout(messageTimer);
    messageTimer = null;
}

// Сброс состояния сообщения
function resetUsersDataMessage() {
    if (!usersDataMessage || !usersDataMessageText) {
        return;
    }

    usersDataMessage.className = "usersDataMessage";
    usersDataMessageText.textContent = "";

    clearUsersDataMessageTimer();
}

// Скрытие сообщения
function hideUsersDataMessage() {
    resetUsersDataMessage();
}

// Показ обычного сообщения
function showUsersDataMessage(text, type = "error") {
    if (!usersDataMessage || !usersDataMessageText) {
        return;
    }

    // Закрываем активный confirm
    if (confirmResolver) {
        confirmResolver(false);
        confirmResolver = null;
    }

    // Показываем сообщение
    usersDataMessage.className = "usersDataMessage show";

    if (type) {
        usersDataMessage.classList.add(type);
    }

    usersDataMessageText.textContent = text || "";

    // Перезапускаем таймер автоскрытия
    clearUsersDataMessageTimer();
    messageTimer = setTimeout(hideUsersDataMessage, 4000);
}



// === Confirm сообщение ===

// Показ confirm-сообщения
function confirmUsersDataMessage(text) {
    if (!usersDataMessage || !usersDataMessageText) {
        return Promise.resolve(false);
    }

    // Закрываем прошлый confirm
    if (confirmResolver) {
        confirmResolver(false);
    }

    // Показываем confirm
    clearUsersDataMessageTimer();

    usersDataMessage.className = "usersDataMessage show confirm";
    usersDataMessageText.textContent = text || "";

    // Ожидание ответа пользователя
    return new Promise(resolve => {
        confirmResolver = value => {
            confirmResolver = null;

            resetUsersDataMessage();
            resolve(Boolean(value));
        };
    });
}



// Экспорт функций для глобального доступа
window.showUsersDataMessage = showUsersDataMessage;
window.hideUsersDataMessage = hideUsersDataMessage;
window.confirmUsersDataMessage = confirmUsersDataMessage;

// Закрытие сообщения
usersDataMessageClose.addEventListener("click", hideUsersDataMessage);

// Отмена confirm
usersDataMessageCancel.addEventListener("click", () => {
    if (confirmResolver) {
        confirmResolver(false);
    }
});

// Подтверждение confirm
usersDataMessageOk.addEventListener("click", () => {
    if (confirmResolver) {
        confirmResolver(true);
    }
});