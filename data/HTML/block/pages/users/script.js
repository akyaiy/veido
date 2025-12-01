let accessToken = null; // Храним в памяти, НЕ в localStorage

/***********************************************************************
 * Асинхронная функция для получения SHA-256 хеша в hex
 **********************************************************************/
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/***********************************************************************
 *  РЕГИСТРАЦИЯ
 **********************************************************************/
btn_reg.onclick = async () => {
//document.getElementById("btn_reg").onclick = async () => {
    try {
        const response = await sendRequest("/api/user/register", {
            method: "POST",
            body: {
                 username: reg_user.value,
                 password: await hashPassword(reg_pass.value)
//                username,
//                password
            }
        });

        if (response.ok) {
            // alert("Регистрация успешна!");
            // Можно перенаправить пользователя или очистить форму
        } else {
            //alert("Ошибка регистрации: " + (response.data?.message || response.status));
        }
    } catch (err) {
        //alert("Сетевая ошибка: " + err);
    }
};

/***********************************************************************
 *  ЛОГИН
 *
 *  После логина сервер:
 *   - отдаёт access-token в JSON
 *   - ставит refresh-token cookie (HttpOnly)
 **********************************************************************/
btn_log.onclick = async () => {
    try {
        const response = await sendRequest("/api/user/login", {
            method: "POST",
            body: {
                username: log_user.value,
                password: await hashPassword(log_pass.value)
            }
        });
        accessToken = response.data.access_token;  // сохраняем access-token в память
//        console.log(accessToken);
        updateUI();


    } catch (err) {
        alert("Login failed");
    }
};


/***********************************************************************
 *  ЗАЩИЩЁННЫЙ ЗАПРОС (кнопка "Проверить доступ")
 **********************************************************************/
btn_prot.onclick = async () => {
    try {
        const result = await fetchProtected();
        out.textContent = JSON.stringify(result, null, 2);
    } catch (err) {
        out.textContent = "err";
    }
};


async function fetchProtected() {
    //let access = localStorage.access;

    // 1️⃣ Делаем запрос к защищённому эндпоинту
    let res = await sendRequest("/api/protected", {
        headers: {
            Authorization: "Bearer " + accessToken
        }
    });

    // 2️⃣ Если токен протух — пытаемся обновить
    if (res.status === 401) {
        const refresh = localStorage.refresh;

        const refreshRes = await sendRequest("/api/user/refresh", {
            method: "POST",
            credentials: "include"
        });

        // Если refresh токен тоже протух — отдаём ошибку
        if (!refreshRes.ok) {
            return refreshRes;
        }

        // Сохраняем новые токены
        accessToken = refreshRes.data.access_token;

        // 3️⃣ Повторяем оригинальный запрос c новым access-токеном
        res = await sendRequest("/api/protected", {
            headers: {
                Authorization: "Bearer " + refreshRes.data.access_token
            }
        });
    }

    return res.data;
}



/***********************************************************************
 *  ЛОГАУТ
 *
 *  Сервер должен удалить refresh-cookie.
 **********************************************************************/
btn_logout.onclick = async () => {
    try {
        await sendRequest("/api/user/refresh/logout", { method: "POST" });
    } catch (err) {
        // Даже если сервер вернул ошибку — мы всё равно "выходим" локально
    }

    accessToken = null;   // очищаем access-token из памяти
    updateUI();
};

/***********************************************************************
 *  UI-ОБНОВЛЕНИЕ (переключает режимы login/logout)
 **********************************************************************/
function updateUI() {
//    console.log("accessToken:"+accessToken)
protected_section.style.display = accessToken ? "block" : "none";
    // // Показываем кнопку Logout если залогинен
    // document.getElementById("btn_logout").style.display =
    //     accessToken ? "block" : "none";

    // // Прячем поля ввода если залогинен
    // document.getElementById("log_user").style.display =
    //     accessToken ? "none" : "block";

    // document.getElementById("log_pass").style.display =
    //     accessToken ? "none" : "block";

    // document.getElementById("btn_log").style.display =
    //     accessToken ? "none" : "block";

    // Если поле out ранее содержало текст → обновить данные
    if (document.getElementById("out").textContent !== "") {
        document.getElementById("btn_prot").click();
    }
}

function pageInit() {
    console.log("accessToken");
    updateUI()
}