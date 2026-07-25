package database

import (
	"context"
	"log"
	"net"
	"time"

	"planillas-backend/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(dsn string) *gorm.DB {
	connConfig, err := pgx.ParseConfig(dsn)
	if err != nil {
		log.Fatal("Error parseando DSN:", err)
	}

	// Forzar IPv4: Render no soporta IPv6 para Supabase
	connConfig.LookupFunc = func(ctx context.Context, host string) ([]string, error) {
		ips, err := net.DefaultResolver.LookupHost(ctx, host)
		if err != nil {
			return nil, err
		}
		// Filtrar solo IPv4
		var ipv4 []string
		for _, ip := range ips {
			if parsed := net.ParseIP(ip); parsed != nil && parsed.To4() != nil {
				ipv4 = append(ipv4, ip)
			}
		}
		if len(ipv4) > 0 {
			return ipv4, nil
		}
		return ips, nil // fallback a todas si no hay IPv4
	}

	sqlDB := stdlib.OpenDB(*connConfig)
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{})
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
