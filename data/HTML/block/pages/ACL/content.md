# Панель администратора ACL

## Создать роль

<input id="roleName" placeholder="имя роли" />
<button  id="btn_createRole">Создавать</button>

## Создать разрешение

<input id="permKey" placeholder="разрешение" />
<button  id="btn_createPerm">Создавать</button>

## Назначить разрешение роли

<div class="acl-assign">
  <div class="col">
    <label for="roleSelect">Роль</label>
    <select id="roleSelect"></select>
  </div>

  <div class="permissions-table">
    <table>
      <thead>
        <tr><th>Разрешения роли</th></tr>
      </thead>
      <tbody id="permTable">
        <!-- строки будут добавляться динамически -->
      </tbody>
    </table>
  </div>

  <div class="actions">
    <button id="btn_remPerm" disabled>Удалить</button>
  </div>
    <h3>Добавить разрешение</h3>
    <select id="availablePerms" placeholder="доступные разрешения"></select>
</div>

## Назначить роль пользователю

<div class="acl-assign">
  <div class="col">
    <label for="userSelect">Пользователь</label>
    <select id="userSelect"></select>
  </div>

  <div class="permissions-table">
    <table>
      <thead>
        <tr><th>Роли пользователя</th></tr>
      </thead>
      <tbody id="roleTable">
        <!-- строки будут добавляться динамически -->
      </tbody>
    </table>
  </div>

  <div class="actions">
    <button id="btn_remRole" disabled>Удалить</button>
  </div>
    <h3>Добавить роль</h3>
    <select id="availableRoles" placeholder="доступные разрешения"></select>
</div>
