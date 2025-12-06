users_list.onchange = (e) => getUserData(e.target.value);
async function getUserData(username) {
    const data = await apiProtected(
        `/api/users/getUserData?username=${encodeURIComponent(username)}`
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
        method: "POST",
        body: JSON.stringify({ username })
    });

    alert("Удалён");
    getUsersNames();
}


document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-pass")) return;

    const input = e.target.previousElementSibling;
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        e.target.textContent = "🙈";
    } else {
        input.type = "password";
        e.target.textContent = "👁";
    }
});