package handler

import (
	"planillas-backend/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListarPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ListarPersonal(c) }
}
func BuscarPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.BuscarPersonal(c) }
}
func BuscarInstituciones(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.BuscarInstituciones(c) }
}
func BuscarDistritos(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.BuscarDistritos(c) }
}
func ObtenerPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ObtenerPersonal(c) }
}
func CrearPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.CrearPersonal(c) }
}
func ActualizarPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ActualizarPersonal(c) }
}
func EliminarPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.EliminarPersonal(c) }
}
func ObtenerPeriodosPersonal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ObtenerPeriodosPersonal(c) }
}
