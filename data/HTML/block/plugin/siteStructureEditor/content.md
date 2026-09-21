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
        <div data-property="name"><label>Название</label><input type="text"></div>
        <div data-property="path"><label>Путь</label><input type="text"></div>
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