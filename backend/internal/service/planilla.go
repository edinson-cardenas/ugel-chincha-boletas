package service

import (
	"planillas-backend/internal/model"

	"gorm.io/gorm"
)

type PlanillaService struct {
	db *gorm.DB
}

func NewPlanillaService(db *gorm.DB) *PlanillaService {
	return &PlanillaService{db: db}
}

func (s *PlanillaService) List(mes, anio, search string, page, limit int, sortBy, sortOrder string) ([]model.Planilla, int64, error) {
	var planillas []model.Planilla
	var total int64

	if limit > 100 {
		limit = 100
	}

	validSortFields := map[string]bool{"anio": true, "mes": true, "total_haberes": true, "total_descuentos": true, "total_liquido": true, "created_at": true}
	if !validSortFields[sortBy] {
		sortBy = "anio"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	baseQuery := s.db.Model(&model.Planilla{}).Preload("Personal")

	if mes != "" {
		baseQuery = baseQuery.Where("mes = ?", mes)
	}
	if anio != "" {
		baseQuery = baseQuery.Where("anio = ?", anio)
	}
	if search != "" {
		baseQuery = baseQuery.Joins("JOIN personal ON personal.id = planilla.personal_id").
			Where("personal.nombres ILIKE ? OR personal.apellidos ILIKE ? OR personal.dni ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	baseQuery.Count(&total)

	orderStr := sortBy
	if sortOrder == "desc" {
		orderStr += " DESC"
	} else {
		orderStr += " ASC"
	}
	if sortBy == "anio" {
		orderStr += ", mes DESC"
	}

	offset := (page - 1) * limit
	baseQuery.Offset(offset).Limit(limit).Order(orderStr).Find(&planillas)

	for i := range planillas {
		planillas[i].CalculateTotal()
	}

	return planillas, total, nil
}

func (s *PlanillaService) RecalculateTotals(planillaID uint) {
	var totalHab, totalDesc float64
	s.db.Model(&model.Ingreso{}).Where("planilla_id = ?", planillaID).Select("COALESCE(SUM(monto), 0)").Scan(&totalHab)
	s.db.Model(&model.Descuento{}).Where("planilla_id = ?", planillaID).Select("COALESCE(SUM(monto), 0)").Scan(&totalDesc)
	s.db.Model(&model.Planilla{}).Where("id = ?", planillaID).Updates(map[string]interface{}{
		"total_haberes":    totalHab,
		"total_descuentos": totalDesc,
		"total_liquido":    totalHab - totalDesc,
	})
}
