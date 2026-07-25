package handler

import (
	"planillas-backend/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListarPlanillas(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ListarPlanillas(c) }
}
func ObtenerPlanilla(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ObtenerPlanilla(c) }
}
func EditarPlanillaCompleta(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.EditarPlanillaCompleta(c) }
}
func CrearPlanilla(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.CrearPlanilla(c) }
}
func ActualizarPlanilla(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ActualizarPlanilla(c) }
}
func EliminarPlanilla(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.EliminarPlanilla(c) }
}
func ListarIngresos(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ListarIngresos(c) }
}
func ListarDescuentos(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ListarDescuentos(c) }
}
func CrearIngreso(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.CrearIngreso(c) }
}
func ActualizarIngreso(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ActualizarIngreso(c) }
}
func EliminarIngreso(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.EliminarIngreso(c) }
}
func CrearDescuento(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.CrearDescuento(c) }
}
func ActualizarDescuento(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ActualizarDescuento(c) }
}
func EliminarDescuento(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.EliminarDescuento(c) }
}
