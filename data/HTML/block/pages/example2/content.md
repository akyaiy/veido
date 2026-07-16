<div id="page" class="page" data-block="main" data-version="1">
    <header class="header" id="mainHeader" data-section="header">
        <div class="headerInner" data-container="true">
            <div class="logoBox" title="Логотип сайта">
                <span class="logoText" data-name="logo">
                    <b>Trigger</b>
                    <i>Smith</i>
                </span>
            </div>
            <nav class="menu" role="navigation" aria-label="Главное меню">
                <span href="#" class="menuLink" data-page="home" title="Главная страница">
                    <span>Главная</span>
                </span>
                <span href="#" class="menuLink active" data-page="documents" aria-current="page">
                    <strong>Документы</strong>
                </span>
                <span href="#" class="menuLink" data-page="settings">
                    <span style="color:red;font-weight:bold;" title="Настройки пользователя">
                        Настройки
                    </span>
                </span>
            </nav>
        </div>
    </header>
    <main class="main" id="content" data-layout="main">
        <section class="hero" id="heroBlock" data-type="section">
            <div class="heroContent">
                <h1 class="heroTitle" title="Главный заголовок">
                    Создание
                    <span class="blue" data-color="blue">
                        <b>сложного</b>
                    </span>
                    HTML
                    <span style="color:red;" data-color="red">
                        редактора
                    </span>
                </h1>
                <p class="heroText" data-text="description">
                    Текст
                    <strong>
                        жирный
                        <em>
                            курсив
                            <u>
                                подчеркнутый
                            </u>
                        </em>
                    </strong>
                    <span class="highlight" data-highlight="true">
                        выделение
                    </span>
                </p>
            </div>
        </section>
    </main>
</div>

<div id="testBlock2">
    <div id="testBlock" class="box card active large333" data-type="example" data-state="open" title="Тестовый блок" aria-label="Пример элемента">
        Текстовый блок
    </div>
</div>

<section class="tableSection" id="tableBlock" data-component="table">
    <div class="tableWrapper">
        <div class="tableTitle" title="Название таблицы">
            Таблица данных
        </div>
        <table class="dataTable" border="1" data-table="users">
            <thead>
                <tr data-row="header">
                    <th scope="col">
                        <span>
                            Название
                        </span>
                    </th>
                    <th scope="col">
                        <span class="blue">
                            Тип
                        </span>
                    </th>
                    <th scope="col">
                        <span style="color:red;font-weight:bold;">
                            Статус
                        </span>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr class="tableRow" data-id="1">
                    <td>
                        <div class="cell">
                            <span>
                                HTML
                            </span>
                            <b>
                                блок
                            </b>
                        </div>
                    </td>
                    <td>
                        <div class="cell">
                            <span class="tag" data-tag="section">
                                section
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="status success" data-status="active">
                            <strong>
                                Активен
                            </strong>
                        </div>
                    </td>
                </tr>
                <tr class="tableRow" data-id="2">
                    <td>
                        <div class="cell">
                            <span>
                                CSS
                                <i>
                                    стиль
                                </i>
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="cell">
                            <span data-type="class">
                                class
                                <b>
                                    selector
                                </b>
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="status warning" style="font-weight:bold;" data-status="waiting">
                            <span>
                                Ожидание
                            </span>
                        </div>
                    </td>
                </tr>
                <tr class="tableRow" data-id="3">
                    <td>
                        <div class="cell">
                            <span>
                                JavaScript
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="cell">
                            <code data-language="javascript">
                                function()
                            </code>
                        </div>
                    </td>
                    <td>
                        <div class="status error" data-status="error">
                            <span>
                                Ошибка
                            </span>
                        </div>
                    </td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">
                        <div class="tableFooter" data-total="3">
                            <span>
                                Всего элементов:
                            </span>
                            <b>
                                3
                            </b>
                        </div>
                    </td>
                </tr>
            </tfoot>
        </table>
    </div>
</section>