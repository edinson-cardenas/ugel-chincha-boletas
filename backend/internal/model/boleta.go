package model

import "time"

type BoletaOCR struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	NombreCompleto string    `json:"nombre_completo" gorm:"size:200"`
	CodigoModular  string    `json:"codigo_modular" gorm:"size:20;index"`
	DNI            string    `json:"dni" gorm:"size:20"`
	Institucion    string    `json:"institucion" gorm:"size:200"`
	Nivel          string    `json:"nivel" gorm:"size:50"`
	Establecimiento string   `json:"establecimiento" gorm:"size:50"`
	Anio           int16     `json:"anio"`
	Mes            int16     `json:"mes"`
	TotalHaberes   float64   `json:"total_haberes"`
	TotalDescuentos float64  `json:"total_descuentos"`
	TotalLiquido   float64   `json:"total_liquido"`
	MontoImponible float64   `json:"monto_imponible"`
	Haberes        string    `json:"haberes" gorm:"type:jsonb;default:'[]'"`    // JSON array
	Descuentos     string    `json:"descuentos" gorm:"type:jsonb;default:'[]'"`  // JSON array
	ImagenOriginal string    `json:"imagen_original" gorm:"size:500"`
	OcrEngine      string    `json:"ocr_engine" gorm:"size:20;default:'tesseract'"`
	OcrConfidence  float64   `json:"ocr_confidence"`
	CreatedBy      *uint     `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (BoletaOCR) TableName() string { return "boletas_ocr" }

type ConceptoBoleta struct {
	Codigo   string  `json:"codigo"`
	Concepto string  `json:"concepto"`
	Monto    float64 `json:"monto"`
}

type BoletaScanResult struct {
	NombreCompleto  string            `json:"nombre_completo"`
	CodigoModular   string            `json:"codigo_modular"`
	Institucion     string            `json:"institucion"`
	Nivel           string            `json:"nivel"`
	Establecimiento string            `json:"establecimiento"`
	Anio            int               `json:"anio"`
	Mes             int               `json:"mes"`
	Haberes         []ConceptoBoleta  `json:"haberes"`
	Descuentos      []ConceptoBoleta  `json:"descuentos"`
	TotalHaberes    float64           `json:"total_haberes"`
	TotalDescuentos float64           `json:"total_descuentos"`
	TotalLiquido    float64           `json:"total_liquido"`
	MontoImponible  float64           `json:"monto_imponible"`
	OcrEngine       string            `json:"ocr_engine"`
	OcrConfidence   float64           `json:"ocr_confidence"`
	RawText         string            `json:"raw_text,omitempty"`
}
