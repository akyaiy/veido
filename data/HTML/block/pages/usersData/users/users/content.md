<div id="usersPage">

<div>Управление пользователями</div>

<!-- Список пользователей -->
<div id="activateBlock">
    <div>Список пользователей</div>
    <select id="userSelect"></select>
</div>

<!-- Данные пользователя -->
<div id="userDataBlock">
    <div>Данные пользователя</div>
    <div>ID: <span id="userId">-</span></div>
    <div>Имя: 
        <span id="username">-</span>
        <input id="usernameInput" type="text">
    </div>
    <div>Статус: 
        <span id="userStatus">-</span>
        <select id="userStatusInput">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="unactive">unactive</option>
        </select>
    </div>
    <div>
        Группы:
        <ul id="userRoles"></ul>
        <select id="userRolesInput"></select>
    </div>
    <div id="userPasswordBlock">Сменить пороль: 
        <input id="userPasswordInput" type="password">
    </div>
    <!-- Кнопки редактирования -->
    <div id="userActions">
        <button id="btnEditUser" type="button">Редактировать</button>
        <button id="btnCancelUser" type="button">Отменить</button>
        <button id="btnSaveUser" type="button">Сохранить</button>
        <button id="btnDeleteUser" type="button">Удалить пользователя</button>
    </div>
</div>

</div>
