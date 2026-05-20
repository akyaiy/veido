// Главные контейнеры
const activateBlock = document.getElementById("activateBlock");
const passwordBlockContainer = document.getElementById("passwordBlockContainer");

// Список пользователей
const userSelect = document.getElementById("userSelect");

// Данные всех пользователей
let allRoles = [];

// Режим редактирования
let isEditMode = false;

// Данные пользователя
const userId = document.getElementById("userId");
const username = document.getElementById("username");
const usernameInput = document.getElementById("usernameInput");
const userStatus = document.getElementById("userStatus");
const userStatusInput = document.getElementById("userStatusInput");
const userRoles = document.getElementById("userRoles");
const userRolesInput = document.getElementById("userRolesInput");

let currentUser = null;
let currentUserRoles = [];
let editedRoleIds = [];

// Кнопки управления
const btnEditUser = document.getElementById("btnEditUser");
const btnSaveUser = document.getElementById("btnSaveUser");
const btnCancelUser = document.getElementById("btnCancelUser");
const btnDeleteUser = document.getElementById("btnDeleteUser");



// === Загрузка данных ===

// Загрузка списка пользователей
async function loadUsers(selectedUserId = Number(userSelect.value)) {
    try {
        // Запрашиваем список пользователей
        const response = await apiProtected("/api/auth/users/admin?limit=100", { method: "GET" });
        const users = response?.data || [];

        // Очищаем список
        userSelect.innerHTML = "";

        // Заполняем список пользователей
        users.forEach(user => {
            const option = document.createElement("option");
            option.value = user.id;
            option.textContent = `${user.username} (${user.status})`;
            userSelect.appendChild(option);
        });

        // Если список не пустой - выбираем нужного пользователя
        if (users.length > 0) {
            const hasSelectedUser = users.some(user => Number(user.id) === Number(selectedUserId));
            userSelect.value = hasSelectedUser ? String(selectedUserId) : String(users[0].id);
            await loadSelectedUser();
        } else {
            fillUserData();
        }
    } catch (e) {
        console.error("Ошибка загрузки пользователей:", e);
        alert("Ошибка загрузки списка пользователей");
    }
}

// Загрузка данных выбранного пользователя
async function loadSelectedUser() {
    const selectedUserId = Number(userSelect.value);

    // Проверяем, что пользователь выбран
    if (!selectedUserId) {
        fillUserData();
        return;
    }

    try {
        // Запрашиваем данные пользователя и его роли
        const response = await apiProtected(`/api/auth/users/admin/${selectedUserId}`, { method: "GET" });
        const roles = await apiProtected(`/api/acl-admin/users/${selectedUserId}/roles?limit=100`, { method: "GET" });

        currentUser = response?.data || null;
        currentUserRoles = Array.isArray(roles) ? roles : [];
        fillUserData(currentUser, currentUserRoles);
    } catch (e) {
        console.error("Ошибка загрузки данных пользователя:", e);
        alert("Ошибка загрузки данных пользователя");
    }
}

// Заполнение блока данных пользователя
function fillUserData(data = null, roles = []) {
    currentUser = data;
    currentUserRoles = roles;
    editedRoleIds = roles.map(role => Number(role.id));

    // Отключаем режим редактирования при перерисовке
    setEditMode(false);

    // Заполняем основные поля
    userId.textContent = data?.id ?? "-";
    username.textContent = data?.username ?? "-";
    usernameInput.value = data?.username ?? "";
    userStatus.textContent = data?.status ?? "-";
    userStatusInput.value = data?.status ?? "inactive";

    // Заполняем список ролей
    renderUserRoles();
    renderAvailableRoles();
}

// Поиск роли по ID
function getRoleById(roleId) {
    return allRoles.find(role => Number(role.id) === Number(roleId))
        || currentUserRoles.find(role => Number(role.id) === Number(roleId))
        || null;
}

// Рендерим роли пользователя
function renderUserRoles() {
    userRoles.innerHTML = "";

    // В режиме редактирования берём текущий набор выбранных ролей
    const roles = isEditMode
        ? editedRoleIds.map(roleId => getRoleById(roleId)).filter(Boolean)
        : currentUserRoles;

    if (roles.length === 0) {
        const div = document.createElement("div");
        div.textContent = "-";
        userRoles.appendChild(div);
        return;
    }

    roles.forEach(role => {
        const div = document.createElement("div");
        const roleName = document.createElement("span");
        roleName.textContent = "• " + role.name;
        div.appendChild(roleName);

        // В режиме редактирования добавляем удаление роли
        if (isEditMode) {
            const btnRemoveRole = document.createElement("button");
            btnRemoveRole.className = "btnRemoveRole";
            btnRemoveRole.type = "button";
            btnRemoveRole.textContent = "-";
            btnRemoveRole.onclick = () => removeRoleFromEdit(role.id);
            div.appendChild(btnRemoveRole);
        }

        userRoles.appendChild(div);
    });
}

// Загрузка списка всех ролей
async function loadAllRoles() {
    try {
        // Запрашиваем все доступные роли
        const roles = await apiProtected("/api/acl-admin/roles?limit=100", { method: "GET" });
        allRoles = Array.isArray(roles) ? roles : [];
        renderAvailableRoles();
    } catch (e) {
        console.error("Ошибка загрузки ролей:", e);
        alert("Ошибка загрузки списка ролей");
    }
}

// Заполняем список ролей для добавления
function renderAvailableRoles() {
    userRolesInput.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Выберите роль";
    userRolesInput.appendChild(emptyOption);

    allRoles
        .filter(role => !editedRoleIds.includes(Number(role.id)))
        .forEach(role => {
            const option = document.createElement("option");
            option.value = role.id;
            option.textContent = role.name;
            userRolesInput.appendChild(option);
        });

    userRolesInput.value = "";
}



// === Редактирование данных пользователя ===

// Включение и выключение режима редактирования
function setEditMode(enabled) {
    isEditMode = Boolean(enabled);

    // Переключаем отображение редактируемых полей
    username.style.display = isEditMode ? "none" : "inline";
    usernameInput.style.display = isEditMode ? "inline-block" : "none";
    userStatus.style.display = isEditMode ? "none" : "inline";
    userStatusInput.style.display = isEditMode ? "inline-block" : "none";
    userRolesInput.style.display = isEditMode ? "inline-block" : "none";
    btnEditUser.style.display = isEditMode ? "none" : "inline-block";
    btnDeleteUser.style.display = isEditMode ? "inline-block" : "none";
    btnSaveUser.style.display = isEditMode ? "inline-block" : "none";
    btnCancelUser.style.display = isEditMode ? "inline-block" : "none";

    // Блокируем верхнее управление во время редактирования
    activateBlock.style.display = isEditMode ? "none" : "";

    // Перерисовываем роли после смены режима
    renderUserRoles();
    renderAvailableRoles();
}

// Отмена редактирования пользователя
function cancelEditMode() {
    // Возвращаем исходные значения пользователя
    editedRoleIds = currentUserRoles.map(role => Number(role.id));
    usernameInput.value = currentUser?.username ?? "";
    userStatusInput.value = currentUser?.status ?? "inactive";
    setEditMode(false);
    // Очищаем контейнер пароля
    passwordBlockContainer.innerHTML = "";
}

// Переход в режим редактирования
async function enableEditMode() {
    // Проверяем, что данные пользователя загружены
    if (!currentUser) {
        alert("Выберите пользователя");
        return;
    }

    // Загружаем список ролей перед редактированием
    await loadAllRoles();

    // Заполняем поля текущими значениями
    usernameInput.value = currentUser.username ?? "";
    userStatusInput.value = currentUser.status ?? "inactive";
    editedRoleIds = currentUserRoles.map(role => Number(role.id));
    setEditMode(true);
}

// Добавляем роль в список редактирования
function addRoleToEdit() {
    const roleId = Number(userRolesInput.value);

    // Проверяем, что роль выбрана
    if (!roleId) {
        return;
    }

    // Если роли ещё нет - добавляем
    if (!editedRoleIds.includes(roleId)) {
        editedRoleIds.push(roleId);
    }

    renderUserRoles();
    renderAvailableRoles();
}

// Удаляем роль из списка редактирования
function removeRoleFromEdit(roleId) {
    editedRoleIds = editedRoleIds.filter(id => Number(id) !== Number(roleId));
    renderUserRoles();
    renderAvailableRoles();
}



// === Глобальные действия с пользователем ===

// Сохранение данных пользователя
async function saveUserData() {
    if (passwordBlockContainer?.children.length > 0) {
        return;
    }

    const selectedUserId = Number(userSelect.value);
    const nextUsername = usernameInput.value.trim();
    const nextStatus = userStatusInput.value;
    const currentRoleIds = currentUserRoles.map(role => Number(role.id));
    const rolesToAdd = editedRoleIds.filter(roleId => !currentRoleIds.includes(roleId));
    const rolesToRemove = currentRoleIds.filter(roleId => !editedRoleIds.includes(roleId));

    // Проверяем, что пользователь выбран
    if (!selectedUserId) {
        alert("Выберите пользователя");
        return;
    }

    // Проверяем, что имя заполнено
    if (!nextUsername) {
        alert("Введите имя пользователя");
        return;
    }

    const body = {};

    // Добавляем имя, если оно изменилось
    if (nextUsername !== (currentUser?.username ?? "")) {
        body.name = nextUsername;
    }

    // Добавляем статус, если он изменился
    if (nextStatus !== (currentUser?.status ?? "")) {
        body.status = nextStatus;
    }

    // Если изменений нет - просто выходим из режима
    if (Object.keys(body).length === 0 && rolesToAdd.length === 0 && rolesToRemove.length === 0) {
        setEditMode(false);
        return;
    }

    // Подтверждаем сохранение изменений
    const isConfirmed = confirm("Сохранить изменения пользователя?");
    if (!isConfirmed) {
        return;
    }

    try {
        // Сохраняем основные данные пользователя
        if (Object.keys(body).length > 0) {
            const result = await apiProtected(`/api/auth/users/admin/${selectedUserId}`, {
                method: "PATCH",
                body: body
            });

            // Проверяем успешный ответ
            if (result?.status !== "ok") {
                alert("Ошибка сохранения данных пользователя");
                return;
            }
        }

        // Добавляем новые роли пользователю
        for (const roleId of rolesToAdd) {
            await apiProtected(`/api/acl-admin/users/${selectedUserId}/roles`, {
                method: "POST",
                body: {
                    roleId: roleId
                }
            });
        }

        // Удаляем снятые роли у пользователя
        for (const roleId of rolesToRemove) {
            await apiProtected(`/api/acl-admin/users/${selectedUserId}/roles/${roleId}`, {
                method: "DELETE"
            });
        }

        // Перезагружаем данные пользователя
        alert("Данные пользователя сохранены");
        await loadUsers(selectedUserId);
    } catch (e) {
        console.error("Ошибка сохранения данных пользователя:", e);
        alert("Ошибка сохранения данных пользователя");
    }
}

// Открыть форму смены пароля
async function showPasswordForm() {
    // Сохраняем контекст для подгруженного блока
    await window.tempStore.store({
        passwordMode: "admin",
        userId: Number(userSelect.value),
        passwordSaveButtonId: "btnSaveUser",
        passwordCancelButtonId: "btnCancelUser",
        passwordContainerId: "passwordBlockContainer"
    }, {
        recipient: "usersDataPassword",
        ttlMs: 5000,
        destroyOnRead: true
    });
    
    // Подгружаем блок пароля
    loadBlock('pages/usersData/password', 'passwordBlockContainer');
}

// Удаление пользователя
async function deleteUser() {
    const selectedUserId = Number(userSelect.value);

    // Проверяем, что пользователь выбран
    if (!selectedUserId) {
        alert("Выберите пользователя");
        return;
    }

    // Подтверждаем удаление пользователя
    const isConfirmed = confirm(`Удалить пользователя "${currentUser?.username ?? ""}"?`);
    if (!isConfirmed) {
        return;
    }

    try {
        const result = await apiProtected(`/api/auth/users/admin/${selectedUserId}`, {
            method: "DELETE"
        });

        // Проверяем успешный ответ
        if (result?.status !== "ok") {
            alert("Ошибка удаления пользователя");
            return;
        }

        alert("Пользователь удален");
        await loadUsers();
    } catch (e) {
        console.error("Ошибка удаления пользователя:", e);
        alert("Ошибка удаления пользователя");
    }
}



// Загрузка данных
userSelect.addEventListener("change", loadSelectedUser);

// Режим редактирования
btnEditUser.addEventListener("click", enableEditMode);
btnCancelUser.addEventListener("click", cancelEditMode);

// Изменение данных пользователя
userRolesInput.addEventListener("change", addRoleToEdit);

// Глобальные действия с пользователем
btnSaveUser.addEventListener("click", saveUserData);
btnDeleteUser.addEventListener("click", deleteUser);
btnEditUser.addEventListener("click", showPasswordForm);

// Автозагрузка списка пользователей
loadUsers();
userSelect.addEventListener("mousedown", () => loadUsers());
