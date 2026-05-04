
// Обработка выбора (e.target.value теперь содержит ID пользователя)
users_list.onchange = (e) => getUserData(e.target.value);
// Запрос данных конкретного пользователя по ID
async function getUserData(userId) {
    if (!userId) return;
    const response = await apiProtected(`/api/auth/users/admin/${userId}`, { method: "GET" });
    const data = response?.data || {};
    ud_id.value = data.id;
    ud_username.value = data.username;
}

btn_load_users.onclick = getUsersNames;
document.addEventListener("DOMContentLoaded", getUsersNames);
// Заполнение списка
async function getUsersNames() {
    const response = await apiProtected("/api/auth/users/admin?limit=100");
    const users = response?.data || [];
    users_list.innerHTML = "";
    users.forEach((user) => {
        const opt = document.createElement("option");
        // В значение value записываем ID пользователя
        opt.value = user.id; 
        // В текст (то, что видит пользователь) записываем имя
        opt.textContent = user.username; 
        users_list.appendChild(opt);
    });
    // Загружаем данные первого пользователя
    if (users.length > 0) {
        getUserData(users[0].id); 
    }
}


btn_update_pass.onclick = updatePassword;
async function updatePassword() {
    const userId = ud_id.value;
    const newPassword = ud_password.value;

    if (!newPassword) return alert("Введите новый пароль");
    if (!userId) return alert("Выберите пользователя");

    await apiProtected(`/api/auth/users/admin/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({
            newPassword: newPassword 
        })
    });

    alert("Пароль обновлён");
}

btn_delete_user.onclick = deleteUser;
async function deleteUser() {
    const userId = users_list.value;
    const username = ud_username.value;
    if (!userId) return;

    if (!confirm(`Удалить пользователя "${username}"?`)) return;

    await apiProtected(`/api/auth/users/admin/${userId}`, {
        method: "DELETE"
    });

    alert("Удалён");
    getUsersNames();
}