const api = (url, data, m) => fetch(url, {
method: m,
headers: { "Content-Type": "application/json" },
body: JSON.stringify(data)
}).then(r => r.text());




function createRole() {
api('/api/acl-admin/create-role', { name: roleName.value }, "POST").then(alert);
}
function createPerm() {
api('/api/acl-admin/create-permission', { name: permKey.value }, "POST").then(alert);
}
function assignPermission() {
api('/api/acl-admin/assign-permission', {
role_id: Number(roleIdPerm.value),
perm_id: Number(permIdRole.value)
}, "POST").then(alert);
}
function assignRole() {
api('/api/acl-admin/assign-role', {
role_id: Number(roleIdUser.value),
user_id: Number(userIdRole.value)
}, "POST").then(alert);
}