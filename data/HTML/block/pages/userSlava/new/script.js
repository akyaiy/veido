async function UserReg() {
    const u = reg_user.value,
        p = reg_pass.value;

    const r = await fetch("/api/users/register", {
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