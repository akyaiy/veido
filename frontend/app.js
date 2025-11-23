let accessToken = ""; // теперь access хранится только здесь

async function api(p, o = {}) {
    const r = await fetch(p, o);
    if (!r.ok) throw await r.text();
    const t = await r.text();
    try { return JSON.parse(t); } catch { return t; }
}

/* ------------------- Регистрация ------------------- */

document.getElementById('btn_reg').onclick = async () => {
    const u = reg_user.value, p = reg_pass.value;
    try {
        await api('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        alert('ok');
        await getUsersNames();
    } catch (e) { alert('err'); }
};

/* ------------------- Логин ------------------- */

document.getElementById('btn_log').onclick = async () => {
    const u = log_user.value, p = log_pass.value;

    const r = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
        credentials: "include"
    });

    accessToken = r.access_token; // access только в памяти
    alert('logged in');
};

/* ------------------- Protected с авто-refresh ------------------- */

async function fetchProt() {

    let r = await fetch('/api/protected', {
        headers: { Authorization: 'Bearer ' + accessToken }
    });

    if (r.status === 401) {
        // получаем новый access по refresh-cookie
        const rr = await api('/api/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: "include"
        });

        accessToken = rr.access_token;

        r = await fetch('/api/protected', {
            headers: { Authorization: 'Bearer ' + accessToken }
        });
    }

    return r.json();
}

/* ------------------- Загрузка списка имён ------------------- */

async function getUsersNames() {
    try {
        const users = await api('/api/getUserNames');

        const select = users_list;
        select.innerHTML = '';

        users.forEach(username => {
            const opt = document.createElement('option');
            opt.value = username;
            opt.textContent = username;
            select.appendChild(opt);
        });

        // Автозагрузка данных первого пользователя
        if (users.length > 0) {
            getUserData(users[0]);
        }

    } catch (e) {
        alert('Ошибка загрузки пользователей');
    }
}

/* ------------------- Загрузка данных пользователя ------------------- */

async function getUserData(username) {
    try {
        const data = await api(`/api/getUserData?username=${encodeURIComponent(username)}`);

        // Нормализуем ключи, приводим к нижнему регистру
        const keys = Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k.toLowerCase(), v])
        );

        ud_id.value = keys.id ?? "";
        ud_username.value = keys.username ?? username;

    } catch (e) {
        ud_id.value = "";
        ud_username.value = "";
    }
}

/* ------------------- Обновление пароля ------------------- */

async function updatePassword() {
    const username = ud_username.value;
    const password = ud_password.value;
    if (!password) return alert("Введите новый пароль");
    try {
        await api('/api/update_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        alert("Пароль обновлён!");
    } catch (e) { alert("Ошибка обновления пароля"); }
}

/* ------------------- Удаление пользователя ------------------- */

async function deleteUser() {
    const username = users_list.value;
    if (!username) return alert("Выберите пользователя");
    if (!confirm(`Удалить пользователя "${username}"?`)) return;

    try {
        await api('/api/delete_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        alert("Пользователь удалён!");
        await getUsersNames();
    } catch (e) { alert("Ошибка удаления пользователя"); }
}

/* ------------------- Переключение видимости пароля ------------------- */

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

/* ------------------- Системные обработчики ------------------- */

btn_delete_user.onclick = deleteUser;
btn_update_pass.onclick = updatePassword;

document.addEventListener('DOMContentLoaded', getUsersNames);

users_list.onchange = (e) => {
    const username = e.target.value;
    if (username) getUserData(username);
};

btn_load_users.onclick = getUsersNames;

btn_prot.onclick = async () => {
    try {
        out.textContent = JSON.stringify(await fetchProt(), null, 2);
    } catch {
        out.textContent = 'err';
    }
};

btn_logout.onclick = async () => {
    accessToken = "";
    await fetch('/api/logout', {
        method: "POST",
        credentials: "include"
    });
};
