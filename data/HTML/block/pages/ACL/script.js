const api = (url, data, m) => fetch(url, {
method: m,
headers: { "Content-Type": "application/json" },
body: JSON.stringify(data)
}).then(r => r.text());


//await apiProtected('/api/acl-admin/roles', { method: 'GET' });

async function createRole() {
await apiProtected('/api/acl-admin/create-role', { name: roleName.value },{ method: 'GET' });
}

async function createPermission() {
  try {
    const result = await apiProtected('/api/acl-admin/create-permission', {
      method: 'POST',
      body: { name: permKey.value }
    });
    alert(result);
  } catch (err) {
    console.error("Ошибка создания разрешения:", err);
  }
}

// function assignPermission() {
// api('/api/acl-admin/assign-permission', {
// role_id: Number(roleIdPerm.value),
// perm_id: Number(permIdRole.value)
// }, "POST").then(alert);
// }
// function assignRole() {
// api('/api/acl-admin/assign-role', {
// role_id: Number(roleIdUser.value),
// user_id: Number(userIdRole.value)
// }, "POST").then(alert);
// }

// /* Загрузка ролей */
// async function loadRoles() {
//   try {
//     const data = await apiProtected('/api/acl-admin/roles', {
//       method: 'GET'
//     });

//     roleSelect.innerHTML = '';
//     data.forEach(r => {
//       const opt = document.createElement('option');
//       opt.value = r.id;
//       opt.textContent = `${r.name}`;
//       roleSelect.appendChild(opt);
//     });

//   } catch (e) {
//     alert('Ошибка загрузки ролей: ' + JSON.stringify(e.data || e));
//   }
// }

// /* Загрузка разрешений */
// async function loadPermissions() {
//   try {
//     const data = await apiProtected('/api/acl-admin/permissions', {
//       method: 'GET'
//     });

//     permSelect.innerHTML = '';
//     data.forEach(p => {
//       const opt = document.createElement('option');
//       opt.value = p.id;
//       opt.textContent = `${p.key}`;
//       permSelect.appendChild(opt);
//     });

//   } catch (e) {
//     alert('Ошибка загрузки разрешений: ' + JSON.stringify(e.data || e));
//   }
// }

// /* Назначение разрешения роли */
// async function assignPermission() {
//   try {
//     const result = await apiProtected('/api/acl-admin/assign-permission', {
//       method: 'POST',
//       body: {
//         role_id: Number(roleSelect.value),
//         perm_id: Number(permSelect.value)
//       }
//     });

//     alert(result);

//   } catch (e) {
//     alert('Ошибка назначения разрешения: ' + JSON.stringify(e.data || e));
//   }
// }

/* Автозагрузка при открытии страницы */
//document.addEventListener('DOMContentLoaded', async () => {
//   //await 
//   loadRoles();
//   //await 
//   loadPermissions();
// //});
let selectedPermId = null;

// Загрузка ролей
async function loadRoles() {
  const roles = await apiProtected('/api/acl-admin/roles', { method: 'GET' });
  roleSelect.innerHTML = '';
  roles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    roleSelect.appendChild(opt);
  });

  // Подгружаем разрешения для первой роли
  if (roles.length > 0) {
    roleSelect.value = roles[0].id;
    loadRolePermissions();
  }
}

// Назначение разрешения роли при выборе из availablePerms
availablePerms.addEventListener('change', async () => {
  const permId = Number(availablePerms.value);
  if (!permId) return;

  const roleId = Number(roleSelect.value);

  try {
    await apiProtected('/api/acl-admin/assign-permission', {
      method: 'POST',
      body: {
        role_id: roleId,
        perm_id: permId
      }
    });

    // после назначения — обновляем данные с сервера
    await loadRolePermissions();        // обновит permTable
    await renderAvailablePermissions(); // обновит availablePerms

  } catch (err) {
    alert('Ошибка назначения разрешения: ' + JSON.stringify(err.data || err));
  }
});


// Загрузка разрешений роли
async function loadRolePermissions() {
  const roleId = Number(roleSelect.value);
  const perms = await apiProtected(`/api/acl-admin/role-permissions?role_id=${roleId}`, { method: 'GET' });
  
  const tbody = document.querySelector('#permTable tbody');
  tbody.innerHTML = '';
  selectedPermId = null;
  btn_remPerm.disabled = true;

  perms.forEach(p => {
    const tr = document.createElement('tr');
    tr.dataset.permId = p.id;
    tr.textContent = p.name;
    tr.addEventListener('click', () => selectRow(tr, p.id));
    tbody.appendChild(tr);
  });
  renderAvailablePermissions();
}

// Выбор строки
function selectRow(tr, permId) {
  document.querySelectorAll('#permTable tr').forEach(r => r.classList.remove('selected'));
  tr.classList.add('selected');
  selectedPermId = permId;
  btn_remPerm.disabled = false;
}

// Удаление разрешения
async function removePermission() {
  if (!selectedPermId) return;

  const roleId = Number(roleSelect.value);

  await apiProtected('/api/acl-admin/remove-permission', {
    method: 'POST',
    body: { role_id: roleId, perm_id: selectedPermId }
  });

  // Обновляем таблицу
  loadRolePermissions();
}

/* ===== Загрузка доступных разрешений ===== */
async function renderAvailablePermissions() {
  const roleId = Number(roleSelect.value);
    try {
        const allPermissions = await apiProtected(
            "/api/acl-admin/permissions",
            { method: "GET" }
        );

        const rolePermissions = await apiProtected(
            `/api/acl-admin/role-permissions?role_id=${roleId}`,
            { method: "GET" }
        );

        const roleIds = new Set(rolePermissions.map(p => p.id));

        const available = allPermissions.filter(p => !roleIds.has(p.id));

        availablePerms.innerHTML = "";

        available.forEach(p => {
            const option = document.createElement("option");
            option.value = p.id;
            option.textContent = p.key;
            availablePerms.appendChild(option);
        });

    // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ
    availablePerms.selectedIndex = -1;
    } catch (err) {
        console.error("Ошибка загрузки доступных разрешений", err);
    }
}


// Обработчики
btn_remPerm.onclick = removePermission;
btn_createPerm.onclick = createPermission;
roleSelect.addEventListener('change', loadRolePermissions);

// Автозагрузка
//document.addEventListener('DOMContentLoaded', loadRoles);
loadRoles();
//renderAvailablePermissions();
