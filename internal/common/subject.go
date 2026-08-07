package common

import "strings"

type SubjectKey string

const (
	SubjectKeyUser  SubjectKey = "user"
	SubjectKeyGroup SubjectKey = "group"
)

func (sk SubjectKey) String() string {
	return string(sk)
}

func (sk SubjectKey) ID() string {
	parts := strings.Split(string(sk), ":")
	if len(parts) != 2 {
		return ""
	}
	return parts[1]
}

func (sk SubjectKey) Type() string {
	parts := strings.Split(string(sk), ":")
	if len(parts) != 2 {
		return ""
	}
	return parts[0]
}
