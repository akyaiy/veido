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
            alert("Введите имя и пароль");
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
            alert("Пользователь создан");

            // Очищаем поля
            newUserName.value = "";
            newUserPassword.value = "";
        } else {
            alert("Ошибка создания пользователя");
            console.error("Ошибка создания пользователя:", result);
        }
    } catch (e) {
        console.error("Ошибка создания пользователя:", e);
        alert("Ошибка создания пользователя");
    }
}

// Обработчики
btnCreateUser.addEventListener("click", createUser);