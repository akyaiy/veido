let accessToken = "";

// привязка к форме
const loginForm = document.querySelector("form[action='/login']");
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // предотвращаем обычную отправку формы
    await UserLogin();
});

async function UserLogin() {
    const u = document.getElementById("username").value;
    const p = document.getElementById("password").value;

    try {
        const r = await fetch("/api/users/login", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u, password: p })
        });

        if (!r.ok) throw new Error("Ошибка входа");

        const data = await r.json();
        accessToken = data.access_token;
        alert("logged in");

        document.getElementById("username").value = "";
        document.getElementById("password").value = "";
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

async function UserLogout() {
    try {
        await fetch("/api/users/logout", { method: "POST", credentials: "include" });
        accessToken = "";
        alert("logged out");
    } catch (err) {
        console.error(err);
        alert("Ошибка выхода");
    }
}

// пример Protected запроса
async function getProtected() {
    try {
        const data = await apiProtected("/api/protected");
        console.log(data);
    } catch {
        console.log("err");
    }
}

// toggle password
document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-pass")) return;

    const input = e.target.previousElementSibling;
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        e.target.textContent = "🙈";
    } else {
        input.type = "password";
        e.target.textContent = "👁";
    }
});
