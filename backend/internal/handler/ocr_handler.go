package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"planillas-backend/internal/model"
	"planillas-backend/internal/ocr"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func OcrScanner(db *gorm.DB) gin.HandlerFunc {
	scanner := ocr.NewScanner("")

	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No se encontró archivo"})
			return
		}

		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al abrir archivo"})
			return
		}
		defer src.Close()

		imagePath, err := scanner.SaveUploadedFile(src, file.Filename)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar imagen"})
			return
		}

		result, err := scanner.ScanImage(imagePath)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
			return
		}

		// Guardar en BD
		haberesJSON, _ := json.Marshal(result.Haberes)
		descuentosJSON, _ := json.Marshal(result.Descuentos)
		boleta := model.BoletaOCR{
			NombreCompleto:  result.NombreCompleto,
			CodigoModular:   result.CodigoModular,
			Institucion:     result.Institucion,
			Nivel:           result.Nivel,
			Establecimiento: result.Establecimiento,
			Anio:            int16(result.Anio),
			Mes:             int16(result.Mes),
			TotalHaberes:    result.TotalHaberes,
			TotalDescuentos: result.TotalDescuentos,
			TotalLiquido:    result.TotalLiquido,
			MontoImponible:  result.MontoImponible,
			Haberes:         string(haberesJSON),
			Descuentos:      string(descuentosJSON),
			ImagenOriginal:  imagePath,
			OcrEngine:       result.OcrEngine,
			OcrConfidence:   result.OcrConfidence,
		}
		db.Create(&boleta)

		c.JSON(http.StatusOK, gin.H{
			"boleta": boleta,
			"result": result,
		})
	}
}

func OcrScanBatch(db *gorm.DB) gin.HandlerFunc {
	scanner := ocr.NewScanner("")

	return func(c *gin.Context) {
		form, err := c.MultipartForm()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Error al leer archivos"})
			return
		}

		files := form.File["files"]
		if len(files) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No se encontraron archivos"})
			return
		}

		var imagePaths []string
		for _, file := range files {
			src, _ := file.Open()
			path, err := scanner.SaveUploadedFile(src, file.Filename)
			src.Close()
			if err != nil {
				continue
			}
			imagePaths = append(imagePaths, path)
		}

		results, errs := scanner.ScanBatch(imagePaths)

		// Guardar resultados exitosos
		var saved []model.BoletaOCR
		for _, r := range results {
			haberesJSON, _ := json.Marshal(r.Haberes)
			descuentosJSON, _ := json.Marshal(r.Descuentos)
			boleta := model.BoletaOCR{
				NombreCompleto:  r.NombreCompleto,
				CodigoModular:   r.CodigoModular,
				Institucion:     r.Institucion,
				Nivel:           r.Nivel,
				Establecimiento: r.Establecimiento,
				Anio:            int16(r.Anio),
				Mes:             int16(r.Mes),
				TotalHaberes:    r.TotalHaberes,
				TotalDescuentos: r.TotalDescuentos,
				TotalLiquido:    r.TotalLiquido,
				MontoImponible:  r.MontoImponible,
				Haberes:         string(haberesJSON),
				Descuentos:      string(descuentosJSON),
				OcrEngine:       r.OcrEngine,
				OcrConfidence:   r.OcrConfidence,
			}
			db.Create(&boleta)
			saved = append(saved, boleta)
		}

		errMessages := make([]string, len(errs))
		for i, e := range errs {
			errMessages[i] = e.Error()
		}

		c.JSON(http.StatusOK, gin.H{
			"total":     len(files),
			"exitosos":  len(results),
			"errores":   len(errs),
			"boletas":   saved,
			"detalles":  errMessages,
		})
	}
}

func ListarBoletasOCR(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var boletas []model.BoletaOCR
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		if limit > 100 { limit = 100 }
		offset := (page - 1) * limit

		var total int64
		db.Model(&model.BoletaOCR{}).Count(&total)

		db.Order("created_at DESC").Offset(offset).Limit(limit).Find(&boletas)

		c.JSON(http.StatusOK, gin.H{
			"data":        boletas,
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": (int(total) + limit - 1) / limit,
		})
	}
}

func EliminarBoletaOCR(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := db.Delete(&model.BoletaOCR{}, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Boleta no encontrada"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Boleta eliminada"})
	}
}

func ExportarBoletasExcel(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		mesStr := c.Query("mes")
		anioStr := c.Query("anio")
		idsStr := c.Query("ids") // IDs separados por coma

		query := db.Model(&model.BoletaOCR{})
		if idsStr != "" {
			query = query.Where("id IN (?)", parseIDList(idsStr))
		}
		if mesStr != "" {
			mes, _ := strconv.Atoi(mesStr)
			query = query.Where("mes = ?", mes)
		}
		if anioStr != "" {
			anio, _ := strconv.Atoi(anioStr)
			query = query.Where("anio = ?", anio)
		}

		var boletas []model.BoletaOCR
		query.Order("nombre_completo, anio, mes").Find(&boletas)

		excelBytes, err := ocr.GenerateBoletasExcel(boletas)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error generando Excel: %v", err)})
			return
		}

		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", "attachment; filename=boletas_ocr.xlsx")
		c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelBytes)
	}
}

func parseIDList(s string) []int {
	var ids []int
	for _, part := range splitAndTrim(s, ",") {
		id, err := strconv.Atoi(part)
		if err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func splitAndTrim(s, sep string) []string {
	parts := make([]string, 0)
	for _, p := range splitString(s, sep) {
		t := trim(p)
		if t != "" {
			parts = append(parts, t)
		}
	}
	return parts
}

func splitString(s, sep string) []string {
	if s == "" {
		return nil
	}
	result := make([]string, 0)
	start := 0
	for i := 0; i < len(s); i++ {
		if string(s[i]) == sep {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	result = append(result, s[start:])
	return result
}

func trim(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}
