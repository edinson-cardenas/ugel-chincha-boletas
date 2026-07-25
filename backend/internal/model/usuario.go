package model

import "time"

type Usuario struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	Nombre          string     `json:"nombre" gorm:"size:100;not null"`
	Email           string     `json:"email" gorm:"size:150;uniqueIndex;not null"`
	PasswordHash    string     `json:"-" gorm:"size:255;not null"`
	Rol             string     `json:"rol" gorm:"size:20;default:'ayudante'"`
	PasswordChanged bool       `json:"password_changed" gorm:"default:false"`
	Token           string     `json:"-" gorm:"size:128"`
	TokenExpiresAt  *time.Time `json:"-" gorm:"index:idx_token_expires"`
	CreatedAt       time.Time  `json:"created_at"`
}

type LoginAttempt struct {
	IP          string    `json:"ip" gorm:"size:45;primaryKey"`
	Attempts    int       `json:"attempts" gorm:"default:1"`
	LastAttempt time.Time `json:"last_attempt"`
}

func (LoginAttempt) TableName() string { return "login_attempts" }
