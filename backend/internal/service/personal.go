package service

import (
	"planillas-backend/internal/model"

	"gorm.io/gorm"
)

type PersonalService struct {
	db *gorm.DB
}

func NewPersonalService(db *gorm.DB) *PersonalService {
	return &PersonalService{db: db}
}

func (s *PersonalService) List(search string, page, limit int, sortBy, sortOrder string, puesto, rd, uu, institucion, distrito, mes, anio string) ([]model.Personal, int64, error) {
	var personal []model.Personal
	var total int64

	if limit > 100 {
		limit = 100
	}

	validSortFields := map[string]bool{"apellidos": true, "nombres": true, "dni": true, "created_at": true}
	if !validSortFields[sortBy] {
		sortBy = "apellidos"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "asc"
	}

	baseQuery := s.db.Model(&model.Personal{})

	if search != "" {
		baseQuery = baseQuery.Where("nombres ILIKE ? OR apellidos ILIKE ? OR dni ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	if puesto != "" {
		baseQuery = baseQuery.Where("puesto ILIKE ?", "%"+puesto+"%")
	}
	if rd != "" {
		baseQuery = baseQuery.Where("rd ILIKE ?", "%"+rd+"%")
	}
	if uu != "" {
		baseQuery = baseQuery.Where("uu ILIKE ?", "%"+uu+"%")
	}
	if institucion != "" {
		baseQuery = baseQuery.Where("institucion ILIKE ?", "%"+institucion+"%")
	}
	if distrito != "" {
		baseQuery = baseQuery.Where("distrito ILIKE ?", "%"+distrito+"%")
	}

	baseQuery.Count(&total)

	orderStr := sortBy
	if sortOrder == "desc" {
		orderStr += " DESC"
	} else {
		orderStr += " ASC"
	}
	if sortBy == "apellidos" {
		orderStr += ", nombres ASC"
	}

	offset := (page - 1) * limit
	baseQuery.Offset(offset).Limit(limit).Order(orderStr).Find(&personal)

	return personal, total, nil
}

func (s *PersonalService) GetByID(id string) (*model.Personal, error) {
	var personal model.Personal
	if err := s.db.First(&personal, id).Error; err != nil {
		return nil, err
	}
	return &personal, nil
}
