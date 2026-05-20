// Контейнеры форм
const profilePasswordMode = document.getElementById("profilePasswordMode");
const adminPasswordMode = document.getElementById("adminPasswordMode");

// Поля для редактирования пароля
const userOldPasswordInput = document.getElementById("userOldPasswordInput");
const profileNewPasswordInput = document.getElementById("profileNewPasswordInput");
const profileRepeatPasswordInput = document.getElementById("profileRepeatPasswordInput");
const adminNewPasswordInput = document.getElementById("adminNewPasswordInput");
const adminRepeatPasswordInput = document.getElementById("adminRepeatPasswordInput");

const TEMP_STORE_RECIPIENT = "usersDataPassword";

let passwordContext = null;

const passwordInputs = {
    profile: [userOldPasswordInput, profileNewPasswordInput, profileRepeatPasswordInput],
    admin: [adminNewPasswordInput, adminRepeatPasswordInput]
};


// === создание и отображение формы ===

// Получение контекста формы из tempStore
async function loadPasswordContext() {
    const items = await window.tempStore.getByRecipient(TEMP_STORE_RECIPIENT);
    passwordContext = Array.isArray(items) ? (items[items.length - 1] || null) : null;
    return passwordContext;
}

// Получение кнопки по id из tempStore
function getTempButton(buttonKey) {
    const buttonId = passwordContext?.[buttonKey];
    return buttonId ? document.getElementById(buttonId) : null;
}

// Привязка обработчика к кнопке с удалением старого обработчика
function bindTempButton(button, handlerKey, handler) {
    // Проверяем наличие кнопки
    if (!button) {
        return;
    }

    // Удаляем старый обработчик
    if (button[handlerKey]) {
        button.removeEventListener("click", button[handlerKey]);
    }

    // Сохраняем и добавляем новый обработчик
    button[handlerKey] = handler;
    button.addEventListener("click", handler);
}

// Получение значений формы пароля по режиму
function getPasswordValues(mode) {
    return (passwordInputs[mode] || []).map(input => input?.value?.trim() || "");
}

// Закрытие формы смены пароля
function closePasswordForm() {
    const containerId = passwordContext?.passwordContainerId;

    // Очистка контейнера формы
    if (containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = "";
        }
    }
}

// Инициализация блока смены пароля
async function initPasswordBlock() {
    const context = await loadPasswordContext();
    const mode = context?.passwordMode;

    if (!context) {
        return;
    }

    // Получаем кнопки управления
    const saveButton = getTempButton("passwordSaveButtonId");
    const cancelButton = getTempButton("passwordCancelButtonId");

    // Переключаем режим отображения формы
    if (mode === "admin") {
        profilePasswordMode.style.display = "none";
        adminPasswordMode.style.display = "flex";
    } else {
        profilePasswordMode.style.display = "flex";
        adminPasswordMode.style.display = "none";
    }

    // Привязываем обработчики кнопок
    bindTempButton(saveButton, "_passwordSaveHandler", savePassword);
    bindTempButton(cancelButton, "_passwordCancelHandler", () => closePasswordForm());
}


// === Сохранение пароля ===

// Сохранение пароля пользователя
async function savePassword() {
    const mode = passwordContext?.passwordMode;
    const values = getPasswordValues(mode);
    const oldPassword = mode === "profile" ? (values[0] || "") : "";
    const newPassword = mode === "admin" ? (values[0] || "") : (values[1] || "");
    const repeatPassword = mode === "admin" ? (values[1] || "") : (values[2] || "");

    // Проверяем повтор нового пароля
    if (newPassword !== repeatPassword) {
        alert("Пароли не совпадают");
        return;
    }

    // если пусто, то отмена
    if (mode === "profile" && !oldPassword && !newPassword && !repeatPassword) {
        return;
    }
    if (mode === "admin" && !newPassword && !repeatPassword) {
        return;
    }

    // Режим смены пароля текущего пользователя
    if (mode === "profile") {
        // Проверяем ввод старого пароля
        if (!oldPassword) {
            alert("Введите старый пароль");
            return;
        }

        await saveProfilePassword(oldPassword, newPassword);

    // Режим смены пароля администратором
    } else if (mode === "admin") {
        const userId = passwordContext?.userId;

        // Проверяем наличие id пользователя
        if (!userId) {
            alert("Ошибка: не указан пользователь");
            return;
        }

        await saveAdminPassword(userId, newPassword);
    }
}

// Сохранение пароля текущего пользователя
async function saveProfilePassword(oldPassword, newPassword) {
    try {
        // Отправляем запрос на смену пароля
        const result = await apiProtected("/api/auth/me/password", {
            method: "PATCH",
            body: {
                oldPassword: oldPassword,
                newPassword: newPassword
            }
        });

        // Проверяем результат запроса
        if (result?.status !== "ok") {
            alert("Ошибка смены пароля");
            return;
        }

        alert("Пароль успешно изменен");

        // Закрываем форму
        closePasswordForm();

    } catch (e) {
        console.error("Ошибка смены пароля:", e);
        alert("Ошибка смены пароля");
    }
}

// Сохранение пароля другого пользователя администратором
async function saveAdminPassword(userId, newPassword) {
    try {
        // Отправляем запрос на смену пароля
        const result = await apiProtected(`/api/auth/users/admin/${userId}/password`, {
            method: "PATCH",
            body: {
                newPassword: newPassword
            }
        });

        // Проверяем результат запроса
        if (result?.status !== "ok") {
            alert("Ошибка смены пароля");
            return;
        }

        alert("Пароль пользователя успешно изменен");

        // Закрываем форму
        closePasswordForm();

    } catch (e) {
        console.error("Ошибка смены пароля:", e);
        alert("Ошибка смены пароля");
    }
}


initPasswordBlock();
