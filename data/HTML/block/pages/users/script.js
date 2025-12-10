/* ------------------- Регистрация (не защищена) ------------------- */

async function UserReg() {
    const u = reg_user.value,
        p = reg_pass.value;

    const r = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
    });

    if (!r.ok) return alert("Ошибка");
    alert("ok");
    reg_user.value = "",
    reg_pass.value = "";
};

/* ------------------- Логин (не защищён) ------------------- */

async function UserLogin() {
    const u = log_user.value,
        p = log_pass.value;

    const r = await fetch("/api/users/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
    });

    if (!r.ok) return alert("Ошибка");

    const data = await r.json();
    accessToken = data.access_token;
    alert("logged in");
    log_user.value = "",
    log_pass.value = "";

};

/* ------------------- Логоут (не защищён) ------------------- */

async function UserLogout() {
    accessToken = "";
    await fetch("/api/users/logout", { method: "POST", credentials: "include" });
};

/* ------------------- Защищённые операции ------------------- */

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

async function getUserData(username) {
    const data = await apiProtected(
        `/api/users/getUserData?username=${encodeURIComponent(username)}`
    );

    ud_id.value = data.ID;
    ud_username.value = data.Username;
}

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



/* ------------------- Кнопки ------------------- */
btn_reg.onclick = UserReg;
btn_logout.onclick = UserLogout;
btn_log.onclick = UserLogin;
btn_delete_user.onclick = deleteUser;
btn_update_pass.onclick = updatePassword;
btn_load_users.onclick = getUsersNames;

users_list.onchange = (e) => getUserData(e.target.value);
btn_prot.onclick = async () => {
    try {
        const data = await apiProtected("/api/protected");
        out.textContent = JSON.stringify(data, null, 2);
    } catch {
        out.textContent = "err";
    }
};

document.addEventListener("DOMContentLoaded", getUsersNames);


