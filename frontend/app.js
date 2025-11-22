async function api(p, o = {}) {
    const r = await fetch(p, o);if (!r.ok) {const err = await r.text();throw err;}
    const text = await r.text();if (!text) return null;
    try {return JSON.parse(text);} catch {return text;}}

document.getElementById('btn_reg').onclick=async()=>{
 const u=reg_user.value,p=reg_pass.value
 try{
    await api('/api/register',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:u,password:p})});alert('ok')}
 catch(e){alert('err')} getUsersNames();}

document.getElementById('btn_log').onclick=async()=>{
 const u=log_user.value,p=log_pass.value
 const r=
    await api('/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:u,password:p})})
 localStorage.access=r.access_token;localStorage.refresh=r.refresh_token; alert('logged in')}

async function fetchProt(){
 let a=localStorage.access
 let r=
    await fetch('/api/protected',{
        headers:{Authorization:'Bearer '+a}})
 if(r.status===401){
  const rf=localStorage.refresh
  const rr=
    await api('/api/refresh',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:rf})})
  localStorage.access=rr.access_token;localStorage.refresh=rr.refresh_token
  r=
    await fetch('/api/protected',{
        headers:{Authorization:'Bearer '+rr.access_token}})}return r.json()}

async function getUsersNames() {
  try {const users = 
        await api('/api/getUserNames');const select = document.getElementById('users_list');
    select.innerHTML = '';
    users.forEach(u => {const opt = document.createElement('option');
      opt.value = u;opt.textContent = u;select.appendChild(opt);});
  } catch (e) {alert('Ошибка загрузки пользователей');}}

async function getUserData(username) {
  try {const data = 
    await api(`/api/getUserData?username=${encodeURIComponent(username)}`);
    document.getElementById('ud_id').value = data.id ?? "";
    document.getElementById('ud_username').value = data.username ?? "";
  } catch (e) {document.getElementById('ud_id').value = "";document.getElementById('ud_username').value = "";}}

async function updatePassword() {
  const username = document.getElementById('ud_username').value;
  const password = document.getElementById('ud_password').value;
  if (!password) return alert("Введите новый пароль");
  try {
    await api('/api/update_password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })});
      alert("Пароль обновлён!");
  } catch (e) {alert("Ошибка обновления пароля");}}

async function deleteUser() {
    const username = document.getElementById("users_list").value;
    if (!username) return alert("Выберите пользователя");
    if (!confirm(`Удалить пользователя "${username}"?`)) return;
    try {await 
        api('/api/delete_user', {
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          body: JSON.stringify({ username })});
        alert("Пользователь удалён!");await getUsersNames(); // обновить список
    } catch (e) {alert("Ошибка удаления пользователя");}}

document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("toggle-pass")) return;
    const input = e.target.previousElementSibling;
    if (!input || input.tagName !== "INPUT") return;
    if (input.type === "password") {input.type = "text";e.target.textContent = "🙈";
    } else {input.type = "password";e.target.textContent = "👁";}});

btn_delete_user.onclick = deleteUser;
btn_update_pass.onclick = updatePassword;
document.addEventListener('DOMContentLoaded', getUsersNames);
users_list.onchange = (e) => {const username = e.target.value;if (username) {getUserData(username);}};
btn_load_users.onclick = getUsersNames;
btn_load_users.onclick = getUsersNames;
btn_prot.onclick=async()=>{try{out.textContent=JSON.stringify(await fetchProt(),null,2)}catch(e){out.textContent='err'}}
btn_logout.onclick=()=>{localStorage.clear()}
