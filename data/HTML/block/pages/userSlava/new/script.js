async function UserReg() {
    const u = reg_user.value,
        p = reg_pass.value;

    const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
    });

    if (!r.ok) return alert("Ошибка");
    alert("ok");
    reg_user.value = "",
    reg_pass.value = "";
};
btn_reg.onclick = UserReg;