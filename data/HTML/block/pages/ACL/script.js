// const api = (url, data, m) => fetch(url, {
// method: m,
// headers: { "Content-Type": "application/json" },
// body: JSON.stringify(data)
// }).then(r => r.text());


//await apiProtected('/api/acl-admin/roles', { method: 'GET' });

// async function createRole() {
// await apiProtected('/api/acl-admin/create-role', { name: roleName.value },{ method: 'GET' });
// }

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

async function createRole() {
  try {
    const result = await apiProtected('/api/acl-admin/create-role', {
      method: 'POST',
      body: { name: roleName.value }
    });
    alert(result);
  } catch (err) {
    console.error("Ошибка создания разрешения:", err);
  }
}

let selectedPermId = null;

// Загрузка ролей
async function loadRoles() {
  const roles = await apiProtected('/api/acl-admin/roles', { method: 'GET' }) || [];
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

// Загрузка пользователей
async function loadUsers() {
    const users = await apiProtected("/api/users/getUsersNames") || [];
    userSelect.innerHTML = '';
    users.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.username;
    userSelect.appendChild(opt);
  });

  // Подгружаем разрешения для первой роли
  if (users.length > 0) {
    userSelect.value = users[0].id;
    loadUserRoles();
  }
}

// Назначение разрешения роли при выборе из availablePerms UIComponents.confirm()
availablePerms.addEventListener('change', async () => {
  const permId = Number(availablePerms.value);
  if (!permId) return;

  const roleId = Number(roleSelect.value);

// показываем подтверждение
  const confirmed = await UIComponents.confirm(
    'Вы уверены, что хотите добавить это разрешение?',
    'Подтверждение'
  );

  if (!confirmed) {
    // сбрасываем выбор, если пользователь отказался
    availablePerms.value = '';
    return;
  }
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
    //await renderAvailablePermissions(); // обновит availablePerms

  } catch (err) {
    alert('Ошибка назначения разрешения: ' + JSON.stringify(err.data || err));
  }
});


// Назначение разрешения роли при выборе из availablePerms UIComponents.confirm()
availableRoles.addEventListener('change', async () => {
  const roleId = Number(availableRoles.value);
  if (!roleId) return;

  const userId = Number(userSelect.value);

// показываем подтверждение
  const confirmed = await UIComponents.confirm(
    'Вы уверены, что хотите добавить эту роль?',
    'Подтверждение'
  );

  if (!confirmed) {
    // сбрасываем выбор, если пользователь отказался
    availableRoles.value = '';
    return;
  }
  try {
    await apiProtected('/api/acl-admin/assign-role', {
      method: 'POST',
      body: {
        user_id: userId,
        role_id: roleId
      }
    });

    // после назначения — обновляем данные с сервера
    await loadUserRoles();        // обновит permTable
    //await renderAvailableRoles(); // обновит availablePerms

  } catch (err) {
    alert('Ошибка назначения разрешения: ' + JSON.stringify(err.data || err));
  }
});


// Загрузка разрешений роли
async function loadRolePermissions() {
  const roleId = Number(roleSelect.value);
  const perms = await apiProtected(`/api/acl-admin/role-permissions?role_id=${roleId}`, { method: 'GET' });
  
  const tbody = document.querySelector('#permTable');
  tbody.innerHTML = '';
  selectedPermId = null;
  btn_remPerm.disabled = true;

  if (perms) {
  perms.forEach(p => {
    const tr = document.createElement('tr');
    tr.dataset.permId = p.id;
    tr.textContent = p.name;
    tr.addEventListener('click', () => selectPermRow(tr, p.id));
    tbody.appendChild(tr);
  });
}
  renderAvailablePermissions();
}

// Загрузка ролей пользователя
async function loadUserRoles() {
  const userId = Number(userSelect.value);
  const roles = await apiProtected(`/api/acl-admin/user-roles?user_id=${userId}`, { method: 'GET' });
  
  const tbody = document.querySelector('#roleTable');
  tbody.innerHTML = '';
  selectedUserId = null;
  btn_remRole.disabled = true;

  if (roles) {
    roles.forEach(p => {
    const tr = document.createElement('tr');
    tr.dataset.userId = p.role_id;
    tr.textContent = p.name;
    tr.addEventListener('click', () => selectRoleRow(tr, p.id));
    tbody.appendChild(tr);
  });
  }
  renderAvailableRoles();
}

// Выбор строки разрешений
function selectPermRow(tr, permId) {
  document.querySelectorAll('#permTable tr').forEach(r => r.classList.remove('selected'));
  tr.classList.add('selected');
  selectedPermId = permId;
  btn_remPerm.disabled = false;
}

// Выбор строки роли
function selectRoleRow(tr, roleId) {
  document.querySelectorAll('#roleTable tr').forEach(r => r.classList.remove('selected'));
  tr.classList.add('selected');
  selectedRoleId = roleId;
  btn_remRole.disabled = false;
}

// Удаление разрешения
async function removePermission() {
  if (!selectedPermId) return;

  const roleId = Number(roleSelect.value);

  // показываем подтверждение
  const confirmed = await UIComponents.confirm(
    'Вы уверены, что хотите удалить это разрешение?',
    'Подтверждение'
  );

  if (!confirmed) {
    return; // пользователь отказался — выходим
  }

  try {
  await apiProtected('/api/acl-admin/remove-permission', {
    method: 'POST',
    body: { role_id: roleId, perm_id: selectedPermId }
  });

  // Обновляем таблицу
  loadRolePermissions();
   } catch (err) {
    alert('Ошибка удаления разрешения: ' + JSON.stringify(err.data || err));
  }

}

// Удаление роли
async function removeRole() {
  if (!selectedRoleId) return;

  const userId = Number(userSelect.value);

  // показываем подтверждение
  const confirmed = await UIComponents.confirm(
    'Вы уверены, что хотите удалить эту роль?',
    'Подтверждение'
  );

  if (!confirmed) {
    return; // пользователь отказался — выходим
  }

  try {
  await apiProtected('/api/acl-admin/remove-role', {
    method: 'POST',
    body: { user_id: userId, role_id: selectedRoleId }
  });

  // Обновляем таблицу
  loadUserRoles();
   } catch (err) {
    alert('Ошибка удаления разрешения: ' + JSON.stringify(err.data || err));
  }

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

        const roleIds = new Set((rolePermissions ?? []).map(u => u.id));
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


/* ===== Загрузка доступных ролей ===== */
async function renderAvailableRoles() {
  const userId = Number(userSelect.value);
    try {
        const allRoles = await apiProtected(
            "/api/acl-admin/roles",
            { method: "GET" }
        );

        const userRoles = await apiProtected(
            `/api/acl-admin/user-roles?user_id=${userId}`,
            { method: "GET" }
        );

        const userIds = new Set((userRoles ?? []).map(u => u.id));
        const available = allRoles.filter(u => !userIds.has(u.id));

        availableRoles.innerHTML = "";

        available.forEach(u => {
            const option = document.createElement("option");
            option.value = u.id;
            option.textContent = u.name;
            availableRoles.appendChild(option);
        });

    // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ
    availableRoles.selectedIndex = -1;
    } catch (err) {
        console.error("Ошибка загрузки доступных разрешений", err);
    }
}


// Обработчики
btn_remRole.onclick = removeRole;
btn_remPerm.onclick = removePermission;
btn_createRole.onclick = createRole;
btn_createPerm.onclick = createPermission;
roleSelect.addEventListener('change', loadRolePermissions);
userSelect.addEventListener('change', loadUserRoles);
// Автозагрузка
loadRoles();
loadUsers();
