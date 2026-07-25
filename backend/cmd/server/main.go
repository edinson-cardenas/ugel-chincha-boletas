package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"planillas-backend/internal/config"
	"planillas-backend/internal/database"
	"planillas-backend/internal/handler"
	"planillas-backend/internal/middleware"
	"planillas-backend/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	db := database.Connect(cfg.DatabaseURL)
	service.StartCleanupRoutines(db)

	if err := os.MkdirAll("uploads", 0755); err != nil {
		log.Printf("Warning: could not create uploads dir: %v", err)
	}

	r := gin.Default()

	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.CORS(cfg.CORSOrigins))
	r.Use(middleware.DB(db))

	r.Static("/uploads", "./uploads")

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	{
		// Rate-limited public routes
		limited := api.Group("")
		limited.Use(middleware.RateLimiter(db))
		{
			limited.POST("/usuarios/login", handler.Login(db))
		}

		api.POST("/importar/haberes", handler.ImportarHaberes(db))
		api.GET("/personal/:id/exportar", handler.ExportarPlanillasPersonal(db))
		api.POST("/process-excel", handler.ProcessExcel(db))
		api.POST("/validate-excel", handler.ValidateExcel(db))

		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(db))
		protected.Use(middleware.RateLimiter(db))
		{
			usuarios := protected.Group("/usuarios")
			{
				usuarios.PUT("/cambiar-password", handler.CambiarPassword(db))
				usuarios.POST("/logout", handler.Logout(db))
			}

			personal := protected.Group("/personal")
			{
				personal.GET("", handler.ListarPersonal(db))
				personal.GET("/buscar", handler.BuscarPersonal(db))
				personal.GET("/instituciones", handler.BuscarInstituciones(db))
				personal.GET("/distritos", handler.BuscarDistritos(db))
				personal.GET("/:id", handler.ObtenerPersonal(db))
				personal.POST("", handler.CrearPersonal(db))
				personal.PUT("/:id", handler.ActualizarPersonal(db))
				personal.DELETE("/:id", handler.EliminarPersonal(db))
				personal.GET("/:id/periodos", handler.ObtenerPeriodosPersonal(db))
			}

			planillas := protected.Group("/planillas")
			{
				planillas.GET("", handler.ListarPlanillas(db))
				planillas.GET("/:id", handler.ObtenerPlanilla(db))
				planillas.POST("", handler.CrearPlanilla(db))
				planillas.PUT("/:id", handler.ActualizarPlanilla(db))
				planillas.DELETE("/:id", handler.EliminarPlanilla(db))
				planillas.GET("/:id/ingresos", handler.ListarIngresos(db))
				planillas.GET("/:id/descuentos", handler.ListarDescuentos(db))
				planillas.PUT("/:id/editar", handler.EditarPlanillaCompleta(db))
			}

			ingresos := protected.Group("/ingresos")
			{
				ingresos.POST("", handler.CrearIngreso(db))
				ingresos.PUT("/:id", handler.ActualizarIngreso(db))
				ingresos.DELETE("/:id", handler.EliminarIngreso(db))
			}

			descuentos := protected.Group("/descuentos")
			{
				descuentos.POST("", handler.CrearDescuento(db))
				descuentos.PUT("/:id", handler.ActualizarDescuento(db))
				descuentos.DELETE("/:id", handler.EliminarDescuento(db))
			}

			importar := protected.Group("/importar")
			{
				importar.POST("/excel", handler.ImportarExcel(db))
				importar.POST("/json", handler.ImportarJSON(db))
				importar.DELETE("/limpiar", handler.LimpiarImportacion(db))
				importar.DELETE("/limpiar-todo", handler.LimpiarTodoPersonal(db))
				importar.GET("/periodos", handler.ListarPeriodosImportados(db))
			}

			dashboard := protected.Group("/dashboard")
			{
				dashboard.GET("/resumen", handler.ResumenDashboard(db))
			}

			ocr := protected.Group("/ocr")
			{
				ocr.POST("/scan", handler.OcrScanner(db))
				ocr.POST("/scan-batch", handler.OcrScanBatch(db))
				ocr.GET("/boletas", handler.ListarBoletasOCR(db))
				ocr.DELETE("/boletas/:id", handler.EliminarBoletaOCR(db))
				ocr.GET("/exportar", handler.ExportarBoletasExcel(db))
			}

			protected.POST("/export-excel", handler.ExportExcel(db))
		}
	}

	port := cfg.Port
	log.Printf("Servidor iniciado en el puerto %s", port)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 300 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil {
		fmt.Println("Error al iniciar el servidor:", err)
	}
}
