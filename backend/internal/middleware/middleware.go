package middleware

import (
	"net/http"
	"strings"
	"time"

	"planillas-backend/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func AuthMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := ""

		if cookieToken, err := c.Cookie("auth_token"); err == nil && cookieToken != "" {
			token = cookieToken
		}

		if token == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" && len(authHeader) >= 7 && authHeader[:7] == "Bearer " {
				token = authHeader[7:]
			}
		}

		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token requerido"})
			return
		}

		var usuario model.Usuario
		if err := db.Where("token = ?", token).First(&usuario).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sesión inválida o expirada"})
			return
		}

		if usuario.TokenExpiresAt != nil && usuario.TokenExpiresAt.Before(time.Now()) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sesión expirada"})
			return
		}

		c.Set("usuario", usuario)
		c.Set("user_id", usuario.ID)
		c.Set("user_rol", usuario.Rol)
		c.Next()
	}
}

func DB(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	}
}

func CORS(origins string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigins := strings.Split(origins, ",")

		allowed := false
		for _, o := range allowedOrigins {
			if strings.TrimSpace(o) == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
			c.Header("Access-Control-Max-Age", "43200")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func RateLimiter(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		maxAttempts := 5
		window := 15 * time.Minute

		if strings.Contains(path, "/cambiar-password") {
			maxAttempts = 5
			window = 1 * time.Minute
		}

		ip := c.ClientIP()
		var attempt model.LoginAttempt
		result := db.Where("ip = ?", ip).First(&attempt)

		if result.Error == nil {
			if time.Since(attempt.LastAttempt) > window {
				db.Model(&attempt).Updates(map[string]interface{}{
					"attempts": 1, "last_attempt": time.Now(),
				})
			} else if attempt.Attempts >= maxAttempts {
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Demasiados intentos. Espera un momento."})
				return
			} else {
				db.Model(&attempt).Updates(map[string]interface{}{
					"attempts": attempt.Attempts + 1, "last_attempt": time.Now(),
				})
			}
		} else {
			db.Create(&model.LoginAttempt{IP: ip, Attempts: 1, LastAttempt: time.Now()})
		}

		c.Next()
	}
}
