# Панель администратора ACL

## Создать роль

<input id="roleName" placeholder="имя роли" />
<button onclick="createRole()">Создавать</button>

## Создать разрешение

<input id="permKey" placeholder="ключ разрешения" />
<button  id="btn_createPerm">Создавать</button>

## Назначить разрешение роли

<div class="acl-assign">
  <div class="col">
    <label for="roleSelect">Роль</label>
    <select id="roleSelect"></select>
  </div>

  <div class="permissions-table">
    <table id="permTable">
      <thead>
        <tr><th>Разрешения роли</th></tr>
      </thead>
      <tbody>
        <!-- строки будут добавляться динамически -->
      </tbody>
    </table>
  </div>

  <div class="actions">
    <button id="btn_remPerm" disabled>Удалить</button>
  </div>
    <h3>Добавить разрешение</h3>
    <select id="availablePerms"></select>
    <button id="addPermBtn">Добавить</button>
</div>

## Назначить роль пользователю

<input id="roleIdUser" placeholder="идентификатор роли" />
<input id="userIdRole" placeholder="идентификатор пользователя" />
<button onclick="assignRole()">Назначать</button>
