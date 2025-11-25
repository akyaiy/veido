let accessToken = ""; // access только в памяти

async function apiProtected(path, options = {}) {
    const send = async () =>
        fetch(path, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: "Bearer " + accessToken,
                "Content-Type": "application/json"
            }
        });

    let r = await send();

    if (r.status === 401) {
        // обновляем access
        const rr = await fetch("/api/users/refresh", {
            method: "POST",
            credentials: "include"
        });

        if (!rr.ok) throw "refresh failed";

        const j = await rr.json();
        accessToken = j.access_token;

        r = await send();
    }

    if (!r.ok) throw await r.text();
    return r.json();
}

/* ------------------- Регистрация (не защищена) ------------------- */

document.getElementById("btn_reg").onclick = async () => {
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

document.getElementById("btn_log").onclick = async () => {
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

/* ------------------- Защищённые операции ------------------- */

async function getUsersNames() {
    const users = await apiProtected("/api/users/getUserNames");

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

btn_logout.onclick = async () => {
    accessToken = "";
    await fetch("/api/users/refresh/logout", { method: "POST", credentials: "include" });
};

document.addEventListener("DOMContentLoaded", getUsersNames);

/* ------------------- Переключение пароля ------------------- */

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
