# Diagrama de Flujo — Sistema de Gestión de Planillas SU

## 1. Arquitectura General del Sistema

```mermaid
flowchart TB
    subgraph Usuario["👤 Usuario"]
        Browser["Navegador Web"]
    end

    subgraph Frontend["🖥️ Frontend — React 18 + Vite + TailwindCSS (:5173)"]
        direction TB
        Auth["Auth.tsx<br/>Login / Logout"]
        Dashboard["Dashboard.tsx<br/>Panel Principal"]
        Planillas["Planillas.tsx<br/>Gestión de Planillas"]
        Personal["(dentro de Planillas)<br/>Gestión de Personal"]
        Importar["Importar.tsx<br/>Importar Excel"]
        Exportar["Exportar.tsx<br/>Exportar Datos"]
        Escanear["Escanear.tsx<br/>Escanear Documentos"]
        Config["Configuracion.tsx<br/>Cambiar Contraseña"]
        Layout["Layout.tsx<br/>Navegación + Sidebar"]
        ApiService["api.ts<br/>Axios + interceptores"]
        AuthContext["AuthContext<br/>Estado de autenticación"]
    end

    subgraph Backend["⚙️ Backend — Go + Gin + GORM (:8080)"]
        direction TB
        Router["Gin Router"]
        
        subgraph Middleware["Middleware Layer"]
            Security["SecurityHeaders<br/>CSP, HSTS, XSS"]
            CORS["CORS"]
            RateLimiter["RateLimiter<br/>(basado en DB)"]
            AuthMW["AuthMiddleware<br/>Token + Cookie httpOnly"]
            DB_MW["DB Middleware<br/>Inyección de *gorm.DB"]
        end

        subgraph Handlers["Handler Layer"]
            AuthH["auth.go<br/>Login, Logout, CambiarPassword"]
            PersonalH["personal.go<br/>CRUD Personal"]
            PlanillaH["planilla.go<br/>CRUD Planillas, Ingresos, Descuentos"]
            DashboardH["dashboard.go<br/>Estadísticas"]
            ExcelH["excel.go<br/>Importar/Exportar/Validar Excel"]
            OCR_H["ocr_handler.go<br/>Escanear Documentos"]
        end

        subgraph Services["Service Layer"]
            AuthS["auth.go"]
            PersonalS["personal.go"]
            PlanillaS["planilla.go"]
            DashboardS["dashboard.go"]
        end

        subgraph Models["Model Layer"]
            Usuario["Usuario<br/>(email, password_hash, token, rol)"]
            Personal["Personal<br/>(dni, nombres, apellidos, puesto, etc.)"]
            Planilla["Planilla<br/>(mes, anio, total)"]
            Ingreso["Ingreso<br/>(monto, descripción)"]
            Descuento["Descuento<br/>(monto, descripción)"]
            LoginAttempt["LoginAttempt<br/>(ip, attempts)"]
        end
    end

    subgraph Database["🗄️ PostgreSQL 18 (:5432)"]
        DB[(Planillas DB)]
    end

    subgraph Storage["📁 Almacenamiento"]
        Uploads["/uploads<br/>Archivos Excel, PDF, imágenes"]
    end

    Browser <-->|"HTTP :5173"| Frontend
    ApiService <-->|"REST API :8080"| Router
    Router --> Middleware
    Middleware --> Handlers
    Handlers --> Services
    Services --> Models
    Models --> DB
    ExcelH --> Uploads
    OCR_H --> Uploads

    style Frontend fill:#61DAFB,color:#000
    style Backend fill:#00ADD8,color:#fff
    style Database fill:#336791,color:#fff
    style Usuario fill:#E5E7EB,color:#000
    style Storage fill:#F59E0B,color:#000
```

## 2. Flujo de Autenticación

```mermaid
flowchart TD
    A["👤 Usuario accede a la app"] --> B{"¿Token válido<br/>en cookie?"}
    B -->|Sí| C["AuthMiddleware verifica<br/>token_expires_at > NOW()"]
    C -->|Válido| D["✅ Acceso a rutas protegidas"]
    C -->|Expirado| E["❌ 401 Unauthorized"]
    B -->|No| F["Redirigir a /auth"]
    
    F --> G["Pantalla de Login"]
    G --> H["Usuario ingresa<br/>email + password"]
    
    H --> I{"RateLimiter<br/>¿< 5 intentos?"}
    I -->|No| J["⛔ 429 Too Many Requests<br/>Esperar 15 min"]
    I -->|Sí| K["POST /api/usuarios/login"]
    
    K --> L{"¿Credenciales<br/>válidas?"}
    L -->|No| M["❌ 401 Credenciales inválidas<br/>Incrementar contador"]
    M --> I
    
    L -->|Sí| N["Generar token (32 bytes hex)"]
    N --> O["Guardar token + token_expires_at<br/>(+24h) en DB"]
    O --> P["Set-Cookie: auth_token<br/>HttpOnly; Secure; SameSite=Strict"]
    P --> Q["Resetear rate limit"]
    Q --> D

    subgraph Cleanup["Rutinas de limpieza (goroutines)"]
        R1["Cada 15min: LIMPIAR login_attempts<br/>WHERE last_attempt < NOW() - 15min"]
        R2["Cada 1h: LIMPIAR usuarios<br/>WHERE token_expires_at < NOW()"]
    end

    style A fill:#10B981,color:#fff
    style D fill:#10B981,color:#fff
    style E fill:#EF4444,color:#fff
    style J fill:#EF4444,color:#fff
    style M fill:#EF4444,color:#fff
```

## 3. Flujo de Gestión de Personal

```mermaid
flowchart TD
    Start["📋 Usuario en Planillas"] --> List["GET /api/personal<br/>?search, page, limit, sort_by, sort_order<br/>?mes, anio, institucion, distrito"]
    
    List --> Actions{"Acción del<br/>usuario"}
    
    Actions -->|"Buscar"| Search["GET /api/personal/buscar?q=texto"]
    Search --> List
    
    Actions -->|"Crear"| CreateForm["Formulario nuevo personal<br/>DNI, nombres, apellidos, puesto,<br/>RD, UU, institución, distrito"]
    CreateForm --> CreatePost["POST /api/personal"]
    CreatePost --> ValidateCreate{"¿Datos<br/>válidos?"}
    ValidateCreate -->|No| CreateForm
    ValidateCreate -->|Sí| List
    
    Actions -->|"Ver/Editar"| GetOne["GET /api/personal/:id"]
    GetOne --> Detail["Vista detalle del personal<br/>+ planillas asociadas"]
    
    Detail --> EditActions{"Acción en<br/>detalle"}
    
    EditActions -->|"Editar"| EditForm["Formulario edición"]
    EditForm --> EditPut["PUT /api/personal/:id<br/>(struct tipado, sin mass assignment)"]
    EditPut --> Detail
    
    EditActions -->|"Eliminar"| DeleteConfirm{"¿Confirmar<br/>eliminación?"}
    DeleteConfirm -->|Sí| DeleteReq["DELETE /api/personal/:id"]
    DeleteReq --> List
    DeleteConfirm -->|No| Detail
    
    EditActions -->|"Ver periodos"| Periodos["GET /api/personal/:id/periodos"]
    Periodos --> Detail
    
    EditActions -->|"Exportar"| Export["GET /api/personal/:id/exportar?mes=&anio="]
    Export --> ExportFile["📥 Descargar Excel<br/>con planillas del personal"]

    style Start fill:#8B5CF6,color:#fff
    style List fill:#3B82F6,color:#fff
    style ExportFile fill:#10B981,color:#fff
```

## 4. Flujo de Gestión de Planillas

```mermaid
flowchart TD
    Start["📊 Sección Planillas"] --> ListPlanillas["GET /api/planillas<br/>Listar todas las planillas"]
    
    ListPlanillas --> PlanillaActions{"Acción"}
    
    PlanillaActions -->|"Crear"| CreatePlanilla["POST /api/planillas<br/>{personal_id, mes, anio}"]
    CreatePlanilla --> ListPlanillas
    
    PlanillaActions -->|"Ver"| GetPlanilla["GET /api/planillas/:id"]
    GetPlanilla --> PlanillaDetail["Detalle de Planilla<br/>+ Ingresos + Descuentos"]
    
    PlanillaDetail --> SubActions{"Gestión de<br/>conceptos"}
    
    subgraph IngresosFlow["Gestión de Ingresos"]
        ListIng["GET /api/planillas/:id/ingresos"]
        CreateIng["POST /api/ingresos"]
        UpdateIng["PUT /api/ingresos/:id"]
        DeleteIng["DELETE /api/ingresos/:id"]
    end
    
    subgraph DescuentosFlow["Gestión de Descuentos"]
        ListDesc["GET /api/planillas/:id/descuentos"]
        CreateDesc["POST /api/descuentos"]
        UpdateDesc["PUT /api/descuentos/:id"]
        DeleteDesc["DELETE /api/descuentos/:id"]
    end
    
    SubActions -->|"Ingresos"| IngresosFlow
    SubActions -->|"Descuentos"| DescuentosFlow
    SubActions -->|"Editar todo"| EditFull["PUT /api/planillas/:id/editar<br/>Planilla completa en lote"]
    
    PlanillaActions -->|"Editar"| EditPlanilla["PUT /api/planillas/:id<br/>(struct tipado)"]
    EditPlanilla --> ListPlanillas
    
    PlanillaActions -->|"Eliminar"| DeletePlanilla["DELETE /api/planillas/:id"]
    DeletePlanilla --> ListPlanillas

    style Start fill:#8B5CF6,color:#fff
    style PlanillaDetail fill:#F59E0B,color:#000
```

## 5. Flujo de Importación Excel

```mermaid
flowchart TD
    Start["📥 Pantalla Importar"] --> Upload["Usuario selecciona<br/>archivo Excel (.xlsx)"]
    
    Upload --> Validate["POST /api/validate-excel<br/>Validación previa del archivo"]
    Validate --> ValidResult{"¿Archivo<br/>válido?"}
    ValidResult -->|No| ErrorValid["❌ Mostrar errores<br/>de validación"]
    ErrorValid --> Upload
    
    ValidResult -->|Sí| Process["POST /api/process-excel<br/>Procesar e importar datos"]
    
    Process --> ParseExcel["Backend parsea el Excel<br/>(biblioteca excelize)"]
    ParseExcel --> ExtractData["Extraer filas:<br/>Personal, Planillas,<br/>Ingresos, Descuentos"]
    
    ExtractData --> SaveDB["Guardar en PostgreSQL<br/>usando GORM"]
    
    SaveDB --> Result{"¿Éxito?"}
    Result -->|Sí| Success["✅ Datos importados<br/>Mostrar resumen"]
    Result -->|Error parcial| Partial["⚠️ Importación parcial<br/>Mostrar filas con error"]
    Result -->|Error total| Fail["❌ Error en importación<br/>Rollback de transacción"]

    subgraph Haberes["Importación de Haberes"]
        HaberesUpload["POST /api/importar/haberes"]
        HaberesUpload --> HaberesProcess["Procesar haberes<br/>desde Excel"]
        HaberesProcess --> HaberesSave["Guardar haberes en DB"]
    end

    style Start fill:#8B5CF6,color:#fff
    style Success fill:#10B981,color:#fff
    style Fail fill:#EF4444,color:#fff
    style Partial fill:#F59E0B,color:#000
```

## 6. Flujo de Escaneo OCR

```mermaid
flowchart TD
    Start["📷 Pantalla Escanear"] --> Capture["Usuario captura/subir<br/>imagen de documento"]
    
    Capture --> OCR["POST /api/ocr<br/>Procesar con OCR"]
    
    OCR --> Process["Backend procesa imagen"]
    Process --> Extract["Extraer texto con OCR"]
    Extract --> Parse["Parsear campos:<br/>DNI, nombres, montos, etc."]
    
    Parse --> Match{"¿Coincide con<br/>personal existente?"}
    Match -->|Sí| LinkToPersonal["Vincular a registro<br/>de personal existente"]
    Match -->|No| NewPersonal["Sugerir crear<br/>nuevo registro"]
    
    LinkToPersonal --> Save["Guardar documento<br/>en /uploads/"]
    NewPersonal --> Save

    style Start fill:#8B5CF6,color:#fff
    style Save fill:#10B981,color:#fff
```

## 7. Flujo de Despliegue (Docker Compose)

```mermaid
flowchart TD
    Start["docker compose up"] --> Check{"¿Imágenes<br/>existentes?"}
    
    Check -->|No| BuildPhase["🔨 BUILD PHASE"]
    BuildPhase --> BuildBack["Build backend<br/>Dockerfile (Go)"]
    BuildPhase --> BuildFront["Build frontend<br/>Dockerfile (React + Nginx)"]
    
    BuildBack --> CompileGo["Compilar Go binary"]
    BuildFront --> BuildReact["npm run build"]
    BuildReact --> NginxConfig["Configurar Nginx"]
    
    Check -->|Sí| StartServices
    BuildPhase --> StartServices
    
    StartServices["🚀 INICIAR SERVICIOS"]
    
    StartServices --> PG["1️⃣ PostgreSQL :5432"]
    PG --> PGHealth{"Healthcheck<br/>pg_isready?"}
    PGHealth -->|No| PGWait["Esperar..."]
    PGWait --> PGHealth
    PGHealth -->|Sí| PGReady["✅ DB lista"]
    
    PGReady --> Backend["2️⃣ Backend Go :8080"]
    Backend --> BackendInit["Conectar DB<br/>Ejecutar migraciones GORM<br/>Iniciar cleanup routines"]
    BackendInit --> BackendReady["✅ API lista"]
    
    BackendReady --> Frontend["3️⃣ Frontend Nginx :5173"]
    Frontend --> FrontendReady["✅ Frontend listo"]
    
    FrontendReady --> Running["🌐 Sistema operativo<br/>http://localhost:5173"]

    style Start fill:#8B5CF6,color:#fff
    style Running fill:#10B981,color:#fff
    style PGReady fill:#336791,color:#fff
    style BackendReady fill:#00ADD8,color:#fff
    style FrontendReady fill:#61DAFB,color:#000
```

## 8. Flujo Completo de Solicitud HTTP

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant F as 🖥️ Frontend (React)
    participant N as 🔀 Nginx (:5173)
    participant B as ⚙️ Backend (Go/Gin :8080)
    participant M as 🛡️ Middleware
    participant H as 📦 Handler
    participant S as 🔧 Service
    participant D as 🗄️ PostgreSQL

    U->>F: Interactúa con la UI
    F->>F: api.ts interceptor agrega token
    F->>B: HTTP Request (cookie auth_token)
    
    B->>M: SecurityHeaders
    M->>M: CORS validation
    M->>M: RateLimiter check
    M->>M: AuthMiddleware (verifica token)
    
    alt Token inválido/expirado
        M-->>F: 401 Unauthorized
        F->>F: Redirigir a /auth
    else Token válido
        M->>M: DB Middleware (inyecta *gorm.DB)
        M->>H: Pasa al handler
        H->>H: Validar input (structs tipados)
        H->>S: Llama al servicio
        S->>D: Consulta/actualiza DB (GORM)
        D-->>S: Resultado
        S-->>H: Datos procesados
        H-->>F: JSON Response
        F->>F: Actualizar UI
        F-->>U: Mostrar resultado
    end
```

## Resumen de Entidades y Relaciones

```mermaid
erDiagram
    USUARIO {
        uint id PK
        string email
        string password_hash
        string token
        datetime token_expires_at
        string rol
    }
    
    PERSONAL {
        uint id PK
        string dni
        string nombres
        string apellidos
        string puesto
        string rd
        string uu
        string institucion
        string distrito
    }
    
    PLANILLA {
        uint id PK
        uint personal_id FK
        int mes
        int anio
        float total_ingresos
        float total_descuentos
        float total
    }
    
    INGRESO {
        uint id PK
        uint planilla_id FK
        string concepto
        float monto
    }
    
    DESCUENTO {
        uint id PK
        uint planilla_id FK
        string concepto
        float monto
    }
    
    LOGIN_ATTEMPT {
        string ip PK
        int attempts
        datetime last_attempt
    }

    PERSONAL ||--o{ PLANILLA : tiene
    PLANILLA ||--o{ INGRESO : contiene
    PLANILLA ||--o{ DESCUENTO : contiene
```

---

> **Nota**: Este diagrama refleja la arquitectura refactorizada con separación de capas (Handler → Service → Model), middleware de seguridad (RateLimiter basado en DB, httpOnly cookies, security headers), y structs tipados para prevenir Mass Assignment.
