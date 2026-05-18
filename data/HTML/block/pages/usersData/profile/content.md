<div id="profilePage">
    <div class="mainBlockName">Профиль</div>
    <div class="blockPage">
        <div class="blockName">Мои данные</div>
        <div class="blockContent">
            <div>ID: <span id="userId">-</span></div>
            <div>Имя: 
                <span id="username">-</span>
                <input id="usernameInput" type="text">
            </div>
            <div>Статус: <span id="userActive">-</span></div>
            <div>
                Группы:
                <div id="userRoles"></div>
            </div>
            <div id="userPasswordBlock">Сменить пороль: 
                <br>Старый пороль: <input id="userOldPasswordInput" type="password">
                <br>Новый пороль: <input id="userPasswordInput" type="password">
            </div>
            <div id="userActions">
                <button id="btnEditUser" type="button">Редактировать</button>
                <button id="btnCancelUser" type="button">Отменить</button>
                <button id="btnSaveUser" type="button">Сохранить</button>
            </div>
        </div>
    </div>
</div>
