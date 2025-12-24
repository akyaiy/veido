
// Обработка выбора (теперь e.target.value — это строка-имя)
users_list.onchange = (e) => getUserData(e.target.value);
// Запрос данных (здесь всё верно, если в username пришла строка)
async function getUserData(username) {
    const data = await apiProtected(
        `/api/users/getUserData?username=${encodeURIComponent(username)}&by=name`
    );
    // ВАЖНО: Проверьте регистр букв в ответе (data.id или data.ID)
    ud_id.value = data.id || data.ID; 
    ud_username.value = data.username || data.Username;
}

btn_load_users.onclick = getUsersNames;
document.addEventListener("DOMContentLoaded", getUsersNames);
// Заполнение списка
async function getUsersNames() {
    const users = await apiProtected("/api/users/getUsersNames");
    users_list.innerHTML = "";
    users.forEach((user) => {// переименовали переменную для ясности (теперь это объект user)
        const opt = document.createElement("option");
        // В значение value лучше записывать ID пользователя
        opt.value = user.username; 
        // В текст (то, что видит пользователь) записываем имя
        opt.textContent = user.username; 
        //
        users_list.appendChild(opt);
    });
    // Если в getUserData нужно передавать имя первого пользователя:
    if (users.length > 0) {
        getUserData(users[0].username); 
    }
}


btn_update_pass.onclick = updatePassword;
async function updatePassword() {
    const username = ud_username.value;
    const password = ud_password.value;

    if (!password) return alert("Введите пароль");

    await apiProtected("/api/users/update_password", {
        method: "POST",
        body: JSON.stringify({ username, password })
    });

    alert("Пароль обновлён");
}

btn_delete_user.onclick = deleteUser;
async function deleteUser() {
    const username = users_list.value;
    if (!username) return;

    if (!confirm(`Удалить пользователя "${username}"?`)) return;

    await apiProtected("/api/users/delete_user", {
        method: "Delete",
        body: JSON.stringify({ username })
    });

    alert("Удалён");
    getUsersNames();
}