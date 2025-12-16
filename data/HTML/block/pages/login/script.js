async function initUser() {
    try {
        // Если нет токена, делаем refresh
        if (!accessToken) {
            await refreshAccess ();
        }
        // Проверяем, получили ли токен
        if (!accessToken) throw new Error("no token");
        // выводим имя пользователя
        user_info.textContent = `Вы зашли как: ${user.name}`;
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

logout_btn.onclick = async function () {
  const user = await getUserDataByID(3);
  alert(user.name);
};