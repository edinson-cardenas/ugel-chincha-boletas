package model

import "time"

type Personal struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	DNI         string    `json:"dni" gorm:"size:20;index:idx_personal_dni"`
	Nombres     string    `json:"nombres" gorm:"size:100;not null"`
	Apellidos   string    `json:"apellidos" gorm:"size:100;not null"`
	Puesto      string    `json:"puesto" gorm:"size:100"`
	RD          string    `json:"rd" gorm:"size:50"`
	UU          string    `json:"uu" gorm:"size:50"`
	Institucion string    `json:"institucion" gorm:"size:150"`
	Distrito    string    `json:"distrito" gorm:"size:100"`
	CreatedAt   time.Time `json:"created_at"`
}

func (Personal) TableName() string { return "personal" }
