btn_logout.onclick = UserLogout;
btn_log.onclick = UserLogin;

btn_prot.onclick = async () => {
    try {
        const data = await apiProtected("/api/protected");
        out.textContent = JSON.stringify(data, null, 2);
    } catch {
        out.textContent = "err";
    }
};

async function UserLogout() {
    accessToken = "";
    await fetch("/api/users/logout", { method: "POST", credentials: "include" });
};

async function UserLogin() {
    const u = log_user.value,
        p = log_pass.value;

    const r = await fetch("/api/users/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
    });

    if (!r.ok) return alert("Ошибка");

    const data = await r.json();
    accessToken = data.access_token;
    alert("logged in");
    log_user.value = "",
    log_pass.value = "";

};


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