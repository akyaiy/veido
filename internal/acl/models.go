package acl

//import "time"

type Role struct {
	ID   int64 `json:"id"`
	Name string `json:"name"`
}

type Permission struct {
	ID  int64 `json:"id"`
	Key string `json:"name"`
}

type RolePermission struct {
	RoleID       int64
	PermissionID int64
}

type UserRole struct {
	UserID int64
	RoleID int64
}
