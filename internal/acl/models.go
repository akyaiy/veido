package acl

//import "time"

type Role struct {
	ID   int64
	Name string
}

type Permission struct {
	ID  int64
	Key string
}

type RolePermission struct {
	RoleID       int64
	PermissionID int64
}

type UserRole struct {
	UserID int64
	RoleID int64
}
