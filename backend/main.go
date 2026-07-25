package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"planillas-backend/handlers"
	"planillas-backend/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://planillas:planillas2024@postgres:5432/planillas?sslmode=disable"
	}

	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Error conectando a la base de datos:", err)
	}

	db.AutoMigrate(
		&models.Usuario{},
		&models.Personal{},
		&models.Planilla{},
		&models.Ingreso{},
		&models.Descuento{},
		&models.LoginAttempt{},
	)

	crearUsuarioAdmin()
	handlers.StartCleanupRoutines(db)

	log.Println("Base de datos conectada correctamente")
}

func crearUsuarioAdmin() {
	var count int64
	db.Model(&models.Usuario{}).Count(&count)
	if count == 0 {
		hashAdmin, _ := bcrypt.GenerateFromPassword([]byte("Admin2026*"), bcrypt.DefaultCost)
		admin := models.Usuario{
			Nombre:          "Administrador",
			Email:           "admin@planillas.su",
			PasswordHash:    string(hashAdmin),
			Rol:             "admin",
			PasswordChanged: true,
			CreatedAt:       time.Now(),
		}
		db.Create(&admin)

		hashAyudante, _ := bcrypt.GenerateFromPassword([]byte("Asistente2026*"), bcrypt.DefaultCost)
		ayudante := models.Usuario{
			Nombre:          "Asistente",
			Email:           "asistente@planillas.su",
			PasswordHash:    string(hashAyudante),
			Rol:             "ayudante",
			PasswordChanged: true,
			CreatedAt:       time.Now(),
		}
		db.Create(&ayudante)

		log.Println("Usuarios creados:")
		log.Println("  admin: admin@planillas.su")
		log.Println("  ayudante: asistente@planillas.su")
	}
}

func main() {
	initDB()

	if err := os.MkdirAll("uploads", 0755); err != nil {
		log.Printf("Warning: could not create uploads dir: %v", err)
	}

	r := gin.Default()

	// CORS middleware
	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost,http://localhost:5173,http://localhost:80,http://127.0.0.1,http://127.0.0.1:5173"
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     strings.Split(corsOrigins, ","),
		AllowCredentials: true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		MaxAge:           12 * time.Hour,
	}))

	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	})
	r.Use(handlers.SecurityHeaders())

	r.Static("/uploads", "./uploads")

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	{
		api.POST("/usuarios/login", handlers.Login)
		api.POST("/importar/haberes", handlers.ImportarHaberes)
		api.GET("/personal/:id/exportar", handlers.ExportarPlanillasPersonal)
		api.POST("/process-excel", handlers.ProcessExcel)
		api.POST("/validate-excel", handlers.ValidateExcel)

		protected := api.Group("")
		protected.Use(handlers.AuthMiddleware())
		{
			usuarios := protected.Group("/usuarios")
			{
				usuarios.PUT("/cambiar-password", handlers.CambiarPassword)
				usuarios.POST("/logout", handlers.Logout)
			}

			personal := protected.Group("/personal")
			{
				personal.GET("", handlers.ListarPersonal)
				personal.GET("/buscar", handlers.BuscarPersonal)
				personal.GET("/instituciones", handlers.BuscarInstituciones)
				personal.GET("/distritos", handlers.BuscarDistritos)
				personal.GET("/:id", handlers.ObtenerPersonal)
				personal.POST("", handlers.CrearPersonal)
				personal.PUT("/:id", handlers.ActualizarPersonal)
				personal.DELETE("/:id", handlers.EliminarPersonal)
				personal.GET("/:id/periodos", handlers.ObtenerPeriodosPersonal)
			}

			planillas := protected.Group("/planillas")
			{
				planillas.GET("", handlers.ListarPlanillas)
				planillas.GET("/:id", handlers.ObtenerPlanilla)
				planillas.POST("", handlers.CrearPlanilla)
				planillas.PUT("/:id", handlers.ActualizarPlanilla)
				planillas.DELETE("/:id", handlers.EliminarPlanilla)
				planillas.GET("/:id/ingresos", handlers.ListarIngresos)
				planillas.GET("/:id/descuentos", handlers.ListarDescuentos)
				planillas.PUT("/:id/editar", handlers.EditarPlanillaCompleta)
			}

			ingresos := protected.Group("/ingresos")
			{
				ingresos.POST("", handlers.CrearIngreso)
				ingresos.PUT("/:id", handlers.ActualizarIngreso)
				ingresos.DELETE("/:id", handlers.EliminarIngreso)
			}

			descuentos := protected.Group("/descuentos")
			{
				descuentos.POST("", handlers.CrearDescuento)
				descuentos.PUT("/:id", handlers.ActualizarDescuento)
				descuentos.DELETE("/:id", handlers.EliminarDescuento)
			}

			importar := protected.Group("/importar")
			{
				importar.POST("/excel", handlers.ImportarExcel)
				importar.POST("/json", handlers.ImportarJSON)
				importar.DELETE("/limpiar", handlers.LimpiarImportacion)
				importar.DELETE("/limpiar-todo", handlers.LimpiarTodoPersonal)
				importar.GET("/periodos", handlers.ListarPeriodosImportados)
			}

			dashboard := protected.Group("/dashboard")
			{
				dashboard.GET("/resumen", handlers.ResumenDashboard)
			}

			protected.POST("/export-excel", handlers.ExportExcel)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

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
