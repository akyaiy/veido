<div id="usersPage">

<div class="mainBlockName">Управление пользователями</div>

<!-- Список пользователей -->
<div id="activateBlock" class="blockPage">
    <div class="blockName">Список пользователей</div>
    <div class="blockContent">
        <div id="userSelectContainer" class="selectContainer">
            <div id="userSelectChoice" class="selectChoice"></div>
            <div id="userSelect" class="selectList"></div>
        </div>
    </div>
</div>

<!-- Данные пользователя -->
<div id="userDataBlock" class="blockPage">
    <div class="blockName">Данные пользователя</div>
    <div class="blockContent">
        <div>ID: <span id="userId">-</span></div>
        <div>Имя: 
            <span id="username">-</span><br>
            <input id="usernameInput" type="text">
        </div>
        <div>Статус: 
            <span id="userStatus">-</span><br>
            <div id="userStatusInputContainer" class="selectContainer">
                <div id="userStatusInputChoice" class="selectChoice"></div>
                <div id="userStatusInput" class="selectList"></div>
            </div>
        </div>
        <div>
            Группы:
            <div id="userRolesContainer">
                <div id="userRolesInput"></div>
                <div id="userRoles"></div>
                <button id="userRolesAdd">+</button>
            </div>
        </div>
        <div id="passwordBlockContainer"></div>
        <!-- Кнопки редактирования -->
        <div id="userActions">
            <button id="btnEditUser" type="button">Редактировать</button>
            <button id="btnCancelUser" type="button">Отменить</button>
            <button id="btnSaveUser" type="button">Сохранить</button>
            <button id="btnDeleteUser" type="button">Удалить пользователя</button>
        </div>
    </div>
</div>

</div>
