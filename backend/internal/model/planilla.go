package model

import "time"

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

func (Planilla) TableName() string { return "planilla" }

func (p *Planilla) CalculateTotal() {
	p.TotalLiquido = p.TotalHaberes - p.TotalDescuentos
}
