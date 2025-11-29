package users

import (
	"MyServer/internal/auth"
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	//	"MyServer/internal/auth"
	//
	// "io"
	// "bytes"
)

func User(db *sql.DB, aut *auth.Auth) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		path := strings.Trim(r.URL.Path, "/")
		segments := strings.Split(path, "/")

		if len(segments) < 3 {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		first := segments[2]

		switch first {

		case "register":
			fmt.Println("Клиент выбрал регистрацию")
			RegisterHandler(db, aut)(w, r)
			return

		case "login":
			fmt.Println("Клиент выбрал войти")
			LoginHandler(db, aut)(w, r)
			return

		case "refresh":
			fmt.Println("Клиент выбрал обновить")
			RefreshHandler(db, aut)
			return

		case "logout":
			fmt.Println("Клиент выбрал выйти")
			LogoutHandler(db, aut)
			return

		case "getUserData":
			fmt.Println("Клиент выбрал получить данные пользователя")
			GetUserDataHandler(db, aut)(w, r)
			return

		case "getUserNames":
			fmt.Println("Клиент выбрал получить список пользователей")
			GetUsersHandler(db, aut)(w, r)
			return

		case "update_password":
			fmt.Println("Клиент выбрал заменить пароль")
			UpdateUserPasswordHandler(db, aut)(w, r)
			return

		case "delete_user":
			fmt.Println("Клиент выбрал удалить пользователя")
			DeleteUserHandler(db, aut)(w, r)
			return

		default:
			http.Error(w, "unknown method", http.StatusNotFound)
		}
	}
}
