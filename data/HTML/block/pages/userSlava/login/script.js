btn_logout.onclick = UserLogout;
btn_log.onclick = UserLogin;

btn_prot.onclick = async () => {
    try {
        const data = await fetch("/api/auth/session/refresh", { method: "POST", credentials: "include" });
        out.textContent = JSON.stringify(await data.json(), null, 2);
    } catch {
        out.textContent = "err";
    }
};

async function UserLogout() {
    const data = await fetch("/api/auth/session/refresh", { method: "POST", credentials: "include" });
    const response = await data.json();
    const accessToken = response.data;
    await fetch("/api/auth/session/logout", { method: "POST", body: JSON.stringify({ accessToken })});
};

async function UserLogin() {
    const u = log_user.value,
        p = log_pass.value;

    const r = await fetch("/api/auth/session/login", {
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