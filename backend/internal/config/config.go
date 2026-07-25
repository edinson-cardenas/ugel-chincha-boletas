package config

import "os"

type Config struct {
	DatabaseURL string
	Port        string
	CORSOrigins string
}

func Load() *Config {
	cfg := &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://planillas:planillas2024@localhost:5432/planillas?sslmode=disable"),
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
