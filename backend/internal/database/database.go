package database

import (
	"log"
	"time"

	"planillas-backend/internal/model"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Error conectando a la base de datos:", err)
	}

	err = db.AutoMigrate(
		&model.Usuario{},
		&model.Personal{},
		&model.Planilla{},
		&model.Ingreso{},
		&model.Descuento{},
		&model.LoginAttempt{},
		&model.BoletaOCR{},
	)
	if err != nil {
		log.Fatal("Error en migración:", err)
	}

	seedAdminUsers(db)

	log.Println("Base de datos conectada correctamente")
	return db
}

func seedAdminUsers(db *gorm.DB) {
	var count int64
	db.Model(&model.Usuario{}).Count(&count)
	if count == 0 {
		hashAdmin, _ := bcrypt.GenerateFromPassword([]byte("Admin2026*"), bcrypt.DefaultCost)
		admin := model.Usuario{
			Nombre:          "Administrador",
			Email:           "admin@planillas.su",
			PasswordHash:    string(hashAdmin),
			Rol:             "admin",
			PasswordChanged: true,
			CreatedAt:       time.Now(),
		}
		db.Create(&admin)

		hashAyudante, _ := bcrypt.GenerateFromPassword([]byte("Asistente2026*"), bcrypt.DefaultCost)
		ayudante := model.Usuario{
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
