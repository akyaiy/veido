<div class="box">
<h1>Auth demo</h1>
<div>
<h3>Register</h3>
user:<br>
<input id="reg_user" placeholder="Username"><br>
password:<br>
<input id="reg_pass" placeholder="password"  type="password"><button class="toggle-pass" type="button">A</button><br><br>
<button id="btn_reg">Register</button>

<h3>Users</h3>
user:<br>
<select id="users_list"></select>
<button id="btn_load_users">Load Users</button><br>
<!-- <button id="btn_user_data">Get User Data</button> -->
ID:<br>
<input id="ud_id" placeholder="ID"><br>
user:<br>
<input id="ud_username" placeholder="Username"><br>
password:<br>
<input id="ud_password" placeholder="New password" type="password"><button class="toggle-pass" type="button">A</button><br>
<br>
<button id="btn_update_pass">Update password</button>
<button id="btn_delete_user">Delete user</button>

<h3>Login</h3>
user:<br>
<input id="log_user"  placeholder="Username">
<br>
password:<br>
<input id="log_pass" placeholder="password"  type="password"><button class="toggle-pass" type="button">A</button>
<br><br>
<button id="btn_log">Login</button>
</div><br>

<button id="btn_prot">Protected</button>

<pre id="out"></pre>

<button id="btn_logout">Logout</button>

</div>
