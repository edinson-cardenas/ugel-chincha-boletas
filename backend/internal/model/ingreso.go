package model

type Ingreso struct {
	ID         uint    `json:"id" gorm:"primaryKey"`
	PlanillaID uint    `json:"planilla_id" gorm:"not null;index:idx_ingresos_planilla;constraint:OnDelete:CASCADE"`
	Tipo       string  `json:"tipo" gorm:"size:80;not null"`
	Monto      float64 `json:"monto" gorm:"default:0"`
	Comentario string  `json:"comentario" gorm:"type:text"`
}
