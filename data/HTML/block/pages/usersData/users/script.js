const newUserName = document.getElementById("newUserName");
const newUserPassword = document.getElementById("newUserPassword");
const btnCreateUser = document.getElementById("btnCreateUser");

const userSelect = document.getElementById("userSelect");
const btnActivateUser = document.getElementById("btnActivateUser");

// Загрузка списка пользователей
async function loadUsers() {
    try {
        // Запрашиваем список пользователей
        const response = await apiProtected("/api/auth/users/admin?limit=100", { method: "GET" });
        const users = response?.data || [];

        // Очищаем список
        userSelect.innerHTML = "";

        // Заполняем список пользователей
        users.forEach(user => {
            const option = document.createElement("option");
            option.value = user.id;
            option.textContent = `${user.username}`;
            userSelect.appendChild(option);
        });

        // Если список не пустой - выбираем первого
        if (users.length > 0) {
            userSelect.value = users[0].id;
        }
    } catch (e) {
        console.error("Ошибка загрузки пользователей:", e);
        alert("Ошибка загрузки списка пользователей");
    }
}

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
        } else {
            alert("Ошибка создания пользователя");
            console.error("Ошибка создания пользователя:", result);
        }

        // Обновляем список после создания
        await loadUsers();

        // Очищаем поля
        newUserName.value = "";
        newUserPassword.value = "";
    } catch (e) {
        console.error("Ошибка создания пользователя:", e);
        alert("Ошибка создания пользователя");
    }
}

// Активировать пользователя
async function activateUser() {
    const userId = Number(userSelect.value);

    if (!userId) {
        alert("Выберите пользователя");
        return;
    }

    // Пока только лог, без отправки на сервер
    console.log("Активировать пользователя:", userId);
    alert("Пользователь выбран, активация пока только в console.log");
}

// Обработчики
btnCreateUser.addEventListener("click", createUser);
btnActivateUser.addEventListener("click", activateUser);

// Автозагрузка
loadUsers();
userSelect.addEventListener("mousedown", loadUsers);