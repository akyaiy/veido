<div id="siteStructureEditor">



<!-- Верхняя панель -->
<div id="topPanel">
    <div id="fileMenu">
        <div id="fileMenuIcon"><svg class="svgIcon" use="1x1"></svg></div>
        <div id="fileMenuList">
            <div id="newFile">Новый</div>
            <div id="openFile">Открыть</div>
            <div id="saveFile">Сохранить</div>
        </div>
    </div>
    <div id="fileList">
        <div class="fileItem"><div class="fileName">Главная</div><div class="fileClose"><svg class="svgIcon" use="1x1"></svg></div></div>
    </div>
    <div id="siteHistory">
        <div id="historyBack" title="Назад"><svg class="svgIcon" use="1x1"></svg></div>
        <div id="historyForward" title="Вперёд"><svg class="svgIcon" use="1x1"></svg></div>
    </div>
</div>



<!-- Основная панель -->
<div id="mainPanel">

<div id="centerPanel">
    <div id="siteMap">
        <pageBlock data-id="1" data-name="home" data-title="Главная" data-caption="" data-description="" data-types="" data-theme="" data-status="" data-access="" data-order="1" data-redirect="" data-position="120,20" data-view="expanded"><pageText>Главная</pageText></pageBlock>
        <pageBlock data-id="2" data-name="about" data-title="О нас" data-caption="" data-description="" data-types="" data-theme="" data-status="" data-access="" data-order="1" data-redirect="" data-position="20,70" data-view="collapsed"><pageText>О нас</pageText></pageBlock>
        <pageBlock data-id="3" data-name="services" data-title="Услуги" data-caption="" data-description="" data-types="" data-theme="" data-status="" data-access="" data-order="2" data-redirect="" data-position="220,70" data-view="collapsed"><pageText>Услуги</pageText></pageBlock>
        <pageBlock data-id="4" data-name="contacts" data-title="Контакты" data-caption="" data-description="" data-types="" data-theme="" data-status="" data-access="" data-order="3" data-redirect="" data-position="120,70" data-view="collapsed"><pageText>Контакты</pageText></pageBlock>
    </div>
    <div id="pageConnections">
        <pageConnection data-parent="1" data-child="2 3 4"></pageConnection>
    </div>
</div>

<div id="rightPanel">
<div id="pageProperties">

<div data-property="id"><label>ID</label><input type="number" min="1"></div>
<div data-property="name"><label>Название</label><input type="text"></div>
<div data-property="title"><label>Заголовок</label><input type="text"></div>
<div data-property="caption"><label>Подпись</label><textarea></textarea></div>
<div data-property="description"><label>Описание</label><textarea></textarea></div>
<hr>

<div data-property="types"><label>Типы</label><div class="multipleSelect"><div class="multipleSelectValue">Выберите типы</div><div class="multipleSelectList"><input type="text" class="multipleSelectAdd" placeholder="Добавить тип"><label><input type="checkbox" value="page">Страница</label><label><input type="checkbox" value="section">Раздел</label><label><input type="checkbox" value="service">Служебная</label><label><input type="checkbox" value="dynamic">Динамическая</label><label><input type="checkbox" value="external">Внешняя</label></div></div></div>
<div data-property="theme"><label>Тема</label><select><option value="">По умолчанию</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></div>
<div data-property="order"><label>Порядок</label><input type="number" min="1" value="1"></div>
<div data-property="redirect"><label>Перенаправление</label><input type="text"></div>
<hr>

<div data-property="status"><label>Статус</label><select><option value="draft">Черновик</option><option value="published">Опубликована</option><option value="hidden">Скрыта</option><option value="archived">Архив</option></select></div>
<div data-property="access"><label>Доступ</label><div class="multipleSelect"><div class="multipleSelectValue">Настроить доступ</div><div class="multipleSelectList"><div class="accessAdd"><input type="text" placeholder="Добавить пользователя"><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div><div class="accessItem"><span>Гость</span><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div><div class="accessItem"><span>Пользователь</span><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div><div class="accessItem"><span>Администратор</span><select><option value="read">Чтение</option><option value="edit">Изменение</option><option value="full">Полный</option></select></div></div></div></div>
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