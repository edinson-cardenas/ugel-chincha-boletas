package service

import (
	"planillas-backend/internal/model"

	"gorm.io/gorm"
)

type DashboardService struct {
	db *gorm.DB
}

func NewDashboardService(db *gorm.DB) *DashboardService {
	return &DashboardService{db: db}
}

type ResumenDashboard struct {
	TotalPersonal   int64                   `json:"total_personal"`
	TotalPlanillas  int64                   `json:"total_planillas"`
	TotalHaberes    float64                 `json:"total_haberes"`
	TotalDescuentos float64                 `json:"total_descuentos"`
	TotalLiquido    float64                 `json:"total_liquido"`
	PlanillasMes    []model.Planilla        `json:"planillas_mes"`
}

func (s *DashboardService) GetResumen(mes, anio int) (*ResumenDashboard, error) {
	r := &ResumenDashboard{}

	s.db.Model(&model.Personal{}).Count(&r.TotalPersonal)
	s.db.Model(&model.Planilla{}).Count(&r.TotalPlanillas)

	query := s.db.Model(&model.Planilla{})
	if mes > 0 && anio > 0 {
		query = query.Where("mes = ? AND anio = ?", mes, anio)
	}
	query.Select("COALESCE(SUM(total_haberes), 0)").Scan(&r.TotalHaberes)
	query.Select("COALESCE(SUM(total_descuentos), 0)").Scan(&r.TotalDescuentos)
	r.TotalLiquido = r.TotalHaberes - r.TotalDescuentos

	if mes > 0 && anio > 0 {
		s.db.Where("mes = ? AND anio = ?", mes, anio).
			Preload("Personal").
			Limit(20).
			Order("total_liquido DESC").
			Find(&r.PlanillasMes)
		for i := range r.PlanillasMes {
			r.PlanillasMes[i].CalculateTotal()
		}
	}

	return r, nil
}
