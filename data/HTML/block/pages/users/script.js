/* ------------------- Регистрация (не защищена) ------------------- */
async function onRegisterClick() {
    try {
        await userRegister(
            reg_user.value.trim(),
            reg_pass.value
        );

        alert("ok");

        reg_user.value = "";
        reg_pass.value = "";

    } catch (e) {
        switch (e.message) {
            case "USER_EXISTS":
                UIComponents.showAlert("Пользователь уже существует");
                break;
            case "BAD_REQUEST":
                UIComponents.showAlert("Некорректные данные");
                break;
            default:
                UIComponents.showAlert("Ошибка регистрации");
        }
    }
}

/* --------------------------- Логин ------------------------------- */

async function onLoginClick() {
    try {
        const { accessToken: token } = await userLogin(
            log_user.value.trim(),
            log_pass.value
        );

        accessToken = token;
        UIComponents.showAlert("Вы успешно вошли как "+user.name+".</br> Ваш ID:"+user.id);

        log_user.value = "";
        log_pass.value = "";

    } catch (e) {
        switch (e.message) {
            case "INVALID_CREDENTIALS":
                UIComponents.showAlert("Неверный логин или пароль");
                break;
            case "BAD_REQUEST":
                UIComponents.showAlert("Некорректный запрос");
                break;
            default:
                UIComponents.showAlert("Ошибка при логине");
        }
    }
}

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
        `/api/users/getUserData?username=${encodeURIComponent(username)}&by=name`
    );

    ud_id.value = data.ID;
    ud_username.value = data.Username;
}

async function updatePassword() {
    const username = ud_username.value;
    const password = ud_password.value;

    if (!password) return UIComponents.showAlert("Введите пароль");

    await apiProtected("/api/users/update_password", {
        method: "POST",
        body: JSON.stringify({ username, password })
    });

    UIComponents.showAlert("Пароль обновлён");
}

async function deleteUser() {
    const username = users_list.value;
    if (!username) return;

    if (!(await UIComponents.confirm(`Удалить пользователя "${username}"?`))) return;

    await apiProtected("/api/users/delete_user", {
        method: "DELETE",
        body: JSON.stringify({ username })
    });

    UIComponents.showAlert("Удалён");
    getUsersNames();
}



/* ------------------- Кнопки ------------------- */
btn_reg.onclick = onRegisterClick;
btn_logout.onclick = userLogout;
btn_log.onclick = onLoginClick;
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


