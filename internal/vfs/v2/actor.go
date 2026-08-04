package v2

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