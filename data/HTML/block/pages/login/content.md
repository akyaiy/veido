<div class="form1" id="login_block">

# Вход в систему

Пожалуйста, введите ваши данные для входа.

  <div class="grid-block">
      <form action="/login" method="post">
        <label for="username">Имя пользователя</label>
        <input type="text" id="username" name="username" required>
        <label for="password">Пароль</label>
        <input type="password" id="password" name="password" required>
        <button type="submit">Войти</button>
      </form>
  </div>
</div>

<div class="form1" id="user_block">
  <p id="user_info"></p>
  <button id="logout_btn">Выйти</button>
</div>
