// Контейнеры форм
const profilePasswordMode = document.getElementById("profilePasswordMode");
const adminPasswordMode = document.getElementById("adminPasswordMode");

// Поля для редактирования пароля
const userOldPasswordInput = document.getElementById("userOldPasswordInput");
const profileNewPasswordInput = document.getElementById("profileNewPasswordInput");
const adminNewPasswordInput = document.getElementById("adminNewPasswordInput");


// === создание и отображение формы ===

function getTempButton(buttonKey) {
    const buttonId = window.tempStore?.[buttonKey];
    return buttonId ? document.getElementById(buttonId) : null;
}

function bindTempButton(button, handlerKey, handler) {
    if (!button) {
        return;
    }

    if (button[handlerKey]) {
        button.removeEventListener("click", button[handlerKey]);
    }

    button[handlerKey] = handler;
    button.addEventListener("click", handler);
}

function getNewPasswordInput(mode) {
    return mode === "admin" ? adminNewPasswordInput : profileNewPasswordInput;
}

function closePasswordForm({ reloadPage = false } = {}) {
    const previousPage = window.tempStore?.previousPage;
    const containerId = window.tempStore?.passwordContainerId;

    if (reloadPage && previousPage) {
        loadBlock(`pages/usersData/${previousPage}`, "regDiv");
        return;
    }

    if (containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = "";
        }
    }
}

// Инициализация при подгрузке блока
function initPasswordBlock() {
    const mode = window.tempStore?.passwordMode;
    const saveButton = getTempButton("passwordSaveButtonId");
    const cancelButton = getTempButton("passwordCancelButtonId");

    if (mode === "admin") {
        profilePasswordMode.style.display = "none";
        adminPasswordMode.style.display = "flex";
    } else {
        profilePasswordMode.style.display = "flex";
        adminPasswordMode.style.display = "none";
    }

    bindTempButton(saveButton, "_passwordSaveHandler", savePassword);
    bindTempButton(cancelButton, "_passwordCancelHandler", () => closePasswordForm());
}


// === Сохранение пароля ===

async function savePassword() {
    const mode = window.tempStore?.passwordMode;
    const oldPassword = userOldPasswordInput?.value?.trim() || "";
    const newPasswordInput = getNewPasswordInput(mode);
    const newPassword = newPasswordInput?.value?.trim() || "";

    if (!newPassword) {
        alert("Введите новый пароль");
        return;
    }

    if (mode === "profile") {
        if (!oldPassword) {
            alert("Введите старый пароль");
            return;
        }

        await saveProfilePassword(oldPassword, newPassword);
    } else if (mode === "admin") {
        const userId = window.tempStore?.userId;
        if (!userId) {
            alert("Ошибка: не указан пользователь");
            return;
        }

        await saveAdminPassword(userId, newPassword);
    }
}

async function saveProfilePassword(oldPassword, newPassword) {
    try {
        const result = await apiProtected("/api/auth/me/password", {
            method: "PATCH",
            body: {
                oldPassword: oldPassword,
                newPassword: newPassword
            }
        });

        if (result?.status !== "ok") {
            alert("Ошибка смены пароля");
            return;
        }

        alert("Пароль успешно изменен");
        closePasswordForm({ reloadPage: true });
    } catch (e) {
        console.error("Ошибка смены пароля:", e);
        alert("Ошибка смены пароля");
    }
}

async function saveAdminPassword(userId, newPassword) {
    try {
        const result = await apiProtected(`/api/auth/users/admin/${userId}/password`, {
            method: "PATCH",
            body: {
                newPassword: newPassword
            }
        });

        if (result?.status !== "ok") {
            alert("Ошибка смены пароля");
            return;
        }

        alert("Пароль пользователя успешно изменен");
        closePasswordForm({ reloadPage: true });
    } catch (e) {
        console.error("Ошибка смены пароля:", e);
        alert("Ошибка смены пароля");
    }
}


initPasswordBlock();
