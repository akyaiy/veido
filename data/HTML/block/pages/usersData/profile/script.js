// Главные контейнеры
const userPasswordBlock = document.getElementById("userPasswordBlock");

// Данные пользователя
const username = document.getElementById("username");
const usernameInput = document.getElementById("usernameInput");
const userOldPasswordInput = document.getElementById("userOldPasswordInput");
const userPasswordInput = document.getElementById("userPasswordInput");

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
    userPasswordBlock.style.display = isEditMode ? "block" : "none";
    btnEditUser.style.display = isEditMode ? "none" : "inline-block";
    btnSaveUser.style.display = isEditMode ? "inline-block" : "none";
    btnCancelUser.style.display = isEditMode ? "inline-block" : "none";
}

// Отмена редактирования профиля
function cancelEditMode() {
    // Возвращаем исходные значения пользователя
    usernameInput.value = currentUser?.username ?? "";
    userOldPasswordInput.value = "";
    userPasswordInput.value = "";
    setEditMode(false);
}

// Переход в режим редактирования
function enableEditMode() {
    // Проверяем, что данные пользователя загружены
    if (!currentUser) {
        alert("Ошибка загрузки профиля");
        return;
    }

    // Заполняем поля текущими значениями
    usernameInput.value = currentUser.username ?? "";
    userOldPasswordInput.value = "";
    userPasswordInput.value = "";
    setEditMode(true);
}



// === Глобальные действия с пользователем ===

// Сохранение данных профиля
async function saveProfileData() {
    const nextUsername = usernameInput.value.trim();
    const oldPassword = userOldPasswordInput.value.trim();
    const newPassword = userPasswordInput.value.trim();
    const body = {};

    // Проверяем, что имя заполнено
    if (!nextUsername) {
        alert("Введите имя пользователя");
        return;
    }

    // Проверяем, что пароль заполнен корректно
    if (oldPassword || newPassword) {
        if (!oldPassword || !newPassword) {
            alert("Заполните оба поля пароля");
            return;
        }
    }

    // Добавляем имя, если оно изменилось
    if (nextUsername !== (currentUser?.username ?? "")) {
        body.name = nextUsername;
    }

    // Если изменений нет - просто выходим из режима
    if (Object.keys(body).length === 0 && !oldPassword && !newPassword) {
        setEditMode(false);
        return;
    }

    // Подтверждаем сохранение изменений
    const isConfirmed = confirm("Сохранить изменения профиля?");
    if (!isConfirmed) {
        return;
    }

    try {
        // Сохраняем имя пользователя
        if (Object.keys(body).length > 0) {
            const result = await apiProtected('/api/auth/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            // Проверяем успешный ответ
            if (result?.status !== 'ok') {
                alert('Ошибка сохранения профиля');
                return;
            }
        }

        // Меняем пароль пользователя
        if (oldPassword && newPassword) {
            const passwordResult = await apiProtected('/api/auth/me/password', {
                method: 'PATCH',
                body: {
                    oldPassword: oldPassword,
                    newPassword: newPassword
                }
            });

            // Проверяем успешный ответ
            if (passwordResult?.status !== 'ok') {
                alert('Ошибка смены пороля');
                return;
            }
        }

        alert('Данные профиля сохранены');
        await loadProfile();
    } catch (e) {
        console.error('Ошибка сохранения профиля:', e);
        alert('Ошибка сохранения профиля');
    }
}



// Редактирование профиля
btnEditUser.addEventListener("click", enableEditMode);

// Глобальные действия с пользователем
btnSaveUser.addEventListener("click", saveProfileData);
btnCancelUser.addEventListener("click", cancelEditMode);

// Автозагрузка данных профиля
loadProfile();