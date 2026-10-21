package v2

import "fmt"

type ActorKind string

const (
    ActorUser    ActorKind = "user"
    ActorGuest   ActorKind = "guest"
    ActorService ActorKind = "service"
)

type Actor struct {
    Kind ActorKind
    ID   string
}

func (a Actor) String() string {
    return fmt.Sprintf("%s:%s", a.Kind, a.ID)
}