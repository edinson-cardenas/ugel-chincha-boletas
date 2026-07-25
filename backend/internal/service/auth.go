package service

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"regexp"
	"sync"
	"time"

	"planillas-backend/internal/model"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var cleanupOnce sync.Once

func GenerateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func StartCleanupRoutines(db *gorm.DB) {
	cleanupOnce.Do(func() {
		go func() {
			for {
				time.Sleep(15 * time.Minute)
				db.Where("last_attempt < ?", time.Now().Add(-15*time.Minute)).Delete(&model.LoginAttempt{})
			}
		}()
		go func() {
			for {
				time.Sleep(1 * time.Hour)
				db.Where("token_expires_at IS NOT NULL AND token_expires_at < ?", time.Now()).
					Updates(map[string]interface{}{"token": "", "token_expires_at": nil})
			}
		}()
		log.Println("Cleanup routines started")
	})
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

var (
	hasUpper   = regexp.MustCompile(`[A-Z]`)
	hasNumber  = regexp.MustCompile(`[0-9]`)
	hasSpecial = regexp.MustCompile(`[!@#$%^&*(),.?":{}|<>]`)
)

func ValidatePasswordStrength(pw string) string {
	if len(pw) < 8 {
		return "La contraseña debe tener al menos 8 caracteres"
	}
	if !hasUpper.MatchString(pw) {
		return "La contraseña debe contener al menos una mayúscula"
	}
	if !hasNumber.MatchString(pw) {
		return "La contraseña debe contener al menos un número"
	}
	if !hasSpecial.MatchString(pw) {
		return "La contraseña debe contener al menos un carácter especial"
	}
	return ""
}

func CheckRateLimit(db *gorm.DB, ip string, maxAttempts int, window time.Duration) bool {
	var attempt model.LoginAttempt
	result := db.Where("ip = ?", ip).First(&attempt)

	if result.Error != nil {
		db.Create(&model.LoginAttempt{IP: ip, Attempts: 1, LastAttempt: time.Now()})
		return true
	}

	if time.Since(attempt.LastAttempt) > window {
		db.Model(&attempt).Updates(map[string]interface{}{
			"attempts": 1, "last_attempt": time.Now(),
		})
		return true
	}

	if attempt.Attempts >= maxAttempts {
		return false
	}

	db.Model(&attempt).Updates(map[string]interface{}{
		"attempts": attempt.Attempts + 1, "last_attempt": time.Now(),
	})
	return true
}

func ResetRateLimit(db *gorm.DB, ip string) {
	db.Where("ip = ?", ip).Delete(&model.LoginAttempt{})
}
