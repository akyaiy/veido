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
        <div class="fileItem"><div class="fileName">Главная</div><div class="fileClose"><svg class="svgIcon" use="1x1"></svg></div></div> <!-- убарть -->
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
        <pageBlock data-id="1" data-name="Главная" data-path="/" data-children="2,3,4" data-position="120,20">Главная</pageBlock>  <!-- убрать -->
        <pageBlock data-id="2" data-name="О нас" data-path="/about" data-children="" data-position="20,70">О нас</pageBlock>  <!-- убрать -->
        <pageBlock data-id="3" data-name="Услуги" data-path="/services" data-children="" data-position="220,70">Услуги</pageBlock>  <!-- убрать -->
        <pageBlock data-id="4" data-name="Контакты" data-path="/contacts" data-children="" data-position="120,70">Контакты</pageBlock>  <!-- убрать -->
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