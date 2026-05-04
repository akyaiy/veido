async function initUser() {
    try {
        // Если нет токена, делаем refresh
        if (!accessToken) {
            await refreshAccess();
        }
        // Проверяем, получили ли токен
        if (!accessToken) throw new Error("no token");
        // Если имя не установлено, загружаем данные текущего пользователя
        if (!user.name) {
            const userData = await apiProtected("/api/auth/me", { method: "GET" });
            user.name = userData?.data?.username;
            user.id = userData?.data?.id;
        }
        // выводим имя пользователя
        user_info.innerHTML = `Вы зашли как: ${user.name}. </br> Ваш ID:${user.id}`;
        // Показываем блок пользователя
        showUser()
    } catch (e) {
        // Показываем блок логина
        showLogin()
        console.error(e);
    }
}


function showLogin() {
    login_block.classList.remove("hiden_block");
    user_block.classList.add("hiden_block");
}

function showUser() {
    login_block.classList.add("hiden_block");
    user_block.classList.remove("hiden_block");
}
initUser();

/* --------------------------- Логин ------------------------------- */

async function onLoginClick() {
    try {
        const { accessToken: token } = await userLogin(
            username.value.trim(),
            password.value
        );

        accessToken = token;
        // UIComponents.showAlert("Вы успешно вошли как "+user.name+".</br> Ваш ID:"+user.id);

        username.value = "";
        password.value = "";

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
    initUser();
}

/* ------------------- Кнопки ------------------- */
logout_btn.onclick = async () => {
    await userLogout();   // вызываем существующую функцию
    initUser();           // делаем своё
};
login_btn.onclick = onLoginClick;