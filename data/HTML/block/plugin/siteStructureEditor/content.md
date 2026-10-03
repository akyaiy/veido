<div id="siteStructureEditor">



<!-- Верхняя панель -->
<div id="topPanel">
    <div id="fileMenu">
        <div id="fileMenuIcon"><svg class="svgIcon" use="8x13"></svg></div>
        <div id="fileMenuList">
            <div id="newFile">Новый</div>
            <div id="openFile">Открыть</div>
            <div id="saveFile">Сохранить</div>
        </div>
    </div>
    <div id="fileList"></div>
    <div id="siteHistory">
        <div id="historyBack" title="Назад"><svg class="svgIcon" use="3x13"></svg></div>
        <div id="historyForward" title="Вперёд"><svg class="svgIcon" use="3x14"></svg></div>
    </div>
</div>



<!-- Основная панель -->
<div id="mainPanel">

<div id="centerPanel">
    <div id="mapSettings">
        <div id="viewSettings">
            <select id="viewType">
                <option value="cards">Карточки</option>
                <option value="tree">Дерево</option>
                <!-- <option value="colors">Цвета</option> -->
            </select>
        </div>
        <div id="gridSettings">
            <input id="gridSizeValue" type="number" min="1" max="100" value="10">
            <input id="gridSize" type="range" min="1" max="100" value="10">
        </div>
    </div>
    <div id="siteMap"></div>
</div>

<div id="openedFiles"></div>

<div id="rightPanel">
<div id="pageProperties">

<div data-property="id"><label>ID</label><input type="number" min="1"></div>
<div data-property="name"><label>Имя</label><input type="text"></div>
<div data-property="title"><label>Название</label><input type="text"></div>
<div data-property="caption"><label>Пояснение</label><textarea></textarea></div>
<div data-property="description"><label>Описание</label><textarea></textarea></div>
<hr>

<div data-property="types"><label>Типы</label><div class="multipleSelect"><div class="multipleSelectValue">Выберите типы</div><div class="multipleSelectList"><input type="text" class="multipleSelectAdd" placeholder="Добавить тип"><label><input type="checkbox" value="page">Страница</label><label><input type="checkbox" value="section">Раздел</label><label><input type="checkbox" value="service">Служебная</label><label><input type="checkbox" value="dynamic">Динамическая</label><label><input type="checkbox" value="external">Внешняя</label></div></div></div>
<div data-property="theme"><label>Тема</label><select><option value="">По умолчанию</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></div>
<div data-property="order"><label>Порядок</label><select></select></div>
<div data-property="redirect"><label>Перенаправление</label><input type="text"></div>
<hr>

<div data-property="status"><label>Статус</label><select><option value="draft">Черновик</option><option value="published">Опубликована</option><option value="hidden">Скрыта</option><option value="archived">Архив</option></select></div>
<div data-property="access"><label>Доступ</label><div class="multipleSelect"><div class="multipleSelectValue">Настроить доступ</div><div class="multipleSelectList"><div class="accessAdd"><input type="text" placeholder="Добавить пользователя"><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div><div class="accessItem" data-access="guest"><span>Гость</span><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div><div class="accessItem" data-access="user"><span>Пользователь</span><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div><div class="accessItem" data-access="admin"><span>Администратор</span><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div></div></div></div>
<hr>

<div data-property="position"><label>Позиция</label><div><input type="number" data-position="x" placeholder="X"><input type="number" data-position="y" placeholder="Y"></div></div>
<div data-property="view"><label>Вид</label><select><option value="expanded">Развёрнутый</option><option value="collapsed">Свёрнутый</option></select></div>

</div>
</div>

</div>



<!-- Контекстное меню -->
<div id="contextMenu">
    <div data-action="create" data-target="empty">Создать</div>
    <div data-action="paste" data-target="empty">Вставить</div>
    <div data-action="copy" data-target="page">Копировать</div>
    <div data-action="cut" data-target="page">Вырезать</div>
    <div data-action="delete" data-target="page">Удалить</div>
</div>



</div>