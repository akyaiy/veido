package users

import "time"

const ProviderKey = "users"

type Profile struct {
	UserID      string    `json:"user_id"`
	DisplayName string    `json:"display_name"`
	Locale      string    `json:"locale"`
	Timezone    string    `json:"timezone"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProfileUpdate struct {
	DisplayName string `json:"display_name"`
	Locale      string `json:"locale"`
	Timezone    string `json:"timezone"`
}

type ActorDocument struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}
