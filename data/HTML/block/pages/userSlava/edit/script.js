users_list.onchange = (e) => getUserData(e.target.value);
async function getUserData(username) {
    const data = await apiProtected(
        `/api/users/getUserData?username=${encodeURIComponent(username)}&by=name`
    );

    ud_id.value = data.ID;
    ud_username.value = data.Username;
}

btn_load_users.onclick = getUsersNames;
document.addEventListener("DOMContentLoaded", getUsersNames);
async function getUsersNames() {
    const users = await apiProtected("/api/users/getUsersNames");

    users_list.innerHTML = "";
    users.forEach((username) => {
        const opt = document.createElement("option");
        opt.value = username;
        opt.textContent = username;
        users_list.appendChild(opt);
    });

    if (users.length > 0) getUserData(users[0]);
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