// Загрузка данных текущего пользователя
async function loadProfile() {
    try {
        // Запрос к API текущего пользователя
        const user = await apiProtected('/api/auth/me', { method: 'GET' });
        if (!user || !user.data) return;
        const data = user.data;

        // Заполнение ID
        document.getElementById("userId").textContent = data.id ?? "-";

        // Заполнение имени
        document.getElementById("username").textContent = data.username ?? "-";

        // Заполнение активного статуса
        let activeText = data.status ?? "-";
        document.getElementById("userActive").textContent = activeText;

        // Запрос к ролям текущего пользователя
        const roles = await apiProtected(`/api/acl-admin/users/${data.id}/roles?limit=100`, { method: 'GET' });

        // Роли (если приходят отдельно — предполагаем массив)
        const rolesEl = document.getElementById("userRoles");
        rolesEl.innerHTML = "";
        if (roles && Array.isArray(roles)) {
            roles.forEach(r => {
                const li = document.createElement("li");
                li.textContent = r.name;
                rolesEl.appendChild(li);
            });
        } else {
            rolesEl.innerHTML = "<li>-</li>";
        }

    } catch (e) {
        console.error("Ошибка загрузки профиля:", e);
    }
}

// Автозагрузка при открытии страницы
loadProfile();