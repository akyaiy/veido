// Главные контейнеры
const passwordBlockContainer = document.getElementById("passwordBlockContainer");

// Данные пользователя
const username = document.getElementById("username");
const usernameInput = document.getElementById("usernameInput");

let currentUser = null;
let currentUserRoles = [];

// Кнопки управления
const btnEditUser = document.getElementById("btnEditUser");
const btnSaveUser = document.getElementById("btnSaveUser");
const btnCancelUser = document.getElementById("btnCancelUser");

// Режим редактирования
let isEditMode = false;




// === Загрузка данных ===

// Загрузка данных текущего пользователя
async function loadProfile() {
    try {
        // Запрос к API текущего пользователя
        const user = await apiProtected('/api/auth/me', { method: 'GET' });
        if (!user || !user.data) return;
        const data = user.data;

        // Запрос к ролям текущего пользователя
        const roles = await apiProtected(`/api/acl-admin/users/${data.id}/roles?limit=100`, { method: 'GET' });

        currentUser = data;
        currentUserRoles = Array.isArray(roles) ? roles : [];
        fillProfileData(currentUser, currentUserRoles);
    } catch (e) {
        console.error("Ошибка загрузки профиля:", e);
    }
}

// Заполнение блока данных профиля
function fillProfileData(data = null, roles = []) {
    currentUser = data;
    currentUserRoles = roles;

    // Отключаем режим редактирования при перерисовке
    setEditMode(false);
    passwordBlockContainer.innerHTML = "";

    // Заполняем основные поля
    document.getElementById("userId").textContent = data?.id ?? "-";
    username.textContent = data?.username ?? "-";
    usernameInput.value = data?.username ?? "";
    document.getElementById("userActive").textContent = data?.status ?? "-";

    // Заполняем список ролей
    const rolesEl = document.getElementById("userRoles");
    rolesEl.innerHTML = "";

    if (roles.length === 0) {
        const div = document.createElement("div");
        div.textContent = "-";
        rolesEl.appendChild(div);
        return;
    }

    roles.forEach(role => {
        const div = document.createElement("div");
        div.textContent = "• " + role.name;
        rolesEl.appendChild(div);
    });
}



// === Редактирование профиля ===

// Включение и выключение режима редактирования
function setEditMode(enabled) {
    isEditMode = Boolean(enabled);

    // Переключаем отображение редактируемых полей
    username.style.display = isEditMode ? "none" : "inline";
    usernameInput.style.display = isEditMode ? "inline-block" : "none";
    btnEditUser.style.display = isEditMode ? "none" : "inline-block";
    btnSaveUser.style.display = isEditMode ? "inline-block" : "none";
    btnCancelUser.style.display = isEditMode ? "inline-block" : "none";
}

// Отмена редактирования профиля
function cancelEditMode() {
    if (passwordBlockContainer?.children.length > 0) {
        passwordBlockContainer.innerHTML = "";
    }

    // Возвращаем исходные значения пользователя
    usernameInput.value = currentUser?.username ?? "";
    setEditMode(false);
    // Очищаем контейнер пароля
    passwordBlockContainer.innerHTML = "";
}

// Переход в режим редактирования
function enableEditMode() {
    // Проверяем, что данные пользователя загружены
    if (!currentUser) {
        window.tempStore.messageAPI.showUsersDataMessage("Ошибка загрузки профиля", "error");
        return;
    }

    // Заполняем поля текущими значениями
    usernameInput.value = currentUser.username ?? "";
    setEditMode(true);
}



// Проверка, что форма пароля пустая
function isEmptyPasswordBlock() {
    const inputs = passwordBlockContainer.querySelectorAll("input");
    return Array.from(inputs).every(input => !input.value.trim());
}


// === Глобальные действия с пользователем ===

// Сохранение данных профиля
async function saveProfileData() {
    if (passwordBlockContainer?.children.length > 0 && !isEmptyPasswordBlock()) {
        return;
    }

    if (passwordBlockContainer?.children.length > 0 && isEmptyPasswordBlock()) {
        btnSaveUser._skipPasswordSubmitOnce = true;
    }

    const nextUsername = usernameInput.value.trim();
    const body = {};

    // Проверяем, что имя заполнено
    if (!nextUsername) {
        window.tempStore.messageAPI.showUsersDataMessage("Введите имя пользователя", "error");
        return;
    }

    // Добавляем имя, если оно изменилось
    if (nextUsername !== (currentUser?.username ?? "")) {
        body.name = nextUsername;
    }

    // Не отправляем PATCH без изменений, иначе сервер вернет 400.
    if (Object.keys(body).length === 0) {
        setEditMode(false);
        return;
    }

    // Подтверждаем сохранение изменений
    const isConfirmed = await window.tempStore.messageAPI.confirmUsersDataMessage("Сохранить изменения профиля?");
    if (!isConfirmed) {
        return;
    }

    try {
        // Сохраняем имя пользователя
        const result = await apiProtected('/api/auth/me', {
            method: 'PATCH',
            body: body
        });

        // Проверяем успешный ответ
        if (result?.status !== 'ok') {
            window.tempStore.messageAPI.showUsersDataMessage("Ошибка сохранения профиля", "error");
            return;
        }

        window.tempStore.messageAPI.showUsersDataMessage("Данные профиля сохранены", "success");

        // Перезагружаем данные профиля
        await loadProfile();
    } catch (e) {
        console.error('Ошибка сохранения профиля:', e);
        window.tempStore.messageAPI.showUsersDataMessage("Ошибка сохранения профиля", "error");
    }
}

// Открыть форму смены пароля
async function showPasswordForm() {
    // Сохраняем контекст для подгруженного блока
    await window.tempStore.store({
        passwordMode: "profile",
        passwordSaveButtonId: "btnSaveUser",
        passwordCancelButtonId: "btnCancelUser",
        passwordContainerId: "passwordBlockContainer"
    }, {
        recipient: "usersDataPassword",
        ttlMs: 5000,
        destroyOnRead: true
    });
    
    // Подгружаем блок пароля
    loadBlock('pages/usersData/elements/password', 'passwordBlockContainer');
}



// Редактирование профиля
btnEditUser.addEventListener("click", enableEditMode);

// Глобальные действия с пользователем
btnSaveUser.addEventListener("click", saveProfileData);
btnCancelUser.addEventListener("click", cancelEditMode);
btnEditUser.addEventListener("click", showPasswordForm);

// Автозагрузка данных профиля
loadProfile();