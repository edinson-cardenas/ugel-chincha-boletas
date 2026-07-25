package models

import (
	"time"
)

type Usuario struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	Nombre          string    `json:"nombre" gorm:"size:100;not null"`
	Email           string    `json:"email" gorm:"size:150;uniqueIndex;not null"`
	PasswordHash    string    `json:"-" gorm:"size:255;not null"`
	Rol             string    `json:"rol" gorm:"size:20;default:'ayudante'"`
	PasswordChanged bool      `json:"password_changed" gorm:"default:false"`
	Token           string    `json:"-" gorm:"size:128"`
	TokenExpiresAt  *time.Time `json:"-" gorm:"index:idx_token_expires"`
	CreatedAt       time.Time `json:"created_at"`
}

type LoginAttempt struct {
	IP          string    `json:"ip" gorm:"size:45;primaryKey"`
	Attempts    int       `json:"attempts" gorm:"default:1"`
	LastAttempt time.Time `json:"last_attempt"`
}

func (LoginAttempt) TableName() string { return "login_attempts" }

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

func (Planilla) TableName() string { return "planilla" }

func (p *Planilla) CalculateTotal() {
	p.TotalLiquido = p.TotalHaberes - p.TotalDescuentos
}

type Planilla struct {
	ID              uint        `json:"id" gorm:"primaryKey"`
	PersonalID      uint        `json:"personal_id" gorm:"not null;index:idx_planilla_personal;uniqueIndex:idx_planilla_uniq"`
	Personal        Personal    `json:"personal,omitempty" gorm:"foreignKey:PersonalID"`
	Mes             int16       `json:"mes" gorm:"not null;uniqueIndex:idx_planilla_uniq"`
	Anio            int16       `json:"anio" gorm:"not null;uniqueIndex:idx_planilla_uniq;index:idx_planilla_mes_anio"`
	TotalHaberes    float64     `json:"total_haberes" gorm:"default:0"`
	TotalDescuentos float64     `json:"total_descuentos" gorm:"default:0"`
	TotalLiquido    float64     `json:"total_liquido" gorm:"default:0"`
	CreadoPor       *uint       `json:"creado_por"`
	CreadoEn        time.Time   `json:"creado_en"`
	Ingresos        []Ingreso   `json:"ingresos,omitempty" gorm:"foreignKey:PlanillaID;constraint:OnDelete:CASCADE"`
	Descuentos      []Descuento `json:"descuentos,omitempty" gorm:"foreignKey:PlanillaID;constraint:OnDelete:CASCADE"`
}

type Ingreso struct {
	ID         uint    `json:"id" gorm:"primaryKey"`
	PlanillaID uint    `json:"planilla_id" gorm:"not null;index:idx_ingresos_planilla;constraint:OnDelete:CASCADE"`
	Tipo       string  `json:"tipo" gorm:"size:80;not null"`
	Monto      float64 `json:"monto" gorm:"default:0"`
	Comentario string  `json:"comentario" gorm:"type:text"`
}

type Descuento struct {
	ID         uint    `json:"id" gorm:"primaryKey"`
	PlanillaID uint    `json:"planilla_id" gorm:"not null;index:idx_descuentos_planilla;constraint:OnDelete:CASCADE"`
	Tipo       string  `json:"tipo" gorm:"size:80;not null"`
	Monto      float64 `json:"monto" gorm:"default:0"`
	Comentario string  `json:"comentario" gorm:"type:text"`
}

type DataExcel struct {
	Personal  []Personal       `json:"personal"`
	Planillas []PlanillaImport `json:"planillas"`
}

type PlanillaImport struct {
	DNI        string            `json:"dni"`
	Nombres    string            `json:"nombres"`
	Mes        int               `json:"mes"`
	Anio       int               `json:"anio"`
	Ingresos   []IngresoImport   `json:"ingresos"`
	Descuentos []DescuentoImport `json:"descuentos"`
}

type IngresoImport struct {
	Tipo  string  `json:"tipo"`
	Monto float64 `json:"monto"`
}

type DescuentoImport struct {
	Tipo  string  `json:"tipo"`
	Monto float64 `json:"monto"`
}

type HaberesPayload struct {
	Mes            *int            `json:"mes"`
	Anio           *int            `json:"anio"`
	TotalEmpleados int             `json:"total_empleados"`
	Empleados      []EmpleadoHaber `json:"empleados"`
}

type EmpleadoHaber struct {
	Nombre          string         `json:"nombre"`
	Cargo           *string        `json:"cargo"`
	Resolucion      *string        `json:"resolucion"`
	Codigo          *string        `json:"codigo"`
	DNI             *string        `json:"dni"`
	Institucion     *string        `json:"institucion"`
	Distrito        *string        `json:"distrito"`
	Haberes         []ConceptoItem `json:"haberes"`
	Descuentos      []ConceptoItem `json:"descuentos"`
	TotalHaberes    *float64       `json:"total_haberes"`
	TotalDescuentos *float64       `json:"total_descuentos"`
	TotalLiquido    *float64       `json:"total_liquido"`
}

type ConceptoItem struct {
	Concepto string  `json:"concepto"`
	Monto    float64 `json:"monto"`
}
