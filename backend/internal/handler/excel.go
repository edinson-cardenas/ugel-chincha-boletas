package handler

import (
	"planillas-backend/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ProcessExcel(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ProcessExcel(c) }
}
func ValidateExcel(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ValidateExcel(c) }
}
func ImportarExcel(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ImportarExcel(c) }
}
func ImportarJSON(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ImportarJSON(c) }
}
func ImportarHaberes(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ImportarHaberes(c) }
}
func LimpiarImportacion(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.LimpiarImportacion(c) }
}
func LimpiarTodoPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.LimpiarTodoPersonal(c) }
}
func ListarPeriodosImportados(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ListarPeriodosImportados(c) }
}
func ExportarPlanillasPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ExportarPlanillasPersonal(c) }
}
