const userSelect = document.getElementById("userSelect");
const btnActivateUser = document.getElementById("btnActivateUser");
const btnInactivateUser = document.getElementById("btnInactivateUser");

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
            option.textContent = `${user.username} (${user.status})`;
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

// Активировать пользователя
async function statusUser(status, successMessage) {
    const userId = Number(userSelect.value);

    // Проверяем, что пользователь выбран
    if (!userId) {
        alert("Выберите пользователя");
        return;
    }

    try {
        // Отправляем запрос на активацию (изменение статуса)
        const result = await apiProtected(`/api/auth/users/admin/${userId}`, {
            method: "PATCH",
            body: {
                status: status
            }
        });

        // Проверяем успешный ответ
        if (result?.status === "ok") {
            alert(successMessage);

            // Обновляем список после создания
            await loadUsers();
        } else {
            alert("Ошибка изменения статуса пользователя");
        }
    } catch (e) {
        console.error("Ошибка изменения статуса:", e);
        alert("Ошибка изменения статуса пользователя");
    }
}

// Обработчики
btnActivateUser.addEventListener("click", () => statusUser("active", "Пользователь активирован"));
btnInactivateUser.addEventListener("click", () => statusUser("inactive", "Пользователь деактивирован"));

// Автозагрузка
loadUsers();
userSelect.addEventListener("mousedown", loadUsers);