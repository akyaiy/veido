async function initUser() {
    try {
        if (!accessToken) {
            await refreshAccess();
        }

        if (!accessToken) {
            showLogin();
            return;
        }

        user_info.innerHTML = `Вы зашли как: ${user.name}. </br> Ваш ID:${user.id}`;
        showUser();
    } catch (e) {
        showLogin();
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
        await location.reload();
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
    await initUser();
}

/* ------------------- Кнопки ------------------- */
logout_btn.onclick = async () => {
    try {
        await userLogout();
    } catch (e) {
        console.error("Logout error:", e);
    } finally {
        accessToken = "";
        user.name = "";
        user.id = "";
        showLogin();
    }
};
login_btn.onclick = onLoginClick;
document.onkeydown = (e) => { (e.key === 'Enter') && onLoginClick(); };