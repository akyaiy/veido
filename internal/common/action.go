package common

type Action string

const (
    ActionRead  Action = "r"
    ActionWrite Action = "w"
    ActionExec  Action = "x"
)