<!-- Модальное окно уведомления -->
<div id="modalAlert" class="modalWindow" style="display: none;">
    <div class="modalText">Внимание! Действие успешно выполнено.</div>
    <div class="modalActions">
        <button id="modalAlertBtn" class="modalButton">OK</button>
    </div>
</div>

<!-- Модальное окно подтверждения -->
<div id="modalConfirm" class="modalWindow" style="display: none;">
    <div class="modalText">Вы уверены, что хотите продолжить?</div>
    <div class="modalActions">
        <button id="modalConfirmCancelBtn" class="modalButton btnSecondary">Отмена</button>
        <button id="modalConfirmOkBtn" class="modalButton">Да</button>
    </div>
</div>

<!-- Модальное окно ввода значения -->
<div id="modalPrompt" class="modalWindow" style="display: none;">
    <div class="modalText">Введите значение:</div>
    <input type="text" id="modalPromptInput" class="modalInput">
    <div class="modalActions">
        <button id="modalPromptCancelBtn" class="modalButton btnSecondary">Отмена</button>
        <button id="modalPromptOkBtn" class="modalButton">OK</button>
    </div>
</div>