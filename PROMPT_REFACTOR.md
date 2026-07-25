# Prompt de Refactorización — Sistema de Gestión de Planillas SU

## Stack objetivo

| Capa | Tecnología | Plataforma |
|---|---|---|
| Frontend | React 18 + Vite + TailwindCSS + TypeScript | **Vercel** |
| Backend | Go 1.25+ + Gin + GORM | **Fly.io** |
| Base de datos | PostgreSQL 18 | **Supabase** (gratuito, 500 MB) |
| Dev local | Docker Compose (3 servicios: postgres, backend, frontend) | — |
| Procesamiento Excel | Go (excelize) — se omite el servicio Python | — |

---

## FASE 1 — Seguridad (crítico, hacer primero)

### 1.1 Mass Assignment Protection
- **Archivos**: `backend/handlers/handlers.go` líneas ~367, ~634, ~705, ~773
- **Problema**: `ActualizarPersonal`, `ActualizarPlanilla`, `ActualizarIngreso`, `ActualizarDescuento` reciben `map[string]interface{}` y lo pasan directamente a `db.Model().Updates()`. Un atacante puede modificar campos como `id`, `password_hash`, etc.
- **Solución**: Cambiar `map[string]interface{}` por structs tipados con solo los campos permitidos. Ejemplo para `ActualizarPersonal`:
  ```go
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
  ```
- Aplicar el mismo patrón a los otros 3 handlers.

### 1.2 Token Expiry
- **Archivo**: `backend/handlers/handlers.go` líneas 95-96, `backend/models/models.go`
- **Problema**: Los tokens nunca expiran. Se generan con `generateToken()`, se guardan en BD y nunca se invalidan.
- **Solución**:
  - Agregar campo `TokenExpiresAt time.Time` al modelo `Usuario`
  - En `Login`, establecer expiración a 24h: `tokenExpiresAt := time.Now().Add(24 * time.Hour)`
  - En `AuthMiddleware`, verificar `tokenExpiresAt.After(time.Now())`
  - Agregar una goroutine de limpieza que cada 1h borre tokens expirados: `DELETE FROM usuarios WHERE token_expires_at < NOW()`
  - Bonus: agregar endpoint `POST /api/usuarios/logout` que borre el token

### 1.3 Rate Limiting Persistente
- **Archivo**: `backend/handlers/handlers.go` líneas 22-47
- **Problema**: `loginAttempts` es un `map[string]int` en memoria. Se pierde al reiniciar, no escala con múltiples instancias, y nunca se limpian entradas viejas (memory leak).
- **Solución**:
  - Reemplazar con un middleware de rate limiting basado en Redis o en PostgreSQL (tabla `rate_limits` con TTL)
  - Para simplificar sin Redis: crear una tabla `login_attempts(ip TEXT, attempts INT, last_attempt TIMESTAMPTZ, PRIMARY KEY (ip))` con goroutine de limpieza cada 15 min
  - Agregar rate limiting también a `/api/usuarios/cambiar-password` (5 intentos por minuto)

### 1.4 Token Storage — localStorage → httpOnly Cookie
- **Archivos**: `frontend/src/pages/Auth.tsx` línea 39, `frontend/src/services/api.ts` línea 18
- **Problema**: El token JWT/bearer se guarda en `localStorage`, accesible por cualquier script (XSS).
- **Solución**:
  - Backend: en `Login`, setear cookie httpOnly con `Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
  - Backend: en `AuthMiddleware`, leer token de cookie además del header Authorization
  - Frontend: eliminar `localStorage.setItem('auth_token', ...)`, el navegador envía la cookie automáticamente
  - `api.ts`: el interceptor ya no necesita agregar el header (la cookie viaja sola), mantener compatibilidad con header para desarrollo local

### 1.5 Password Strength Validation
- **Archivo**: `backend/handlers/handlers.go` líneas 142-174
- **Problema**: `CambiarPassword` muestra mensaje "al menos 6 caracteres" pero no lo valida realmente. Acepta cualquier string.
- **Solución**: Agregar validación real:
  ```go
  if len(input.NuevaPassword) < 8 {
      c.JSON(400, gin.H{"error": "La contraseña debe tener al menos 8 caracteres"})
      return
  }
  // Bonus: verificar mayúscula, número, carácter especial
  hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(input.NuevaPassword)
  hasNumber := regexp.MustCompile(`[0-9]`).MatchString(input.NuevaPassword)
  if !hasUpper || !hasNumber {
      c.JSON(400, gin.H{"error": "La contraseña debe contener al menos una mayúscula y un número"})
      return
  }
  ```

### 1.6 Eliminar credenciales expuestas
- **Archivo**: `docker-compose.yml` línea 8
- **Problema**: `DATABASE_URL` contiene las credenciales reales de Neon.
- **Solución**: 
  - Mover a `.env`: `DATABASE_URL=postgres://...`
  - Agregar `.env` al `.gitignore`
  - Crear `.env.example` sin secretos reales
  - ⚠️ **Rotar la contraseña de Neon inmediatamente** — ya está expuesta en el código

### 1.7 Security Headers Faltantes
- **Archivo**: `backend/handlers/handlers.go` línea 49 (`SecurityHeaders`)
- **Problema**: Faltan headers de seguridad importantes.
- **Solución**: Agregar al middleware existente:
  ```go
  c.Header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:")
  c.Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  c.Header("Pragma", "no-cache")
  ```

---

## FASE 2 — Estructura del proyecto (refactorización)

### 2.1 Reorganizar backend con arquitectura limpia

Estructura actual (problemática):
```
backend/
├── handlers/     ← 1602 líneas en handlers.go, todo mezclado
│   ├── handlers.go      (auth, personal, planillas, ingresos, descuentos, importación, dashboard)
│   ├── excel.go         (solo lectura de Excel)
│   ├── excel_extract.go (extracción de empleados, 760 líneas)
│   ├── excel_export.go  (exportación, 336 líneas)
│   └── excel_routes.go  (rutas de procesamiento, 790 líneas)
├── models/
│   └── models.go
├── main.go              (205 líneas: DB init, rutas, CORS, creación de usuarios admin)
├── Dockerfile
├── go.mod
└── go.sum
```

Estructura objetivo:
```
backend/
├── cmd/
│   └── server/
│       └── main.go              ← solo entry point (~30 líneas)
├── internal/
│   ├── config/
│   │   └── config.go            ← carga de env vars (DATABASE_URL, PORT, CORS_ORIGINS, etc.)
│   ├── middleware/
│   │   ├── auth.go              ← AuthMiddleware + SecurityHeaders
│   │   ├── cors.go              ← CORS config
│   │   ├── ratelimit.go         ← Rate limiting (login, password change)
│   │   └── db.go                ← Inyección de DB en contexto
│   ├── handler/
│   │   ├── auth.go              ← Login, CambiarPassword (solo HTTP, delega a service)
│   │   ├── personal.go          ← CRUD personal + búsqueda
│   │   ├── planilla.go          ← CRUD planillas + ingresos/descuentos
│   │   ├── excel.go             ← ProcessExcel, ValidateExcel, ImportarExcel, ImportarJSON
│   │   ├── export.go            ← ExportarPlanillasPersonal, ExportExcel
│   │   └── dashboard.go         ← ResumenDashboard
│   ├── service/
│   │   ├── auth.go              ← Lógica: login, token generation, password hashing
│   │   ├── personal.go          ← Lógica de negocio de personal
│   │   ├── planilla.go          ← Lógica de planillas, cálculo de totales
│   │   ├── excel.go             ← Lógica de extracción, análisis de duplicados, importación
│   │   └── export.go            ← Lógica de exportación Excel
│   ├── repository/
│   │   ├── personal.go          ← Queries GORM para personal
│   │   ├── planilla.go          ← Queries GORM para planillas
│   │   ├── usuario.go           ← Queries GORM para usuarios
│   │   └── excel.go             ← Queries de importación masiva
│   └── model/
│       ├── usuario.go
│       ├── personal.go
│       ├── planilla.go
│       ├── ingreso.go
│       ├── descuento.go
│       └── excel.go             ← DataExcel, PlanillaImport, HaberesPayload, extractedEmployee...
├── Dockerfile
├── fly.toml                     ← Config de Fly.io (nuevo)
├── .dockerignore                ← (nuevo)
├── go.mod
└── go.sum
```

### 2.2 Separar modelos en archivos individuales
- `models/models.go` → partir en `usuario.go`, `personal.go`, `planilla.go`, `ingreso.go`, `descuento.go`, `excel.go`
- Cada archivo con su struct + métodos asociados (ej: `CalculateTotal()` en `planilla.go`)

### 2.3 Extraer `main.go`
- Mover la lógica de inicialización de BD a `internal/config/config.go` o `internal/database/database.go`
- Mover la creación de usuarios admin a `internal/service/auth.go` (función `SeedAdminUsers`)
- `main.go` debe ser ~30 líneas: cargar config, conectar BD, crear router, iniciar servidor

### 2.4 Separar handlers por dominio
- `handlers.go` (1602 líneas) → dividir en `auth.go`, `personal.go`, `planilla.go`, `excel.go`, `export.go`, `dashboard.go`
- `excel_routes.go` (790 líneas) → merge con `excel.go`
- `excel_extract.go` (760 líneas) → mover lógica pura a `internal/service/excel.go`

### 2.5 Agregar capa de servicio (service layer)
- Los handlers solo deben: parsear request → llamar service → devolver response
- Lógica de negocio va en services (testeable sin HTTP)
- Operaciones de BD van en repositories (testeable con mocks)

---

## FASE 3 — Docker & DevOps

### 3.1 Reconstruir docker-compose.yml
- 3 servicios: postgres + backend + frontend
- PostgreSQL local con healthcheck
- Volumen persistente `postgres_data`
- Variables de entorno desde `.env`
- `init.sql` montado como entrypoint de PostgreSQL
- Eliminar dependencia de Neon para desarrollo local

### 3.2 Crear .env.example
```
# PostgreSQL
DB_USER=planillas
DB_PASSWORD=planillas2024
DB_NAME=planillas
DB_PORT=5432

# Backend
PORT=8080
CORS_ORIGINS=http://localhost:5173
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@postgres:${DB_PORT}/${DB_NAME}?sslmode=disable

# Frontend (Vercel)
VITE_API_URL=http://localhost:8080
```

### 3.3 Configurar Fly.io (fly.toml)
```toml
app = "planillas-api"
primary_region = "mia"  # Miami (más cercano a Perú)

[build]
  image = "golang:1.25-alpine"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### 3.4 Actualizar vercel.json
- Cambiar proxy destination de Render a Fly.io:
  ```json
  { "source": "/api/(.*)", "destination": "https://planillas-api.fly.dev/api/$1" }
  { "source": "/uploads/(.*)", "destination": "https://planillas-api.fly.dev/uploads/$1" }
  ```

### 3.5 Agregar .dockerignore
```
.git
.gitignore
README.md
docs/
uploads/
*.log
.env
.env.*
```

---

## FASE 4 — Calidad de código

### 4.1 Agregar tests
- **Unit tests** para services (`internal/service/*_test.go`)
- **Integration tests** para handlers con BD de prueba (`internal/handler/*_test.go`)
- **Test de extracción Excel** con archivos Excel de muestra en `testdata/`

### 4.2 Agregar logging estructurado
- Reemplazar `log.Printf`/`log.Fatal` con `log/slog` (stdlib desde Go 1.21)
- Agregar request ID middleware para tracear requests
- Loggear: method, path, status, duration, user_id (si autenticado)

### 4.3 Validación de inputs consistente
- Usar `go-playground/validator` (ya es dependencia indirecta de Gin) con tags en structs
- Ejemplo: `Email string \`json:"email" binding:"required,email"\``

### 4.4 Manejo de errores consistente
- Crear errores tipados en `internal/errors/errors.go`:
  ```go
  var ErrNotFound = errors.New("recurso no encontrado")
  var ErrDuplicate = errors.New("registro duplicado")
  var ErrUnauthorized = errors.New("no autorizado")
  ```
- Handler unificado de errores que mapea errores a HTTP status codes

### 4.5 Manejo de transacciones
- `ImportarHaberes` ya usa transacción con rollback ✅
- Aplicar el mismo patrón a `ImportarExcel`, `ImportarJSON`, `EditarPlanillaCompleta`

---

## FASE 5 — Configuración de Supabase

### 5.1 Variables de entorno para producción
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
```
- Obtener la connection string del dashboard de Supabase → Settings → Database → Connection Pooling
- Usar el modo Session para conexiones desde Fly.io (pooler en puerto 6543)

### 5.2 Migraciones
- Usar AutoMigrate de GORM para desarrollo (ya implementado) ✅
- Para producción, extraer el SQL generado y versionarlo en `migrations/`
- Los triggers de `init.sql` deben ejecutarse manualmente en Supabase (SQL Editor)

---

## FASE 6 — Frontend (mejoras)

### 6.1 Variables de entorno por entorno
- `.env.development`: `VITE_API_URL=http://localhost:8080`
- `.env.production`: `VITE_API_URL=https://planillas-api.fly.dev`
- Eliminar la lógica de fallback `|| ''` en `api.ts` (forzar que siempre se configure)

### 6.2 Configurar Vercel
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables en Vercel dashboard: `VITE_API_URL=https://planillas-api.fly.dev`

### 6.3 Mejoras de UX/seguridad
- Agregar `rel="noopener noreferrer"` a cualquier link externo
- La inactividad a 30 min ya está implementada ✅
- Agregar un interceptor para refresh automático del token (si se implementa refresh token)

---

## Orden de ejecución recomendado

1. ⚠️ **Rotar contraseña de Neon** (inmediato — ya está expuesta)
2. **FASE 1** — Seguridad (Mass Assignment, token expiry, rate limiting, password strength, headers)
3. **FASE 3** — Docker (docker-compose.yml autónomo, .env, .dockerignore)
4. **FASE 2** — Refactorización (separar handlers, services, repositories, modelos)
5. **FASE 5** — Configurar Supabase + migrar datos
6. **FASE 3** — Configurar Fly.io + Vercel + vercel.json
7. **FASE 4** — Tests + logging + validación
8. **FASE 6** — Variables de entorno frontend + deploy Vercel

---

## Notas adicionales

- **Python Excel se omite**: el backend Go (`excelize`, `xls`) ya procesa `.xlsx` y `.xls` nativamente. Eliminar referencias a `python-excel/` del README.
- **Servicio `python-excel` del README**: actualizar el README para reflejar la arquitectura real de 3 servicios.
- **`render.yaml`**: mantener como alternativa de deploy, pero actualizar a Supabase.
- **`docker/fix_triggers.sql`**: no existe, evaluar si es necesario o eliminar la referencia.
- **Uploads en Fly.io**: usar el volumen persistente de 3 GB para `/app/uploads`.
