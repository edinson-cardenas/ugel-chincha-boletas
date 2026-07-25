package handler

import (
	"planillas-backend/handlers"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ExportExcel(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ExportExcel(c) }
}
func ResumenDashboard(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("db", db); handlers.ResumenDashboard(c) }
}
