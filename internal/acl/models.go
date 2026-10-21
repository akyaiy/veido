package acl

//import "time"

type Group struct {
	ID   int64 `json:"id"`
	Name string `json:"name"`
}

type Permission struct {
	ID  int64 `json:"id"`
	Key string `json:"name"`
}

type GroupPermission struct {
	GroupID       int64
	PermissionID int64
}

type UserGroup struct {
	UserID int64
	GroupID int64
}
