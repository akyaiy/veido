// Главные контейнеры
const activateBlock = document.getElementById("activateBlock");
const passwordBlockContainer = document.getElementById("passwordBlockContainer");
const userRolesContainer = document.getElementById("userRolesContainer");

// Список пользователей
const userSelect = document.getElementById("userSelect");
const userSelectChoice = document.getElementById("userSelectChoice");

// Данные всех пользователей
let allRoles = [];

// Режим редактирования
let isEditMode = false;

// Данные пользователя
const userId = document.getElementById("userId");
const username = document.getElementById("username");
const usernameInput = document.getElementById("usernameInput");
const userStatus = document.getElementById("userStatus");
const userStatusInputContainer = document.getElementById("userStatusInputContainer");
const userStatusInput = document.getElementById("userStatusInput");
const userStatusInputChoice = document.getElementById("userStatusInputChoice");
const userRoles = document.getElementById("userRoles");
const userRolesAdd = document.getElementById("userRolesAdd");
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
            const option = document.createElement("div");
            option.dataset.value = user.id;
            option.textContent = `${user.username} (${user.status})`;

            option.onclick = () => {
                userSelectChoice.dataset.value = user.id;
                userSelectChoice.textContent = option.textContent;
                loadSelectedUser();
                userSelect.classList.remove("open");
            };

            userSelect.appendChild(option);
        });

        // Если список не пустой - выбираем нужного пользователя
        if (users.length > 0) {
            // Проверяем, что выбранный пользователь есть в новом списке
            const hasSelectedUser = users.some(user => Number(user.id) === Number(selectedUserId));
            userSelectChoice.dataset.value = hasSelectedUser ? String(selectedUserId) : String(users[0].id);

            // отображаем выбранного пользователь есть в списке
            const selected = hasSelectedUser ? selectedUserId : users[0].id;
            const selectedUser = users.find(u => Number(u.id) === Number(selected));
            if (selectedUser) userSelectChoice.textContent = `${selectedUser.username} (${selectedUser.status})`;

            await loadSelectedUser();
        } else {
            fillUserData();
        }
    } catch (e) {
        console.error("Ошибка загрузки пользователей:", e);
        window.tempStore.messageAPI.showUsersDataMessage("Ошибка загрузки списка пользователей", "error");
    }
}

// Загрузка данных выбранного пользователя
async function loadSelectedUser() {
    const selectedUserId = Number(userSelectChoice.dataset.value);

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
        window.tempStore.messageAPI.showUsersDataMessage("Ошибка загрузки данных пользователя", "error");
    }
}

// Заполнение блока данных пользователя
function fillUserData(data = null, roles = []) {
    currentUser = data;
    currentUserRoles = roles;
    editedRoleIds = roles.map(role => Number(role.id));

    // Отключаем режим редактирования при перерисовке
    setEditMode(false);
    passwordBlockContainer.innerHTML = "";

    // Заполняем основные поля
    userId.textContent = data?.id ?? "-";
    username.textContent = data?.username ?? "-";
    usernameInput.value = data?.username ?? "";
    userStatus.textContent = data?.status ?? "-";
    userStatusInputChoice.dataset.value = data?.status ?? "inactive";
    userStatusInputChoice.textContent = data?.status ?? "-";

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
        roleName.textContent = role.name;
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
        window.tempStore.messageAPI.showUsersDataMessage("Ошибка загрузки списка ролей", "error");
    }
}

// Заполняем список ролей для добавления
function renderAvailableRoles() {
    userRolesInput.innerHTML = "";

    allRoles
        .filter(role => !editedRoleIds.includes(Number(role.id)))
        .forEach(role => {
            const div = document.createElement("div");
            div.dataset.roleId = role.id;
            div.textContent = role.name;
            userRolesInput.appendChild(div);
        });
}



// === Редактирование данных пользователя ===

// Включение и выключение режима редактирования
function setEditMode(enabled) {
    isEditMode = Boolean(enabled);

    // Переключаем отображение редактируемых полей
    username.style.display = isEditMode ? "none" : "inline";
    userRolesAdd.style.display = isEditMode ? "inline-block" : "none";
    usernameInput.style.display = isEditMode ? "inline-block" : "none";
    userStatus.style.display = isEditMode ? "none" : "inline";
    userStatusInputContainer.style.display = isEditMode ? "inline-block" : "none";
    userRolesInput.style.display = "none";
    btnEditUser.style.display = isEditMode ? "none" : "inline-block";
    btnDeleteUser.style.display = isEditMode ? "inline-block" : "none";
    btnSaveUser.style.display = isEditMode ? "inline-block" : "none";
    btnCancelUser.style.display = isEditMode ? "inline-block" : "none";

    // Блокируем верхнее управление во время редактирования
    activateBlock.style.display = isEditMode ? "none" : "";

    // Перерисовываем роли после смены режима
    renderUserRoles();
    renderAvailableRoles();

    // Загружаем статусы пользователей
    loadStatuses("userStatusInput", userStatus.textContent);
}

// Отмена редактирования пользователя
function cancelEditMode() {
    if (passwordBlockContainer?.children.length > 0) {
        passwordBlockContainer.innerHTML = "";
    }

    // Возвращаем исходные значения пользователя
    editedRoleIds = currentUserRoles.map(role => Number(role.id));
    usernameInput.value = currentUser?.username ?? "";
    userStatusInputChoice.textContent = currentUser?.status ?? "-";
    setEditMode(false);
    // Очищаем контейнер пароля
    passwordBlockContainer.innerHTML = "";
    userRolesInput.style.display = "none";
}

// Переход в режим редактирования
async function enableEditMode() {
    // Проверяем, что данные пользователя загружены
    if (!currentUser) {
        window.tempStore.messageAPI.showUsersDataMessage("Выберите пользователя", "error");
        return;
    }

    // Загружаем список ролей перед редактированием
    await loadAllRoles();

    // Заполняем поля текущими значениями
    usernameInput.value = currentUser.username ?? "";
    userStatusInputChoice.textContent = currentUser.status ?? "-";
    editedRoleIds = currentUserRoles.map(role => Number(role.id));
    setEditMode(true);
}

// Добавляем роль в список редактирования
function addRoleToEdit(roleId) {
    roleId = Number(roleId);

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
    userRolesInput.style.display = "none";
}

// Удаляем роль из списка редактирования
function removeRoleFromEdit(roleId) {
    editedRoleIds = editedRoleIds.filter(id => Number(id) !== Number(roleId));
    renderUserRoles();
    renderAvailableRoles();
}

// Проверка, что форма пароля пустая
function isEmptyPasswordBlock() {
    const inputs = passwordBlockContainer.querySelectorAll("input");
    return Array.from(inputs).every(input => !input.value.trim());
}

// Загрузка статусов пользователей
function loadStatuses(containerId, value = null) {
    const element = document.getElementById(containerId);
    element.innerHTML = "";

    // Получаем список статусов пользователей из глобальной переменной
    const userStatuses = [...window.userStatuses];

    // если value не входит в список — добавляем первым
    if (value && !userStatuses.includes(value)) {
        userStatuses.unshift(value);
    }

    userStatuses.forEach(status => {
        const option = document.createElement("div");

        // Устанавливаем значение и текст для каждого статуса
        option.value = status;
        option.textContent = status;

        // Обработчик клика для выбора статуса
        option.onclick = () => {
            userStatusInputChoice.dataset.value = status;
            userStatusInputChoice.textContent = status;
            userStatusInput.classList.remove("open");
        };

        element.appendChild(option);
    });

    // Устанавливаем переданное значение, если оно есть
    element.value = value;
}



// === Глобальные действия с пользователем ===

// Сохранение данных пользователя
async function saveUserData() {
    if (passwordBlockContainer?.children.length > 0 && !isEmptyPasswordBlock()) {
        return;
    }

    if (passwordBlockContainer?.children.length > 0 && isEmptyPasswordBlock()) {
        btnSaveUser._skipPasswordSubmitOnce = true;
    }

    const selectedUserId = Number(userSelectChoice.dataset.value);
    const nextUsername = usernameInput.value.trim();
    const nextStatus = userStatusInputChoice.dataset.value;
    const currentRoleIds = currentUserRoles.map(role => Number(role.id));
    const rolesToAdd = editedRoleIds.filter(roleId => !currentRoleIds.includes(roleId));
    const rolesToRemove = currentRoleIds.filter(roleId => !editedRoleIds.includes(roleId));

    // Проверяем, что пользователь выбран
    if (!selectedUserId) {
        window.tempStore.messageAPI.showUsersDataMessage("Выберите пользователя", "error");
        return;
    }

    // Проверяем, что имя заполнено
    if (!nextUsername) {
        window.tempStore.messageAPI.showUsersDataMessage("Введите имя пользователя", "error");
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
        passwordBlockContainer.innerHTML = "";
        return;
    }

    // Подтверждаем сохранение изменений
    const isConfirmed = await window.tempStore.messageAPI.confirmUsersDataMessage("Сохранить изменения пользователя?");
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
                window.tempStore.messageAPI.showUsersDataMessage("Ошибка сохранения данных пользователя", "error");
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
        window.tempStore.messageAPI.showUsersDataMessage("Данные пользователя сохранены", "success");
        await loadUsers(selectedUserId);
    } catch (e) {
        console.error("Ошибка сохранения данных пользователя:", e);
        window.tempStore.messageAPI.showUsersDataMessage("Ошибка сохранения данных пользователя", "error");
    }
}

// Открыть форму смены пароля
async function showPasswordForm() {
    // Сохраняем контекст для подгруженного блока
    await window.tempStore.store({
        passwordMode: "admin",
        userId: Number(userSelectChoice.dataset.value),
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

// Удаление пользователя
async function deleteUser() {
    const selectedUserId = Number(userSelectChoice.dataset.value);

    // Проверяем, что пользователь выбран
    if (!selectedUserId) {
        window.tempStore.messageAPI.showUsersDataMessage("Выберите пользователя", "error");
        return;
    }

    // Подтверждаем удаление пользователя
    const isConfirmed = await window.tempStore.messageAPI.confirmUsersDataMessage(`Удалить пользователя "${currentUser?.username ?? ""}"?`);
    if (!isConfirmed) {
        return;
    }

    try {
        const result = await apiProtected(`/api/auth/users/admin/${selectedUserId}`, {
            method: "DELETE"
        });

        // Проверяем успешный ответ
        if (result?.status !== "ok") {
            window.tempStore.messageAPI.showUsersDataMessage("Ошибка удаления пользователя", "error");
            return;
        }

        window.tempStore.messageAPI.showUsersDataMessage("Пользователь удален", "success");
        await loadUsers();
    } catch (e) {
        console.error("Ошибка удаления пользователя:", e);
        window.tempStore.messageAPI.showUsersDataMessage("Ошибка удаления пользователя", "error");
    }
}



// === Действия с выбором ролей ===

// Открытие и закрытие списка ролей для добавления
function toggleUserRolesInput(e) {
    e.stopPropagation();

    if (!isEditMode) {
        return;
    }

    userRolesInput.style.display =
        userRolesInput.style.display === "block" ? "none" : "block";
}

// Выбор роли для добавления
function handleUserRolesInputClick(e) {
    const roleItem = e.target.closest("[data-role-id]");
    if (!roleItem) {
        return;
    }

    addRoleToEdit(roleItem.dataset.roleId);
}

// Скрытие списка ролей при клике вне его
function handleDocumentClick(e) {
    if (!userRolesContainer.contains(e.target)) {
        userRolesInput.style.display = "none";
    }
}



// === Функии для кастомного списка с выбором ===

// открыть/закрыть список
function toggleSelect(listId) {
    const list = document.getElementById(listId);
    list.style.display = list.style.display === "block" ? "none" : "block";
}

// выбрать значение
function setSelectValue(choiceId, listId, value, text) {
    const choice = document.getElementById(choiceId);
    const list = document.getElementById(listId);

    choice.dataset.value = value;
    choice.textContent = text;

    list.style.display = "none";
}

// Скрытие списка при клике вне его
document.addEventListener("click", function (e) {
    document.querySelectorAll(".selectContainer").forEach(container => {
        if (!container.contains(e.target)) {
            const list = container.querySelector(".selectList");
            if (list) {
                list.classList.remove("open");
            }
        }
    });
});



// Загрузка данных
userSelect.addEventListener("click", loadSelectedUser);

// Режим редактирования
btnEditUser.addEventListener("click", enableEditMode);
btnCancelUser.addEventListener("click", cancelEditMode);

// Действия с ролями
userRolesAdd.addEventListener("click", toggleUserRolesInput);
userRolesInput.addEventListener("click", handleUserRolesInputClick);
document.addEventListener("click", handleDocumentClick);

// Глобальные действия с пользователем
btnSaveUser.addEventListener("click", saveUserData);
btnDeleteUser.addEventListener("click", deleteUser);
btnEditUser.addEventListener("click", showPasswordForm);

// Автозагрузка списка пользователей
loadUsers();
userSelectChoice.addEventListener("click", () => loadUsers());

// Открытие и закрытие списков
userSelectChoice.addEventListener("click", () => {
    userSelect.classList.toggle("open");
});
userStatusInputChoice.addEventListener("click", () => {
    userStatusInput.classList.toggle("open");
});