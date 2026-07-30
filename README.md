# Sistema de Gestión de Planillas - SU

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.25+-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/PostgreSQL-18-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-✓-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

Sistema web completo para la gestión de planillas de personal, ingresos, descuentos y haberes.
Incluye importación/exportación Excel, escaneo OCR de boletas y dashboard de resumen.

### 🔑 Credenciales por defecto

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@planillas.su | Admin2026* |
| Asistente | asistente@planillas.su | Asistente2026* |

---

## Tabla de Contenidos

- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Tech Stack](#tech-stack)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [API Endpoints](#api-endpoints)
- [Desarrollo Local](#desarrollo-local)
- [Comandos Docker](#comandos-docker)
- [Seguridad](#seguridad)
- [Diagrama de Flujo](#diagrama-de-flujo)

---

## Arquitectura del Sistema

### Tipo de Arquitectura: Servicios Distribuidos (3 servicios)

El proyecto sigue una arquitectura de servicios distribuidos donde cada componente es independiente y se comunica a través de APIs REST. El procesamiento Excel se realiza directamente en Go (librería `excelize`), eliminando la necesidad de un servicio Python externo.

```
┌──────────────────────────────────────────────────────────────────────┐
│                       ARQUITECTURA DEL SISTEMA                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐ │
│  │   FRONTEND   │         │    BACKEND   │         │  PostgreSQL  │ │
│  │ (React+Nginx)│◄──────►│   (Go/Gin)   │◄──────►│     :5432    │ │
│  │    :5173     │  HTTP   │    :8080     │  GORM   │              │ │
│  └──────────────┘         └──────────────┘         └──────────────┘ │
│                                  │                                   │
│                           ┌──────┴──────┐                           │
│                           ▼              ▼                           │
│                    ┌──────────┐   ┌──────────────┐                  │
│                    │ UPLOADS  │   │ Google Cloud │                  │
│                    │ (Excel,  │   │ Vision (OCR) │                  │
│                    │  PDF)    │   └──────────────┘                  │
│                    └──────────┘                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Stack | Descripción |
|------------|-------|-------------|
| **Frontend** | React 18 + Vite + TailwindCSS + Nginx | Interfaz de usuario, servida por Nginx con proxy reverso |
| **Backend API** | Go 1.25 + Gin + GORM | API REST con lógica de negocio, procesamiento Excel y OCR |
| **PostgreSQL** | PostgreSQL 18 Alpine | Base de datos relacional |

### Flujo de Datos

1. **Usuario** → Frontend (React en :5173)
2. **Frontend** → Nginx (puerto 80 interno) — proxy `/api` al backend
3. **Backend Go** (:8080) → PostgreSQL (:5432) vía GORM
4. **Backend** → Google Cloud Vision API para OCR de boletas
5. Archivos Excel/PDF se almacenan en volumen `uploads`

### ¿Por qué no es un Monolito?

| Característica | Monolito | Este Proyecto |
|----------------|----------|---------------|
| Despliegue | Un solo deploy | 3 servicios independientes |
| Escalabilidad | Vertical | Horizontal por servicio |
| Tecnología | Un solo stack | Go + React + PostgreSQL |
| Fallos | Todo cae | Aislamiento de errores |
| Desarrollo | Acoplado | Separación de capas |

---

## Tech Stack

### Frontend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18.x | Biblioteca UI |
| TypeScript | 5.x | Tipado estático |
| Vite | 5.x | Build tool y dev server |
| TailwindCSS | 3.x | Estilos utilitarios |
| React Router | 6.x | Enrutamiento SPA |
| Axios | 1.x | Cliente HTTP |
| Lucide React | 0.294 | Iconos |
| xlsx | 0.18 | Lectura de Excel en navegador |
| Nginx | Alpine | Servidor producción |

### Backend

| Tecnología | Uso |
|------------|-----|
| **Go** 1.25 | Lenguaje principal |
| **Gin** v1.9 | Framework HTTP (router, middleware) |
| **GORM** v1.25 | ORM para PostgreSQL |
| **excelize** v2.10 | Lectura/escritura de archivos Excel (.xlsx) |
| **extrame/xls** | Lectura de Excel legacy (.xls) |
| **gosseract** v2.4 | OCR local con Tesseract |
| **Google Cloud Vision** v2 | OCR avanzado en la nube |
| **bcrypt** | Hashing de contraseñas |

### Infraestructura

| Tecnología | Uso |
|------------|-----|
| **Docker + Compose** | Contenedores y orquestación local |
| **Fly.io** | Deploy del backend |
| **Vercel** | Deploy del frontend |
| **Supabase** | Base de datos PostgreSQL en la nube |
| **Nginx Alpine** | Proxy reverso y servidor estático |

### Patrones de Diseño

#### Backend — Arquitectura en Capas (refactorizado)

```
cmd/server/main.go          → Entry point, registro de rutas
internal/
├── handler/                 → Capa HTTP (controladores)
├── service/                 → Capa de lógica de negocio
├── model/                   → Entidades GORM (Usuario, Personal, Planilla, etc.)
├── middleware/               → Auth (cookie+header), CORS, RateLimiter, Security
├── config/                  → Carga de variables de entorno
├── database/                → Conexión DB, AutoMigrate, seed de usuarios
├── ocr/                     → Escáner OCR (Tesseract + Google Vision)
└── errors/                  → Manejo centralizado de errores
```

#### Frontend — Patrones React

- **Context API**: `AuthContext` para estado global de autenticación
- **Protected Routes**: `ProtectedRoute` como guard de rutas
- **Service Layer**: `services/api.ts` con interceptores Axios
- **Composition**: Layout → Sidebar + Outlet (React Router)
- **Inactivity Timeout**: Cierre de sesión automático por inactividad

---

## Estructura del Proyecto

```
ugelaa/
├── frontend/                          # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx             # Layout principal + sidebar + navegación
│   │   │   └── ComboBox.tsx           # Componente select con búsqueda
│   │   ├── pages/
│   │   │   ├── Auth.tsx               # Login / Logout
│   │   │   ├── Dashboard.tsx          # Panel principal con estadísticas
│   │   │   ├── Planillas.tsx          # Gestión de personal + planillas
│   │   │   ├── Importar.tsx           # Importación masiva Excel
│   │   │   ├── Exportar.tsx           # Exportación de datos
│   │   │   ├── Escanear.tsx           # Escaneo OCR de boletas
│   │   │   └── Configuracion.tsx      # Cambiar contraseña
│   │   ├── services/
│   │   │   └── api.ts                 # Cliente Axios + interceptores
│   │   ├── hooks/                     # Custom hooks
│   │   ├── App.tsx                    # Router + AuthContext + ProtectedRoute
│   │   ├── main.tsx                   # Entry point
│   │   └── index.css                  # Tailwind + estilos globales
│   ├── nginx.conf                     # Proxy reverso → backend
│   ├── Dockerfile                     # Multi-stage: node build → nginx
│   ├── package.json
│   ├── vite.config.ts                 # Proxy /api → backend en dev
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── backend/                           # API REST Go + Gin
│   ├── cmd/server/
│   │   └── main.go                    # Entry point + registro de rutas
│   ├── internal/
│   │   ├── config/
│   │   │   └── config.go              # Carga de variables de entorno
│   │   ├── database/
│   │   │   └── database.go            # Conexión DB, AutoMigrate, seed
│   │   ├── handler/
│   │   │   ├── auth.go                # Login, Logout, CambiarPassword
│   │   │   ├── personal.go            # CRUD Personal
│   │   │   ├── planilla.go            # CRUD Planillas, Ingresos, Descuentos
│   │   │   ├── dashboard.go           # Exportar Excel, Resumen
│   │   │   ├── excel.go               # Importar/Validar/Procesar Excel
│   │   │   └── ocr_handler.go         # Escaneo OCR de boletas
│   │   ├── middleware/
│   │   │   ├── middleware.go           # Auth (cookie+header), DB, CORS, RateLimiter
│   │   │   └── security.go            # Security headers (CSP, HSTS, etc.)
│   │   ├── model/
│   │   │   ├── usuario.go             # Usuario (email, password_hash, token, rol)
│   │   │   ├── personal.go            # Personal (dni, nombres, puesto, etc.)
│   │   │   ├── planilla.go            # Planilla (mes, anio, totales)
│   │   │   ├── ingreso.go             # Ingreso (concepto, monto)
│   │   │   ├── descuento.go           # Descuento (concepto, monto)
│   │   │   ├── boleta.go              # BoletaOCR (resultados de escaneo)
│   │   │   └── excel.go               # LoginAttempt (rate limiting)
│   │   ├── service/
│   │   │   ├── auth.go                # Lógica de autenticación
│   │   │   ├── personal.go            # Lógica de personal
│   │   │   ├── planilla.go            # Lógica de planillas
│   │   │   └── dashboard.go           # Lógica de dashboard
│   │   ├── ocr/                       # Escáner OCR (Tesseract + Google Vision)
│   │   ├── repository/                # Capa de acceso a datos
│   │   └── errors/
│   │       └── errors.go              # Manejo de errores
│   ├── handlers/                      # Capa de compatibilidad (legacy)
│   │   ├── handlers.go                # Lógica HTTP legacy
│   │   ├── excel.go                   # Parseo de Excel
│   │   ├── excel_export.go            # Exportación Excel
│   │   ├── excel_extract.go           # Extracción de datos Excel
│   │   └── excel_routes.go            # Rutas de Excel
│   ├── models/
│   │   └── models.go                  # Modelos legacy
│   ├── Dockerfile                     # Multi-stage: go build → alpine + tesseract
│   ├── go.mod / go.sum
│   └── run.sh
│
├── docker/
│   └── init.sql                       # Schema SQL inicial (respaldo)
│
├── uploads/                           # Archivos subidos (volumen Docker)
│   └── ocr/                           # Imágenes para OCR
│
├── docs/
│   ├── diagrama_flujo.md              # Diagramas Mermaid del sistema
│   ├── manual_administrador.md
│   ├── manual_desarrollador.md
│   ├── manual_usuario.md
│   └── plan_accion.md
│
├── docker-compose.yml                 # Orquestación (postgres + backend + frontend)
├── render.yaml                        # Deploy en Render
├── PROMPT_REFACTOR.md                 # Plan de refactorización y seguridad
└── .gitignore
```

---

## Instalación

### Requisitos Previos

| Requisito | Mínimo | Notas |
|-----------|--------|-------|
| Docker Engine | 24+ | Con Docker Compose |
| RAM | 4 GB | 8 GB recomendado |
| Disco | 2 GB libres | Para imágenes y volúmenes |

### 🚀 Inicio rápido con Docker

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd ugelaa

# 2. (Opcional) Crear archivo .env
# Editar si usas Supabase en vez de PostgreSQL local

# 3. Iniciar todos los servicios
docker compose up -d

# 4. Verificar estado
docker compose ps

# 5. Acceder a la aplicación
# Frontend: http://localhost:5173
# API:      http://localhost:8080/health
```

### Tiempo de inicio

| Servicio | Tiempo | Nota |
|----------|--------|------|
| PostgreSQL | ~10-15s | Con healthcheck `pg_isready` |
| Backend | ~5-10s | Espera a que PostgreSQL esté healthy |
| Frontend | ~3-5s | Depende de backend |
| **Total** | **~20-30s** | |

---

## Configuración

### Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto:

```bash
# ─── Base de Datos ───
# PostgreSQL local (Docker)
DATABASE_URL=postgres://planillas:planillas2024@postgres:5432/planillas?sslmode=disable

# O Supabase (producción)
# DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:6543/postgres

# ─── PostgreSQL Docker ───
DB_USER=planillas
DB_PASSWORD=planillas2024
DB_NAME=planillas
DB_PORT=5432

# ─── Backend ───
PORT=8080
CORS_ORIGINS=http://localhost,http://localhost:5173,http://localhost:80,http://127.0.0.1:5173

# ─── OCR (opcional) ───
# GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/credenciales-google.json
```

### Servicios Docker Compose

```yaml
services:
  postgres:       # PostgreSQL 18 Alpine
    image: postgres:18-alpine
    ports: 5432
    volumes: postgres_data + init.sql
    healthcheck: pg_isready

  backend:        # API Go + Gin + Tesseract OCR
    build: ./backend
    ports: 8080
    depends_on: postgres (service_healthy)
    environment: DATABASE_URL, CORS_ORIGINS, PORT
    volumes: uploads_data

  frontend:       # React + Nginx
    build: ./frontend
    ports: 5173:80
    depends_on: backend
```

### Nginx (Frontend)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }

    location /api {
        proxy_pass http://backend:8080;      # Proxy al backend
        client_max_body_size 100M;           # Para uploads Excel
        proxy_read_timeout 600s;
    }

    location /uploads {
        proxy_pass http://backend:8080;      # Archivos estáticos
    }
}
```

### Base de Datos

| Campo | Valor |
|-------|-------|
| **Host** | localhost:5432 |
| **Usuario** | planillas |
| **Password** | planillas2024 |
| **Base de datos** | planillas |

---

## API Endpoints

### 🔓 Públicos (con rate limiting)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/usuarios/login` | Login → devuelve cookie httpOnly |
| POST | `/api/process-excel` | Procesar e importar archivo Excel |
| POST | `/api/validate-excel` | Validar estructura de Excel sin importar |
| POST | `/api/importar/haberes` | Importar haberes desde Excel |
| GET | `/api/personal/:id/exportar` | Exportar planillas de un empleado a Excel |

### 🔒 Protegidos (requieren autenticación)

#### Usuarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| PUT | `/api/usuarios/cambiar-password` | Cambiar contraseña |
| POST | `/api/usuarios/logout` | Cerrar sesión (borra token) |

#### Personal
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/personal` | Listar (paginado, búsqueda, filtros) |
| GET | `/api/personal/buscar?q=` | Búsqueda rápida |
| GET | `/api/personal/instituciones?q=` | Autocompletar instituciones |
| GET | `/api/personal/distritos?q=` | Autocompletar distritos |
| GET | `/api/personal/:id` | Obtener detalle |
| GET | `/api/personal/:id/periodos` | Períodos con planillas |
| POST | `/api/personal` | Crear nuevo |
| PUT | `/api/personal/:id` | Actualizar |
| DELETE | `/api/personal/:id` | Eliminar |

#### Planillas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/planillas` | Listar todas |
| GET | `/api/planillas/:id` | Obtener con detalle |
| POST | `/api/planillas` | Crear |
| PUT | `/api/planillas/:id` | Actualizar |
| PUT | `/api/planillas/:id/editar` | Editar completa (ingresos + descuentos) |
| DELETE | `/api/planillas/:id` | Eliminar |
| GET | `/api/planillas/:id/ingresos` | Listar ingresos de una planilla |
| GET | `/api/planillas/:id/descuentos` | Listar descuentos de una planilla |

#### Ingresos / Descuentos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/ingresos` | Crear ingreso |
| PUT | `/api/ingresos/:id` | Actualizar ingreso |
| DELETE | `/api/ingresos/:id` | Eliminar ingreso |
| POST | `/api/descuentos` | Crear descuento |
| PUT | `/api/descuentos/:id` | Actualizar descuento |
| DELETE | `/api/descuentos/:id` | Eliminar descuento |

#### Dashboard
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard/resumen` | Estadísticas generales |
| GET | `/api/dashboard/exportar` | Exportar datos completos |

#### OCR
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/ocr` | Escanear boleta (imagen → datos) |
| GET | `/api/ocr/:id` | Obtener resultado de escaneo |

---

## Desarrollo Local

### Opción A: Docker Compose (recomendado)

```bash
docker compose up -d
# Frontend: http://localhost:5173
# Backend:  http://localhost:8080
```

### Opción B: Desarrollo manual

#### 1. PostgreSQL

```bash
# Con Docker:
docker run -d --name planillas-db \
  -e POSTGRES_USER=planillas \
  -e POSTGRES_PASSWORD=planillas2024 \
  -e POSTGRES_DB=planillas \
  -p 5432:5432 \
  postgres:18-alpine
```

#### 2. Backend

```bash
cd backend
go mod download
# Configurar DATABASE_URL en .env o variable de entorno
go run ./cmd/server
# API: http://localhost:8080/health
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
# El proxy de Vite redirige /api → localhost:8080
```

---

## Comandos Docker

```bash
# ─── Iniciar / Detener ───
docker compose up -d              # Iniciar en background
docker compose up -d --build      # Rebuild + iniciar
docker compose down               # Detener y eliminar contenedores
docker compose down -v            # + eliminar volúmenes (RESET TOTAL)

# ─── Logs ───
docker compose logs -f            # Todos los servicios
docker compose logs -f backend    # Solo backend
docker compose logs -f frontend   # Solo frontend
docker compose logs --tail=100 backend

# ─── Estado ───
docker compose ps                 # Estado de servicios
docker stats                      # Uso de recursos

# ─── Acceso a contenedores ───
docker exec -it planillas-api sh                    # Terminal backend
docker exec -it planillas-db psql -U planillas -d planillas  # psql
docker exec -it planillas-frontend sh               # Terminal frontend

# ─── Base de datos ───
docker exec -it planillas-db psql -U planillas -d planillas -c "\dt"   # Listar tablas
docker exec -it planillas-db psql -U planillas -d planillas -c "SELECT * FROM usuarios;"
```

---

## Seguridad

El sistema implementa múltiples capas de seguridad:

| Mecanismo | Implementación |
|-----------|---------------|
| **Auth** | Token httpOnly cookie + fallback header Authorization |
| **Token expiry** | 24 horas, limpieza automática cada 1h |
| **Rate Limiting** | Basado en IP, persistido en BD, 5 intentos / 15 min |
| **Password change rate limit** | 5 intentos / 1 minuto |
| **Security Headers** | CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| **CORS** | Allowlist configurable por variable de entorno |
| **Mass Assignment Protection** | Structs tipados en handlers (no `map[string]interface{}`) |
| **Password hashing** | bcrypt |
| **Password validation** | Mínimo 8 caracteres, mayúscula + número |

---

## Diagrama de Flujo

Ver [docs/diagrama_flujo.md](docs/diagrama_flujo.md) para diagramas Mermaid detallados de:
- Arquitectura general
- Flujo de autenticación
- CRUD de personal y planillas
- Importación/exportación Excel
- Escaneo OCR
- Despliegue Docker
- Secuencia completa de solicitud HTTP

---

## License

MIT License
