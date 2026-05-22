// Поля для нового пользователя
const newUserName = document.getElementById("newUserName");
const newUserPassword = document.getElementById("newUserPassword");

// Кнопки действий
const btnCreateUser = document.getElementById("btnCreateUser");

// Создание пользователя
async function createUser() {
    try {
        // Берём значения полей
        const name = newUserName.value.trim();
        const password = newUserPassword.value.trim();

        // Простая проверка
        if (!name || !password) {
            window.showUsersDataMessage("Введите имя и пароль", "error");
            return;
        }

        // Отправляем запрос на создание
        const result = await apiProtected("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: name,
                password: password
            })
        });

        // Проверяем успешный ответ
        if (result?.status === "ok") {
            window.showUsersDataMessage("Пользователь создан", "success");

            // Очищаем поля
            newUserName.value = "";
            newUserPassword.value = "";
        } else {
            window.showUsersDataMessage("Ошибка создания пользователя", "error");
            console.error("Ошибка создания пользователя:", result);
        }
    } catch (e) {
        console.error("Ошибка создания пользователя:", e);
        window.showUsersDataMessage("Ошибка создания пользователя", "error");
    }
}

// Обработчики
btnCreateUser.addEventListener("click", createUser);