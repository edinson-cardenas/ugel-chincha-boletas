package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"planillas-backend/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	cleanupOnce sync.Once
)

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func StartCleanupRoutines(db *gorm.DB) {
	cleanupOnce.Do(func() {
		go func() {
			for {
				time.Sleep(15 * time.Minute)
				db.Where("last_attempt < ?", time.Now().Add(-15*time.Minute)).Delete(&models.LoginAttempt{})
			}
		}()
		go func() {
			for {
				time.Sleep(1 * time.Hour)
				db.Where("token_expires_at IS NOT NULL AND token_expires_at < ?", time.Now()).Delete(&models.Usuario{})
			}
		}()
		log.Println("Cleanup routines started")
	})
}

func checkRateLimitDB(db *gorm.DB, ip string) bool {
	var attempt models.LoginAttempt
	result := db.Where("ip = ?", ip).First(&attempt)
	if result.Error != nil {
		db.Create(&models.LoginAttempt{IP: ip, Attempts: 1, LastAttempt: time.Now()})
		return true
	}
	if attempt.Attempts >= 5 {
		return false
	}
	db.Model(&attempt).Updates(map[string]interface{}{
		"attempts":     attempt.Attempts + 1,
		"last_attempt": time.Now(),
	})
	return true
}

func resetRateLimitDB(db *gorm.DB, ip string) {
	db.Where("ip = ?", ip).Delete(&models.LoginAttempt{})
}

func checkPasswordChangeRateLimit(db *gorm.DB, ip string) bool {
	var attempt models.LoginAttempt
	result := db.Where("ip = ?", ip).First(&attempt)
	if result.Error != nil {
		return true
	}
	if attempt.Attempts >= 5 {
		return false
	}
	db.Model(&attempt).Updates(map[string]interface{}{
		"attempts":     attempt.Attempts + 1,
		"last_attempt": time.Now(),
	})
	return true
}

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		c.Header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:")
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		c.Header("Pragma", "no-cache")
		c.Next()
	}
}

func getDB(c *gin.Context) *gorm.DB {
	return c.MustGet("db").(*gorm.DB)
}

func Login(c *gin.Context) {
	ip := c.ClientIP()
	db := getDB(c)
	if !checkRateLimitDB(db, ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Demasiados intentos. Espera un momento antes de intentar de nuevo."})
		return
	}

	var input struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var usuario models.Usuario
	if err := db.Where("email = ?", input.Email).First(&usuario).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales inválidas"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(usuario.PasswordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales inválidas"})
		return
	}

	resetRateLimitDB(db, ip)

	token := generateToken()
	tokenExpiresAt := time.Now().Add(24 * time.Hour)
	db.Model(&usuario).Updates(map[string]interface{}{
		"token":             token,
		"token_expires_at":  tokenExpiresAt,
	})

	isSecure := strings.HasPrefix(c.Request.Host, "localhost") || strings.HasPrefix(c.Request.Host, "127.")
	c.SetCookie(
		"auth_token",
		token,
		86400,
		"/",
		"",
		!isSecure,
		true,
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login exitoso",
		"token":   token,
		"user": gin.H{
			"id":               usuario.ID,
			"nombre":           usuario.Nombre,
			"email":            usuario.Email,
			"rol":              usuario.Rol,
			"password_changed": usuario.PasswordChanged,
		},
	})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := ""

		// Intentar leer de cookie httpOnly primero
		if cookieToken, err := c.Cookie("auth_token"); err == nil && cookieToken != "" {
			token = cookieToken
		}

		// Fallback: leer de header Authorization (para compatibilidad dev)
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

		db := getDB(c)

		var usuario models.Usuario
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

func CambiarPassword(c *gin.Context) {
	db := getDB(c)
	usuario, _ := c.Get("usuario")
	user := usuario.(models.Usuario)

	ip := c.ClientIP()
	if !checkPasswordChangeRateLimit(db, ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Demasiados intentos de cambio de contraseña. Espera un momento."})
		return
	}

	var input struct {
		PasswordActual string `json:"password_actual" binding:"required"`
		NuevaPassword  string `json:"nueva_password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.PasswordActual)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "La contraseña actual no es correcta"})
		return
	}

	if len(input.NuevaPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "La contraseña debe tener al menos 8 caracteres"})
		return
	}
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(input.NuevaPassword)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(input.NuevaPassword)
	hasSpecial := regexp.MustCompile(`[!@#$%^&*(),.?":{}|<>]`).MatchString(input.NuevaPassword)
	if !hasUpper || !hasNumber || !hasSpecial {
		c.JSON(http.StatusBadRequest, gin.H{"error": "La contraseña debe contener al menos una mayúscula, un número y un carácter especial"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.NuevaPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar la nueva contraseña"})
		return
	}

	db.Model(&user).Updates(map[string]interface{}{
		"password_hash":    string(hash),
		"password_changed": true,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Contraseña actualizada correctamente"})
}

func Logout(c *gin.Context) {
	db := getDB(c)
	usuario, _ := c.Get("usuario")
	user := usuario.(models.Usuario)

	db.Model(&user).Updates(map[string]interface{}{
		"token":            "",
		"token_expires_at": nil,
	})

	c.SetCookie("auth_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada correctamente"})
}

func ListarPersonal(c *gin.Context) {
	db := getDB(c)
	var personal []models.Personal
	var total int64

	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	sortBy := c.DefaultQuery("sort_by", "apellidos")
	sortOrder := c.DefaultQuery("sort_order", "asc")
	
	if limit > 100 { limit = 100 }
	offset := (page - 1) * limit

	// Validar campos de ordenamiento
	validSortFields := map[string]bool{"apellidos": true, "nombres": true, "dni": true, "created_at": true}
	if !validSortFields[sortBy] {
		sortBy = "apellidos"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "asc"
	}

	baseQuery := db.Model(&models.Personal{})

	// Filtro por búsqueda
	if search != "" {
		baseQuery = baseQuery.Where("nombres ILIKE ? OR apellidos ILIKE ? OR dni ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Filtro por puesto
	puesto := c.Query("puesto")
	if puesto != "" {
		baseQuery = baseQuery.Where("puesto ILIKE ?", "%"+puesto+"%")
	}

	// Filtro por RD
	rd := c.Query("rd")
	if rd != "" {
		baseQuery = baseQuery.Where("rd ILIKE ?", "%"+rd+"%")
	}

	// Filtro por UU
	uu := c.Query("uu")
	if uu != "" {
		baseQuery = baseQuery.Where("uu ILIKE ?", "%"+uu+"%")
	}

	// Filtro por institución educativa
	institucion := c.Query("institucion")
	if institucion != "" {
		baseQuery = baseQuery.Where("institucion ILIKE ?", "%"+institucion+"%")
	}

	// Filtro por distrito
	distrito := c.Query("distrito")
	if distrito != "" {
		baseQuery = baseQuery.Where("distrito ILIKE ?", "%"+distrito+"%")
	}

	// Filtro por mes/año de planilla
	mes := c.Query("mes")
	anio := c.Query("anio")
	if mes != "" && anio != "" {
		mesInt, _ := strconv.Atoi(mes)
		anioInt, _ := strconv.Atoi(anio)
		if mesInt >= 1 && mesInt <= 12 && anioInt >= 1900 {
			baseQuery = baseQuery.Where("EXISTS (SELECT 1 FROM planilla WHERE planilla.personal_id = personal.id AND planilla.mes = ? AND planilla.anio = ?)", mesInt, anioInt)
		}
	} else if anio != "" {
		anioInt, _ := strconv.Atoi(anio)
		if anioInt >= 1900 {
			baseQuery = baseQuery.Where("EXISTS (SELECT 1 FROM planilla WHERE planilla.personal_id = personal.id AND planilla.anio = ?)", anioInt)
		}
	}

	baseQuery.Count(&total)
	
	// Ordenar dinámicamente
	orderStr := sortBy
	if sortOrder == "desc" {
		orderStr += " DESC"
	} else {
		orderStr += " ASC"
	}
	// Agregar segundo ordenamiento por nombres si es apellido
	if sortBy == "apellidos" {
		orderStr += ", nombres ASC"
	}
	
	baseQuery.Offset(offset).Limit(limit).Order(orderStr).Find(&personal)

	c.JSON(http.StatusOK, gin.H{
		"data": personal,
		"total": total,
		"page": page,
		"limit": limit,
		"total_pages": (int(total) + limit - 1) / limit,
	})
}

func BuscarPersonal(c *gin.Context) {
	db := getDB(c)
	search := c.Query("q")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	if search == "" {
		c.JSON(http.StatusOK, gin.H{"data": []models.Personal{}})
		return
	}

	var personal []models.Personal
	db.Where("nombres ILIKE ? OR apellidos ILIKE ? OR dni ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%").
		Limit(limit).
		Order("apellidos, nombres").
		Find(&personal)

	c.JSON(http.StatusOK, gin.H{"data": personal})
}

func BuscarInstituciones(c *gin.Context) {
	db := getDB(c)
	q := c.Query("q")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	var results []string
	query := db.Model(&models.Personal{}).Select("DISTINCT institucion").Where("institucion IS NOT NULL AND institucion != ''")
	if q != "" {
		query = query.Where("institucion ILIKE ?", "%"+q+"%")
	}
	query.Order("institucion ASC").Limit(limit).Pluck("institucion", &results)

	c.JSON(http.StatusOK, gin.H{"data": results})
}

func BuscarDistritos(c *gin.Context) {
	db := getDB(c)
	q := c.Query("q")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	var results []string
	query := db.Model(&models.Personal{}).Select("DISTINCT distrito").Where("distrito IS NOT NULL AND distrito != ''")
	if q != "" {
		query = query.Where("distrito ILIKE ?", "%"+q+"%")
	}
	query.Order("distrito ASC").Limit(limit).Pluck("distrito", &results)

	c.JSON(http.StatusOK, gin.H{"data": results})
}

func ObtenerPersonal(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var personal models.Personal

	if err := db.First(&personal, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Personal no encontrado"})
		return
	}

	c.JSON(http.StatusOK, personal)
}

func CrearPersonal(c *gin.Context) {
	db := getDB(c)
	var personal models.Personal

	if err := c.ShouldBindJSON(&personal); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	personal.CreatedAt = time.Now()
	if err := db.Create(&personal).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear personal"})
		return
	}

	c.JSON(http.StatusCreated, personal)
}

func ActualizarPersonal(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var personal models.Personal

	if err := db.First(&personal, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Personal no encontrado"})
		return
	}

	var input struct {
		DNI         *string `json:"dni"`
		Nombres     *string `json:"nombres"`
		Apellidos   *string `json:"apellidos"`
		Puesto      *string `json:"puesto"`
		RD          *string `json:"rd"`
		UU          *string `json:"uu"`
		Institucion *string `json:"institucion"`
		Distrito    *string `json:"distrito"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	updates := map[string]interface{}{}
	if input.DNI != nil { updates["dni"] = *input.DNI }
	if input.Nombres != nil { updates["nombres"] = *input.Nombres }
	if input.Apellidos != nil { updates["apellidos"] = *input.Apellidos }
	if input.Puesto != nil { updates["puesto"] = *input.Puesto }
	if input.RD != nil { updates["rd"] = *input.RD }
	if input.UU != nil { updates["uu"] = *input.UU }
	if input.Institucion != nil { updates["institucion"] = *input.Institucion }
	if input.Distrito != nil { updates["distrito"] = *input.Distrito }

	if len(updates) == 0 {
		c.JSON(http.StatusOK, personal)
		return
	}

	if err := db.Model(&personal).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar"})
		return
	}

	db.First(&personal, id)
	c.JSON(http.StatusOK, personal)
}

func EliminarPersonal(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")

	if err := db.Delete(&models.Personal{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Eliminado correctamente"})
}

func ListarPlanillas(c *gin.Context) {
	db := getDB(c)
	var planillas []models.Planilla
	var total int64

	mes := c.Query("mes")
	anio := c.Query("anio")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	sortBy := c.DefaultQuery("sort_by", "anio")
	sortOrder := c.DefaultQuery("sort_order", "desc")
	
	if limit > 100 { limit = 100 }
	offset := (page - 1) * limit

	// Validar campos de ordenamiento
	validSortFields := map[string]bool{"anio": true, "mes": true, "total_haberes": true, "total_descuentos": true, "total_liquido": true, "created_at": true}
	if !validSortFields[sortBy] {
		sortBy = "anio"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	baseQuery := db.Model(&models.Planilla{}).Preload("Personal")

	if mes != "" {
		mesInt, _ := strconv.Atoi(mes)
		if mesInt > 0 && mesInt <= 12 {
			baseQuery = baseQuery.Where("mes = ?", mesInt)
		}
	}
	if anio != "" {
		anioInt, _ := strconv.Atoi(anio)
		if anioInt >= 1900 {
			baseQuery = baseQuery.Where("anio = ?", anioInt)
		}
	}
	if search != "" {
		baseQuery = baseQuery.Joins("JOIN personal ON personal.id = planilla.personal_id").
			Where("personal.nombres ILIKE ? OR personal.apellidos ILIKE ? OR personal.dni ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Filtro por rango de haberes
	minHaberes := c.Query("min_haberes")
	maxHaberes := c.Query("max_haberes")
	if minHaberes != "" {
		minVal, _ := strconv.ParseFloat(minHaberes, 64)
		if minVal > 0 {
			baseQuery = baseQuery.Where("total_haberes >= ?", minVal)
		}
	}
	if maxHaberes != "" {
		maxVal, _ := strconv.ParseFloat(maxHaberes, 64)
		if maxVal > 0 {
			baseQuery = baseQuery.Where("total_haberes <= ?", maxVal)
		}
	}

	// Filtro por rango de descuentos
	minDescuentos := c.Query("min_descuentos")
	maxDescuentos := c.Query("max_descuentos")
	if minDescuentos != "" {
		minVal, _ := strconv.ParseFloat(minDescuentos, 64)
		if minVal > 0 {
			baseQuery = baseQuery.Where("total_descuentos >= ?", minVal)
		}
	}
	if maxDescuentos != "" {
		maxVal, _ := strconv.ParseFloat(maxDescuentos, 64)
		if maxVal > 0 {
			baseQuery = baseQuery.Where("total_descuentos <= ?", maxVal)
		}
	}

	baseQuery.Count(&total)
	
	// Ordenar dinámicamente
	orderStr := sortBy
	if sortOrder == "desc" {
		orderStr += " DESC"
	} else {
		orderStr += " ASC"
	}
	if sortBy == "anio" {
		orderStr += ", mes DESC"
	}
	
	baseQuery.Offset(offset).Limit(limit).Order(orderStr).Find(&planillas)

	for i := range planillas {
		planillas[i].CalculateTotal()
	}

	c.JSON(http.StatusOK, gin.H{
		"data": planillas,
		"total": total,
		"page": page,
		"limit": limit,
		"total_pages": (int(total) + limit - 1) / limit,
	})
}

func ObtenerPlanilla(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var planilla models.Planilla

	if err := db.Preload("Personal").Preload("Ingresos").Preload("Descuentos").First(&planilla, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Planilla no encontrada"})
		return
	}

	planilla.CalculateTotal()
	c.JSON(http.StatusOK, planilla)
}

func EditarPlanillaCompleta(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")

	var planilla models.Planilla
	if err := db.Preload("Personal").Preload("Ingresos").Preload("Descuentos").First(&planilla, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Planilla no encontrada"})
		return
	}

	var input struct {
		PersonalID uint   `json:"personal_id"`
		Mes        int16  `json:"mes"`
		Anio       int16  `json:"anio"`
		Ingresos   []struct {
			ID    uint    `json:"id"`
			Tipo  string  `json:"tipo"`
			Monto float64 `json:"monto"`
		} `json:"ingresos"`
		Descuentos []struct {
			ID    uint    `json:"id"`
			Tipo  string  `json:"tipo"`
			Monto float64 `json:"monto"`
		} `json:"descuentos"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos: " + err.Error()})
		return
	}

	// Actualizar datos de planilla
	updates := map[string]interface{}{}
	if input.PersonalID > 0 && input.PersonalID != planilla.PersonalID {
		updates["personal_id"] = input.PersonalID
	}
	if input.Mes > 0 {
		updates["mes"] = input.Mes
	}
	if input.Anio > 0 {
		updates["anio"] = input.Anio
	}

	if len(updates) > 0 {
		db.Model(&planilla).Updates(updates)
	}

	// Actualizar ingresos existentes y agregar nuevos
	for _, ing := range input.Ingresos {
		if ing.ID > 0 {
			// Actualizar existente
			db.Model(&models.Ingreso{}).Where("id = ?", ing.ID).Updates(map[string]interface{}{
				"tipo":  ing.Tipo,
				"monto": ing.Monto,
			})
		} else if ing.Tipo != "" && ing.Monto > 0 {
			// Crear nuevo
			db.Create(&models.Ingreso{PlanillaID: planilla.ID, Tipo: ing.Tipo, Monto: ing.Monto})
		}
	}

	// Actualizar descuentos existentes y agregar nuevos
	for _, desc := range input.Descuentos {
		if desc.ID > 0 {
			db.Model(&models.Descuento{}).Where("id = ?", desc.ID).Updates(map[string]interface{}{
				"tipo":  desc.Tipo,
				"monto": desc.Monto,
			})
		} else if desc.Tipo != "" && desc.Monto > 0 {
			db.Create(&models.Descuento{PlanillaID: planilla.ID, Tipo: desc.Tipo, Monto: desc.Monto})
		}
	}

	// Recargar planilla y recalcular totales
	var totalHab, totalDesc float64
	db.Model(&models.Ingreso{}).Where("planilla_id = ?", planilla.ID).Select("COALESCE(SUM(monto), 0)").Scan(&totalHab)
	db.Model(&models.Descuento{}).Where("planilla_id = ?", planilla.ID).Select("COALESCE(SUM(monto), 0)").Scan(&totalDesc)
	db.Model(&planilla).Updates(map[string]interface{}{
		"total_haberes":    totalHab,
		"total_descuentos": totalDesc,
		"total_liquido":    totalHab - totalDesc,
	})

	db.Preload("Personal").Preload("Ingresos").Preload("Descuentos").First(&planilla, id)

	c.JSON(http.StatusOK, gin.H{"message": "Planilla actualizada", "planilla": planilla})
}

func CrearPlanilla(c *gin.Context) {
	db := getDB(c)
	var planilla models.Planilla

	if err := c.ShouldBindJSON(&planilla); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	planilla.CreadoEn = time.Now()

	var existing models.Planilla
	if err := db.Where("personal_id = ? AND mes = ? AND anio = ?", planilla.PersonalID, planilla.Mes, planilla.Anio).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Ya existe una planilla para este personal en el período"})
		return
	}

	if err := db.Create(&planilla).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear planilla"})
		return
	}

	c.JSON(http.StatusCreated, planilla)
}

func ActualizarPlanilla(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var planilla models.Planilla

	if err := db.First(&planilla, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Planilla no encontrada"})
		return
	}

	var input struct {
		PersonalID *uint   `json:"personal_id"`
		Mes        *int16  `json:"mes"`
		Anio       *int16  `json:"anio"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	updates := map[string]interface{}{}
	if input.PersonalID != nil {
		if *input.PersonalID != planilla.PersonalID {
			var existing models.Planilla
			mes := planilla.Mes
			anio := planilla.Anio
			if input.Mes != nil { mes = *input.Mes }
			if input.Anio != nil { anio = *input.Anio }
			if err := db.Where("personal_id = ? AND mes = ? AND anio = ? AND id != ?", *input.PersonalID, mes, anio, planilla.ID).First(&existing).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Ya existe una planilla para este personal en el período"})
				return
			}
			updates["personal_id"] = *input.PersonalID
		}
	}
	if input.Mes != nil { updates["mes"] = *input.Mes }
	if input.Anio != nil { updates["anio"] = *input.Anio }

	if len(updates) > 0 {
		if err := db.Model(&planilla).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar"})
			return
		}
	}

	db.First(&planilla, id)
	c.JSON(http.StatusOK, planilla)
}

func EliminarPlanilla(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")

	if err := db.Delete(&models.Planilla{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Eliminado correctamente"})
}

func ListarIngresos(c *gin.Context) {
	db := getDB(c)
	planillaID := c.Param("id")
	var ingresos []models.Ingreso

	db.Where("planilla_id = ?", planillaID).Find(&ingresos)
	c.JSON(http.StatusOK, ingresos)
}

func ListarDescuentos(c *gin.Context) {
	db := getDB(c)
	planillaID := c.Param("id")
	var descuentos []models.Descuento

	db.Where("planilla_id = ?", planillaID).Find(&descuentos)
	c.JSON(http.StatusOK, descuentos)
}

func CrearIngreso(c *gin.Context) {
	db := getDB(c)
	var ingreso models.Ingreso

	if err := c.ShouldBindJSON(&ingreso); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	if err := db.Create(&ingreso).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear ingreso"})
		return
	}

	c.JSON(http.StatusCreated, ingreso)
}

func ActualizarIngreso(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var ingreso models.Ingreso

	if err := db.First(&ingreso, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ingreso no encontrado"})
		return
	}

	var input struct {
		Tipo       *string  `json:"tipo"`
		Monto      *float64 `json:"monto"`
		Comentario *string  `json:"comentario"`
		PlanillaID *uint    `json:"planilla_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	updates := map[string]interface{}{}
	if input.Tipo != nil { updates["tipo"] = *input.Tipo }
	if input.Monto != nil { updates["monto"] = *input.Monto }
	if input.Comentario != nil { updates["comentario"] = *input.Comentario }
	if input.PlanillaID != nil && *input.PlanillaID != ingreso.PlanillaID {
		updates["planilla_id"] = *input.PlanillaID
	}

	if len(updates) == 0 {
		c.JSON(http.StatusOK, ingreso)
		return
	}

	db.Model(&ingreso).Updates(updates)

	planillaID := ingreso.PlanillaID
	if input.PlanillaID != nil { planillaID = *input.PlanillaID }
	var planilla models.Planilla
	db.First(&planilla, planillaID)
	db.Model(&planilla).Updates(map[string]interface{}{
		"total_haberes": gorm.Expr("COALESCE((SELECT SUM(monto) FROM ingresos WHERE planilla_id = ?), 0)", planillaID),
		"total_liquido": gorm.Expr("COALESCE((SELECT SUM(monto) FROM ingresos WHERE planilla_id = ?), 0) - COALESCE((SELECT SUM(monto) FROM descuentos WHERE planilla_id = ?), 0)", planillaID, planillaID),
	})

	c.JSON(http.StatusOK, ingreso)
}

func EliminarIngreso(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var ingreso models.Ingreso

	if err := db.First(&ingreso, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ingreso no encontrado"})
		return
	}

	planillaID := ingreso.PlanillaID
	db.Delete(&ingreso)

	var planilla models.Planilla
	db.First(&planilla, planillaID)
	db.Model(&planilla).Updates(map[string]interface{}{
		"total_haberes": gorm.Expr("COALESCE((SELECT SUM(monto) FROM ingresos WHERE planilla_id = ?), 0)", planillaID),
		"total_liquido": gorm.Expr("COALESCE((SELECT SUM(monto) FROM ingresos WHERE planilla_id = ?), 0) - COALESCE((SELECT SUM(monto) FROM descuentos WHERE planilla_id = ?), 0)", planillaID, planillaID),
	})

	c.JSON(http.StatusOK, gin.H{"message": "Eliminado correctamente"})
}

func CrearDescuento(c *gin.Context) {
	db := getDB(c)
	var descuento models.Descuento

	if err := c.ShouldBindJSON(&descuento); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	if err := db.Create(&descuento).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear descuento"})
		return
	}

	c.JSON(http.StatusCreated, descuento)
}

func ActualizarDescuento(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var descuento models.Descuento

	if err := db.First(&descuento, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Descuento no encontrado"})
		return
	}

	var input struct {
		Tipo       *string  `json:"tipo"`
		Monto      *float64 `json:"monto"`
		Comentario *string  `json:"comentario"`
		PlanillaID *uint    `json:"planilla_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	updates := map[string]interface{}{}
	if input.Tipo != nil { updates["tipo"] = *input.Tipo }
	if input.Monto != nil { updates["monto"] = *input.Monto }
	if input.Comentario != nil { updates["comentario"] = *input.Comentario }
	if input.PlanillaID != nil && *input.PlanillaID != descuento.PlanillaID {
		updates["planilla_id"] = *input.PlanillaID
	}

	if len(updates) == 0 {
		c.JSON(http.StatusOK, descuento)
		return
	}

	db.Model(&descuento).Updates(updates)

	planillaID := descuento.PlanillaID
	if input.PlanillaID != nil { planillaID = *input.PlanillaID }
	var planilla models.Planilla
	db.First(&planilla, planillaID)
	db.Model(&planilla).Updates(map[string]interface{}{
		"total_descuentos": gorm.Expr("COALESCE((SELECT SUM(monto) FROM descuentos WHERE planilla_id = ?), 0)", planillaID),
		"total_liquido":    gorm.Expr("COALESCE((SELECT SUM(monto) FROM ingresos WHERE planilla_id = ?), 0) - COALESCE((SELECT SUM(monto) FROM descuentos WHERE planilla_id = ?), 0)", planillaID, planillaID),
	})

	c.JSON(http.StatusOK, descuento)
}

func EliminarDescuento(c *gin.Context) {
	db := getDB(c)
	id := c.Param("id")
	var descuento models.Descuento

	if err := db.First(&descuento, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Descuento no encontrado"})
		return
	}

	planillaID := descuento.PlanillaID
	db.Delete(&descuento)

	var planilla models.Planilla
	db.First(&planilla, planillaID)
	db.Model(&planilla).Updates(map[string]interface{}{
		"total_descuentos": gorm.Expr("COALESCE((SELECT SUM(monto) FROM descuentos WHERE planilla_id = ?), 0)", planillaID),
		"total_liquido":    gorm.Expr("COALESCE((SELECT SUM(monto) FROM ingresos WHERE planilla_id = ?), 0) - COALESCE((SELECT SUM(monto) FROM descuentos WHERE planilla_id = ?), 0)", planillaID, planillaID),
	})

	c.JSON(http.StatusOK, gin.H{"message": "Eliminado correctamente"})
}

func importarData(db *gorm.DB, data *models.DataExcel) (int, int, []string) {
	personalCreados := 0
	planillasCreadas := 0
	warnings := []string{}

	// personalIDs[i] = DB id for data.Personal[i]
	personalIDs := make([]uint, len(data.Personal))

	for i, p := range data.Personal {
		var existing models.Personal
		found := false

		if p.DNI != "" {
			if err := db.Where("dni ILIKE ?", p.DNI).First(&existing).Error; err == nil {
				found = true
			}
		}
		if !found && p.Nombres != "" {
			if err := db.Where("nombres ILIKE ?", p.Nombres).First(&existing).Error; err == nil {
				found = true
			}
		}

		if found {
			personalIDs[i] = existing.ID
		} else if p.Nombres != "" {
			p.CreatedAt = time.Now()
			if err := db.Create(&p).Error; err == nil {
				personalIDs[i] = p.ID
				personalCreados++
			} else {
				warnings = append(warnings, fmt.Sprintf("No se pudo crear personal '%s': %v", p.Nombres, err))
			}
		} else {
			warnings = append(warnings, fmt.Sprintf("Bloque %d ignorado: sin nombre ni DNI", i+1))
		}
	}

	for i, pl := range data.Planillas {
		if i >= len(personalIDs) || personalIDs[i] == 0 {
			continue
		}
		personalID := personalIDs[i]

		var planilla models.Planilla
		db.Where("personal_id = ? AND mes = ? AND anio = ?", personalID, pl.Mes, pl.Anio).First(&planilla)

		if planilla.ID == 0 {
			planilla = models.Planilla{
				PersonalID: personalID,
				Mes:        int16(pl.Mes),
				Anio:       int16(pl.Anio),
				CreadoEn:   time.Now(),
			}
			db.Create(&planilla)
			planillasCreadas++

			for _, ing := range pl.Ingresos {
				db.Create(&models.Ingreso{PlanillaID: planilla.ID, Tipo: ing.Tipo, Monto: ing.Monto})
			}
			for _, desc := range pl.Descuentos {
				db.Create(&models.Descuento{PlanillaID: planilla.ID, Tipo: desc.Tipo, Monto: desc.Monto})
			}
		}

		// Recalculate totals
		var totalHab, totalDesc float64
		db.Model(&models.Ingreso{}).Where("planilla_id = ?", planilla.ID).
			Select("COALESCE(SUM(monto), 0)").Scan(&totalHab)
		db.Model(&models.Descuento{}).Where("planilla_id = ?", planilla.ID).
			Select("COALESCE(SUM(monto), 0)").Scan(&totalDesc)
		db.Model(&planilla).Updates(map[string]interface{}{
			"total_haberes":    totalHab,
			"total_descuentos": totalDesc,
		})
	}

	return personalCreados, planillasCreadas, warnings
}

func ImportarExcel(c *gin.Context) {
	db := getDB(c)

	// Read optional period override from form fields
	mesOverride := 0
	anioOverride := 0
	if ms := c.PostForm("mes"); ms != "" {
		if v, err := strconv.Atoi(ms); err == nil && v >= 1 && v <= 12 {
			mesOverride = v
		}
	}
	if ay := c.PostForm("anio"); ay != "" {
		if v, err := strconv.Atoi(ay); err == nil && v >= 2000 {
			anioOverride = v
		}
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No se pudo obtener el archivo"})
		return
	}

	filename := fmt.Sprintf("uploads/%d_%s", time.Now().Unix(), file.Filename)
	if err := c.SaveUploadedFile(file, filename); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar archivo: " + err.Error()})
		return
	}

	data, err := ReadExcelFile(filename)
	if err != nil {
		log.Printf("ReadExcelFile error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al leer Excel: " + err.Error()})
		return
	}

	if len(data.Planillas) == 0 && len(data.Personal) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message":           "No se encontraron datos en el archivo. Verifique el formato.",
			"personal_creados":  0,
			"planillas_creadas": 0,
			"personal":          0,
			"planillas":         0,
		})
		return
	}

	// Apply period override: user's selection always wins
	if mesOverride > 0 || anioOverride > 0 {
		for i := range data.Planillas {
			if mesOverride > 0 {
				data.Planillas[i].Mes = mesOverride
			}
			if anioOverride > 0 {
				data.Planillas[i].Anio = anioOverride
			}
		}
	}

	// Check if any planilla already exists for the periods being imported
	periodos := map[string]bool{}
	for _, pl := range data.Planillas {
		key := fmt.Sprintf("%d-%d", pl.Mes, pl.Anio)
		if !periodos[key] {
			periodos[key] = true
			var count int64
			db.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", pl.Mes, pl.Anio).Count(&count)
			if count > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Este mes y año ya fue importado antes: %d/%d", pl.Mes, pl.Anio)})
				return
			}
		}
	}

	personalCreados, planillasCreadas, warnings := importarData(db, data)
	c.JSON(http.StatusOK, gin.H{
		"message":           "Importación completada",
		"personal_creados":  personalCreados,
		"planillas_creadas": planillasCreadas,
		"personal":          len(data.Personal),
		"planillas":         len(data.Planillas),
		"errores":           warnings,
	})
}

func ImportarJSON(c *gin.Context) {
	db := getDB(c)

	var data models.DataExcel
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido: " + err.Error()})
		return
	}

	// Check if any planilla already exists for the periods being imported
	periodos := map[string]bool{}
	for _, pl := range data.Planillas {
		key := fmt.Sprintf("%d-%d", pl.Mes, pl.Anio)
		if !periodos[key] {
			periodos[key] = true
			var count int64
			db.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", pl.Mes, pl.Anio).Count(&count)
			if count > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Este mes y año ya fue importado antes: %d/%d", pl.Mes, pl.Anio)})
				return
			}
		}
	}

	personalCreados, planillasCreadas, warnings := importarData(db, &data)
	c.JSON(http.StatusOK, gin.H{
		"message":           "Importación completada",
		"personal_creados":  personalCreados,
		"planillas_creadas": planillasCreadas,
		"personal":          len(data.Personal),
		"planillas":         len(data.Planillas),
		"errores":           warnings,
	})
}

// ImportarHaberes handles the JSON payload produced by the Python extractor.
// Format: { mes, anio, total_empleados, empleados: [{nombre, cargo, resolucion, codigo, dni, haberes:[{concepto,monto}], descuentos:[{concepto,monto}], ...}] }
func ImportarHaberes(c *gin.Context) {
	db := getDB(c)

	var payload models.HaberesPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido: " + err.Error()})
		return
	}

	if payload.Mes == nil || payload.Anio == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Se requieren los campos mes y anio"})
		return
	}

	mes := *payload.Mes
	anio := *payload.Anio

	if mes < 1 || mes > 12 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mes inválido (debe ser 1-12)"})
		return
	}

	personalCreados := 0
	personalActualizados := 0
	planillasCreadas := 0
	duplicados := []string{}
	var warnings []string

	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Check if any planilla already exists for this period
	var count int64
	tx.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", mes, anio).Count(&count)
	if count > 0 {
		tx.Rollback()
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Este mes y año ya fue importado antes: %d/%d", mes, anio)})
		return
	}

	for _, emp := range payload.Empleados {
		var personal models.Personal
		found := false

		// ESTRATEGIA DE IDENTIFICACIÓN:
		// 1. Buscar por DNI exacto + verificar que el nombre coincida
		// 2. Si no tiene DNI, buscar por nombre
		// 3. Si no se encuentra en ningún caso, crear nuevo registro

		empHasDni := emp.DNI != nil && *emp.DNI != ""

		if empHasDni {
			var match models.Personal
			if err := tx.Where("dni = ?", *emp.DNI).First(&match).Error; err == nil {
				dbName := match.Apellidos + " " + match.Nombres
				empName := emp.Nombre
				norm := func(s string) string {
					fields := strings.Fields(strings.ToLower(s))
					return strings.Join(fields, " ")
				}
				if norm(dbName) == norm(empName) {
					personal = match
					found = true
				} else {
					duplicados = append(duplicados, fmt.Sprintf("DNI %s ya existe con nombre diferente (BD: '%s', Excel: '%s')", *emp.DNI, dbName, empName))
				}
			}
		}

		// Sólo buscar por nombre cuando el empleado NO tiene DNI
		// (El DNI es el identificador principal; si hay DNI no se debe reusar por nombre)
		if !found && !empHasDni && emp.Nombre != "" {
			var results []models.Personal
			parts := strings.Fields(strings.ToLower(emp.Nombre))
			if len(parts) >= 2 {
				medio := len(parts) / 2
				apellidos := strings.Join(parts[:medio], " ")
				nombres := strings.Join(parts[medio:], " ")
				tx.Where("LOWER(apellidos) = LOWER(?) AND LOWER(nombres) = LOWER(?)", apellidos, nombres).Find(&results)
			} else {
				tx.Where("LOWER(apellidos) = LOWER(?) OR LOWER(nombres) = LOWER(?)", emp.Nombre, emp.Nombre).Find(&results)
			}

			if len(results) == 1 {
				personal = results[0]
				found = true
			}
		}

		if !found {
			if emp.Nombre == "" {
				warnings = append(warnings, "Empleado ignorado: sin nombre")
				continue
			}

			parts := splitName(emp.Nombre)
			personal = models.Personal{
				Nombres:   parts.nombres,
				Apellidos: parts.apellidos,
				CreatedAt: time.Now(),
			}
			if emp.DNI != nil {
				personal.DNI = *emp.DNI
			}
			if emp.Cargo != nil {
				personal.Puesto = *emp.Cargo
			}
			if emp.Resolucion != nil {
				personal.RD = *emp.Resolucion
			}
			if emp.Codigo != nil {
				personal.UU = *emp.Codigo
			}
			if emp.Institucion != nil {
				personal.Institucion = *emp.Institucion
			}
			if emp.Distrito != nil {
				personal.Distrito = *emp.Distrito
			}
			if err := tx.Create(&personal).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error al crear personal '%s': %v", emp.Nombre, err)})
				return
			}
			personalCreados++
		} else {
			updates := map[string]interface{}{}
			if emp.DNI != nil && *emp.DNI != "" && personal.DNI == "" {
				updates["dni"] = *emp.DNI
			}
			if emp.Cargo != nil && *emp.Cargo != "" && personal.Puesto == "" {
				updates["puesto"] = *emp.Cargo
			}
			if emp.Resolucion != nil && *emp.Resolucion != "" && personal.RD == "" {
				updates["rd"] = *emp.Resolucion
			}
			if emp.Codigo != nil && *emp.Codigo != "" && personal.UU == "" {
				updates["uu"] = *emp.Codigo
			}
			if emp.Institucion != nil && *emp.Institucion != "" && personal.Institucion == "" {
				updates["institucion"] = *emp.Institucion
			}
			if emp.Distrito != nil && *emp.Distrito != "" && personal.Distrito == "" {
				updates["distrito"] = *emp.Distrito
			}
			if len(updates) > 0 {
				tx.Model(&personal).Updates(updates)
				personalActualizados++
			}
		}

		var planilla models.Planilla
		err := tx.Where("personal_id = ? AND mes = ? AND anio = ?", personal.ID, mes, anio).First(&planilla).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error al buscar planilla para '%s': %v", emp.Nombre, err)})
			return
		}

		if planilla.ID == 0 {
			planilla = models.Planilla{
				PersonalID: personal.ID,
				Mes:        int16(mes),
				Anio:       int16(anio),
				CreadoEn:   time.Now(),
			}
			if err := tx.Create(&planilla).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error al crear planilla para '%s': %v", emp.Nombre, err)})
				return
			}
			planillasCreadas++

			for _, h := range emp.Haberes {
				if err := tx.Create(&models.Ingreso{PlanillaID: planilla.ID, Tipo: h.Concepto, Monto: h.Monto}).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error al insertar ingreso '%s' para '%s': %v", h.Concepto, emp.Nombre, err)})
					return
				}
			}
			for _, d := range emp.Descuentos {
				if err := tx.Create(&models.Descuento{PlanillaID: planilla.ID, Tipo: d.Concepto, Monto: d.Monto}).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Error al insertar descuento '%s' para '%s': %v", d.Concepto, emp.Nombre, err)})
					return
				}
			}

			var tHab, tDesc float64
			tx.Model(&models.Ingreso{}).Where("planilla_id = ?", planilla.ID).Select("COALESCE(SUM(monto), 0)").Scan(&tHab)
			tx.Model(&models.Descuento{}).Where("planilla_id = ?", planilla.ID).Select("COALESCE(SUM(monto), 0)").Scan(&tDesc)
			tx.Model(&planilla).Updates(map[string]interface{}{
				"total_haberes":    tHab,
				"total_descuentos": tDesc,
				"total_liquido":    tHab - tDesc,
			})
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message":                "Importación completada",
		"personal_creados":       personalCreados,
		"personal_actualizados":  personalActualizados,
		"planillas_creadas":      planillasCreadas,
		"total_empleados":        len(payload.Empleados),
		"duplicados":             duplicados,
		"errores":                warnings,
	})
}

// splitName divide un nombre completo en nombres y apellidos
// Asume formato: "Apellidos Nombres" o "Nombres Apellidos"
func splitName(fullName string) struct {
	nombres   string
	apellidos string
} {
	parts := splitAndClean(fullName)
	if len(parts) == 0 {
		return struct{ nombres string; apellidos string }{nombres: fullName, apellidos: ""}
	}
	if len(parts) == 1 {
		return struct{ nombres string; apellidos string }{nombres: parts[0], apellidos: ""}
	}
	// Asumir que la primera parte es apellido (o primeros dos)
	if len(parts) >= 2 {
		// Primeras 1-2 partes como apellido, el resto como nombre
		apellidos := parts[0]
		if len(parts) > 2 {
			// Dos palabras seguidas podrían ser apellido compuesto
			apellidos = parts[0] + " " + parts[1]
			nombres := ""
			for i := 2; i < len(parts); i++ {
				if i > 2 {
					nombres += " "
				}
				nombres += parts[i]
			}
			return struct{ nombres string; apellidos string }{nombres: nombres, apellidos: apellidos}
		}
		nombres := ""
		for i := 1; i < len(parts); i++ {
			if i > 1 {
				nombres += " "
			}
			nombres += parts[i]
}
		return struct{ nombres string; apellidos string }{nombres: nombres, apellidos: parts[0]}
	}
	return struct{ nombres string; apellidos string }{nombres: fullName, apellidos: ""}
}

func splitAndClean(s string) []string {
	var parts []string
	word := ""
	for _, ch := range s {
		if ch == ' ' || ch == '\t' || ch == '\n' {
			if word != "" {
				parts = append(parts, word)
				word = ""
			}
		} else {
			word += string(ch)
		}
	}
	if word != "" {
		parts = append(parts, word)
	}
	return parts
}

func ResumenDashboard(c *gin.Context) {
	db := getDB(c)

	mesStr := c.Query("mes")
	anioStr := c.Query("anio")

	var totalPersonal int64
	var totalPlanillas int64
	var totalHaberes float64
	var totalDescuentos float64
	var planillasMes []models.Planilla

	if mesStr != "" && anioStr != "" {
		mes, err := strconv.Atoi(mesStr)
		if err != nil || mes < 1 || mes > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mes inválido"})
			return
		}
		anio, err := strconv.Atoi(anioStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Año inválido"})
			return
		}

		db.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", mes, anio).Select("COUNT(DISTINCT personal_id)").Scan(&totalPersonal)
		db.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", mes, anio).Count(&totalPlanillas)
		db.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", mes, anio).Select("COALESCE(SUM(total_haberes), 0)").Scan(&totalHaberes)
		db.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", mes, anio).Select("COALESCE(SUM(total_descuentos), 0)").Scan(&totalDescuentos)

		db.Where("mes = ? AND anio = ?", mes, anio).Preload("Personal").Find(&planillasMes)
	} else {
		db.Model(&models.Planilla{}).Select("COUNT(DISTINCT personal_id)").Scan(&totalPersonal)
		db.Model(&models.Planilla{}).Count(&totalPlanillas)
		db.Model(&models.Planilla{}).Select("COALESCE(SUM(total_haberes), 0)").Scan(&totalHaberes)
		db.Model(&models.Planilla{}).Select("COALESCE(SUM(total_descuentos), 0)").Scan(&totalDescuentos)

		db.Preload("Personal").Find(&planillasMes)
	}

	for i := range planillasMes {
		planillasMes[i].CalculateTotal()
	}

	c.JSON(http.StatusOK, gin.H{
		"total_personal":   totalPersonal,
		"total_planillas":  totalPlanillas,
		"total_haberes":    totalHaberes,
		"total_descuentos": totalDescuentos,
		"total_liquido":    totalHaberes - totalDescuentos,
		"planillas_mes":    planillasMes,
	})
}

// ObtenerPeriodosPersonal retorna los períodos (años y meses) disponibles de un empleado
func ObtenerPeriodosPersonal(c *gin.Context) {
	db := getDB(c)
	personalID := c.Param("id")

	var personal models.Personal
	if err := db.First(&personal, personalID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Personal no encontrado"})
		return
	}

	type Periodo struct {
		Anio int16 `json:"anio"`
		Mes  int16 `json:"mes"`
	}

	var periodos []Periodo
	db.Model(&models.Planilla{}).
		Select("DISTINCT anio, mes").
		Where("personal_id = ?", personalID).
		Order("anio DESC, mes DESC").
		Scan(&periodos)

	// Agrupar por año
	añosMap := make(map[int16][]int16)
	for _, p := range periodos {
		añosMap[p.Anio] = append(añosMap[p.Anio], p.Mes)
	}

	var años []int16
	for a := range añosMap {
		años = append(años, a)
	}
	// Ordenar años descendente
	for i := 0; i < len(años)-1; i++ {
		for j := i + 1; j < len(años); j++ {
			if años[j] > años[i] {
				años[i], años[j] = años[j], años[i]
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"años":     años,
		"meses":    añosMap,
		"total":    len(periodos),
	})
}

// ListarPeriodosImportados retorna los períodos (mes + año) que tienen planillas registradas
func ListarPeriodosImportados(c *gin.Context) {
	db := getDB(c)

	type Periodo struct {
		Anio int16 `json:"anio"`
		Mes  int16 `json:"mes"`
	}

	var periodos []Periodo
	db.Model(&models.Planilla{}).
		Select("DISTINCT anio, mes").
		Order("anio DESC, mes DESC").
		Scan(&periodos)

	// Agrupar por año
	añosMap := make(map[int16][]int16)
	for _, p := range periodos {
		añosMap[p.Anio] = append(añosMap[p.Anio], p.Mes)
	}

	var años []int16
	for a := range añosMap {
		años = append(años, a)
	}
	for i := 0; i < len(años)-1; i++ {
		for j := i + 1; j < len(años); j++ {
			if años[j] > años[i] {
				años[i], años[j] = años[j], años[i]
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"periodos": periodos,
		"años":     años,
		"meses":    añosMap,
		"total":    len(periodos),
	})
}

// LimpiarImportacion elimina todas las planillas, ingresos y descuentos de un período (mes/año)
func LimpiarImportacion(c *gin.Context) {
	db := getDB(c)

	mes := c.Query("mes")
	anio := c.Query("anio")

	if mes == "" || anio == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Se requieren los parámetros mes y anio"})
		return
	}

	mesInt, err := strconv.Atoi(mes)
	if err != nil || mesInt < 1 || mesInt > 12 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mes inválido (1-12)"})
		return
	}

	anioInt, err := strconv.Atoi(anio)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Año inválido"})
		return
	}

	var count int64
	db.Model(&models.Planilla{}).Where("mes = ? AND anio = ?", mesInt, anioInt).Count(&count)

	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("No hay planillas para %d/%d", mesInt, anioInt)})
		return
	}

	// Use transaction to ensure consistency
	tx := db.Begin()

	if err := tx.Exec("DELETE FROM ingresos WHERE planilla_id IN (SELECT id FROM planilla WHERE mes = ? AND anio = ?)", mesInt, anioInt).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar ingresos"})
		return
	}

	if err := tx.Exec("DELETE FROM descuentos WHERE planilla_id IN (SELECT id FROM planilla WHERE mes = ? AND anio = ?)", mesInt, anioInt).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar descuentos"})
		return
	}

	if err := tx.Where("mes = ? AND anio = ?", mesInt, anioInt).Delete(&models.Planilla{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar planillas"})
		return
	}

	// Eliminar personal huérfano (sin ninguna planilla)
	if err := tx.Exec("DELETE FROM personal WHERE id NOT IN (SELECT DISTINCT personal_id FROM planilla)").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar personal huérfano"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message":              fmt.Sprintf("Importación limpiada para periodo %d/%d", mesInt, anioInt),
		"planillas_eliminadas": count,
	})
}

// LimpiarTodoPersonal elimina TODOS los registros (personal, planillas, ingresos, descuentos)
func LimpiarTodoPersonal(c *gin.Context) {
	db := getDB(c)

	tx := db.Begin()

	if err := tx.Exec("DELETE FROM descuentos").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar descuentos"})
		return
	}

	if err := tx.Exec("DELETE FROM ingresos").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar ingresos"})
		return
	}

	if err := tx.Exec("DELETE FROM planilla").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar planillas"})
		return
	}

	if err := tx.Exec("DELETE FROM personal").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al limpiar personal"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "Todos los datos han sido eliminados correctamente",
	})
}

// ExportarPlanillasPersonal exporta las planillas de un empleado específico
func ExportarPlanillasPersonal(c *gin.Context) {
	db := getDB(c)
	personalID := c.Param("id")
	
	mes := c.Query("mes")
	anio := c.Query("anio")

	var personal models.Personal
	if err := db.First(&personal, personalID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Personal no encontrado"})
		return
	}

	baseQuery := db.Model(&models.Planilla{}).Preload("Personal").Preload("Ingresos").Preload("Descuentos")
	baseQuery = baseQuery.Where("personal_id = ?", personalID)

	if mes != "" {
		mesInt, _ := strconv.Atoi(mes)
		if mesInt > 0 && mesInt <= 12 {
			baseQuery = baseQuery.Where("mes = ?", mesInt)
		}
	}
	if anio != "" {
		anioInt, _ := strconv.Atoi(anio)
		if anioInt >= 1900 {
			baseQuery = baseQuery.Where("anio = ?", anioInt)
		}
	}

	var planillas []models.Planilla
	baseQuery.Order("anio DESC, mes DESC").Find(&planillas)

	for i := range planillas {
		planillas[i].CalculateTotal()
	}

	var totalHaberes, totalDescuentos, totalLiquido float64
	for _, p := range planillas {
		totalHaberes += p.TotalHaberes
		totalDescuentos += p.TotalDescuentos
		totalLiquido += p.TotalLiquido
	}

	c.JSON(http.StatusOK, gin.H{
		"personal": gin.H{
			"id":          personal.ID,
			"dni":         personal.DNI,
			"nombres":     personal.Nombres,
			"apellidos":   personal.Apellidos,
			"puesto":      personal.Puesto,
			"rd":          personal.RD,
			"uu":          personal.UU,
			"institucion": personal.Institucion,
			"distrito":    personal.Distrito,
		},
		"planillas":        planillas,
		"total_haberes":   totalHaberes,
		"total_descuentos": totalDescuentos,
		"total_liquido":    totalLiquido,
		"cantidad":         len(planillas),
	})
}
