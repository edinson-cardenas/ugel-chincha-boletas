package config

import (
	"log"
	"os"
)

type Config struct {
	DatabaseURL string
	Port        string
	CORSOrigins string
}

func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("❌ DATABASE_URL no está configurada. Debes establecer esta variable de entorno.\n" +
			"   Ejemplo: postgresql://postgres:password@db.xxx.supabase.co:6543/postgres")
	}
	cfg := &Config{
		DatabaseURL: dbURL,
		Port:        getEnv("PORT", "8080"),
		CORSOrigins: getEnv("CORS_ORIGINS", "http://localhost,http://localhost:5173,http://localhost:80,http://127.0.0.1,http://127.0.0.1:5173"),
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
