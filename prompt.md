# SISTEMA DE APLICACIÓN DE ESCRITORIO LOCAL-FIRST CON SUSCRIPCIÓN CRIPTOGRÁFICA Y BACKEND EN SUPABASE

## 1. CONTEXTO Y ENTORNO PRECONFIGURADO DEL SISTEMA

Este entorno de desarrollo ya cuenta con todas las herramientas, credenciales y accesos globales configurados en la máquina:

### A. Credenciales y Conexión a Supabase Cloud (PostgreSQL)
- **Supabase Project URL:** `https://wephfzqyrjdqgrxmwypn.supabase.co`
- **Publishable Key (Frontend):** `sb_publishable_ady5n2IiVZHuNKXSdAEGAw_MkuOCC02`
- **Secret Key (Backend Admin / Migrations):** `[CONFIGURED_IN_ENV_LOCAL]`
- **Anon Key (JWT):** `[CONFIGURED_IN_ENV_LOCAL]`
- **Service Role Key (JWT):** `[CONFIGURED_IN_ENV_LOCAL]`

### B. Herramientas de Desarrollo y Git
- **Git Config:** Usuario `doumoments` | Correo `elpepinillojoseuwu@gmail.com`
- **GitHub CLI (`gh`):** Autenticado y vinculado a la cuenta `doumoments` con permisos de creación de repositorios remotos.
- **Rust Toolchain:** `rustc 1.98.0` / `cargo` (`stable-x86_64-pc-windows-msvc`) instalado y activo.
- **Node.js & NPM:** `v24.19.0` / `npm 11.17.0` instalado.
- **Vercel CLI:** Instalado y autenticado.

---

## 2. INSTRUCCIONES GENERALES PARA EL AGENTE DE CÓDIGO

Eres un Arquitecto de Software Principal y Desarrollador Autónomo Full-Stack Senior. Tu objetivo es crear, configurar, probar e implementar desde cero la arquitectura completa de una aplicación de escritorio comercial con paradigma "Local-First", licenciamiento criptográfico fuera de línea y backend administrado en Supabase (PostgreSQL).

Debes ejecutar todas las fases ordenadamente, creando la estructura de archivos, instalando dependencias, escribiendo el código completo (sin placeholders ni "TODOs"), ejecutando pruebas unitarias e integrando la solución hasta dejar los binarios listos.

---

## 3. VISIÓN GENERAL DE LA ARQUITECTURA TÉCNICA

### Cliente Local (Tauri v2 + Rust + React + TS + Tailwind)
- **Tauri v2 App:** Runtime ligero en Rust que empaqueta la aplicación de escritorio.
- **Base de Datos Local:** SQLite incrustado mediante `tauri-plugin-sql` o `sqlx` para procesamiento local e interfaz instantánea (latencia < 20ms).
- **Módulo Criptográfico en Rust:**
  - Genera una huella digital única e inmutable del hardware local (`machine_fingerprint`).
  - Verifica matemáticamente firmas Ed25519 usando la `PUBLIC_KEY` incrustada estáticamente.
  - Maneja la validación de licencias fuera de línea con un período de gracia configurable (7 a 30 días).
  - Detecta alteraciones en el reloj local del sistema (anti-tamper de fechas comparando timestamps locales cifrados).

### Backend Serverless (Supabase Cloud PostgreSQL + Edge Functions)
- **Base de Datos PostgreSQL:** Con Row Level Security (RLS) estricto. La app cliente utiliza la `SUPABASE_URL` y la Publishable Key pública (`sb_publishable_...`).
- **Supabase Edge Functions (Deno / TypeScript):**
  - Almacenan de forma aislada la `LICENSE_PRIVATE_KEY` en `SUPABASE_SECRETS`.
  - `/stripe-webhook`: Procesa eventos de pasarela de pago (suscripción activada, renovada, cancelada).
  - `/activate-license`: Recibe credenciales del usuario y su `machine_fingerprint`, valida la suscripción y genera un token firmado criptográficamente con Ed25519.
  - `/verify-license`: Punto de sincronización periódica (Phone-Home) para renovar firmas de licencia.

---

## 4. HOJA DE RUTA Y FASES DE IMPLEMENTACIÓN

```text
[FASE 1: Estructura del Proyecto y Scaffolding]
│
▼
[FASE 2: Base de Datos PostgreSQL y RLS en Supabase]
│
▼
[FASE 3: Edge Functions & Criptografía Ed25519]
│
▼
[FASE 4: Core en Rust (Tauri Backend, Fingerprint & Cryptography)]
│
▼
[FASE 5: Frontend React/TS (UI, State & Offline Grace Period Logic)]
│
▼
[FASE 6: Testing, Auto-Updater y Build de Producción]
```

---

### FASE 1: SCAFFOLDING Y ESTRUCTURA DE DIRECTORIOS

Crea la estructura del proyecto en este workspace con el siguiente árbol exacto:

```text
/my-localfirst-app
├── src-tauri/                 # Backend nativo Rust (Tauri v2)
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── crypto/            # Verificación Ed25519 y anti-tamper
│   │   ├── fingerprint/       # Extracción de Hardware ID
│   │   └── db/                # Inicialización SQLite local
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                       # Frontend React + TypeScript
│   ├── components/            # UI/UX (Licencia, Dashboard, Banners Offline)
│   ├── services/              # Clientes Supabase y Tauri IPC Bridge
│   ├── store/                 # Estado global (Zustand)
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── supabase/                  # Configuración y esquemas de Supabase
│   ├── migrations/            # SQL Schemas (PostgreSQL) y Políticas RLS
│   ├── functions/
│   │   ├── stripe-webhook/    # Procesador de pagos Stripe
│   │   ├── activate-license/  # Emisión de tokens firmados
│   │   └── verify-license/    # Sincronización Phone-Home
│   └── config.toml
├── .env.example
├── .env.local                 # Variables de entorno con las credenciales de Supabase
├── package.json
└── tsconfig.json
```

1. Inicializa el proyecto con Tauri v2, React, Vite, TailwindCSS y TypeScript.
2. Agrega en Rust (`Cargo.toml`) las dependencias: `ed25519-dalek`, `sha2`, `sysinfo`, `serde`, `serde_json`, `chrono`, `tauri-plugin-sql`.
3. Agrega en Node.js (`package.json`) las dependencias: `@supabase/supabase-js`, `@tauri-apps/api`, `lucide-react`, `zustand`.

---

### FASE 2: BASE DE DATOS SUPABASE (POSTGRESQL) Y POLÍTICAS DE SEGURIDAD (RLS)

Genera el archivo de migración SQL en `supabase/migrations/001_initial_schema.sql` con las siguientes especificaciones exactas para PostgreSQL:

**Tablas:**
- `profiles`: Extensión de `auth.users` (`id`, `email`, `created_at`).
- `subscriptions`: (`id`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `current_period_end`).
- `licenses`: (`id`, `user_id`, `license_key`, `max_devices`, `status`, `created_at`).
- `device_activations`: (`id`, `license_id`, `machine_fingerprint`, `device_name`, `activated_at`, `last_seen_at`).

**Seguridad Row Level Security (RLS) Obligatoria:**
- Activa RLS en TODAS las tablas (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
- Configura políticas para que los usuarios autenticados SOLO puedan leer sus propios registros utilizando la Publishable Key pública.
- Otorga permisos de escritura/actualización ÚNICAMENTE al rol de servicio (`service_role` / `sb_secret_...`) para que sea ejecutado exclusivamente desde Edge Functions.

---

### FASE 3: CRIPTOGRAFÍA ED25519 Y SUPABASE EDGE FUNCTIONS

Implementa las Edge Functions en Deno/TypeScript dentro de `supabase/functions/`:

1. **Gestión de Claves Criptográficas:**
   - Script reutilizable usando WebCrypto / `@noble/curves` para firmar payloads con Ed25519.
   - Payload firmado: `{ user_id, license_id, machine_fingerprint, plan, expires_at, issued_at }`.

2. **Edge Function `/activate-license`:**
   - Autentica la petición vía Supabase Auth JWT.
   - Recibe `{ machine_fingerprint, device_name }`.
   - Consulta el estado de la suscripción en PostgreSQL.
   - Si la suscripción está activa y no excede el límite de dispositivos, registra en `device_activations`.
   - Firma el payload con `LICENSE_PRIVATE_KEY` y devuelve el token en Base64.

3. **Edge Function `/stripe-webhook`:**
   - Valida la firma del webhook (`stripe-signature`).
   - Actualiza automáticamente las tablas `subscriptions` y `licenses`.

---

### FASE 4: BACKEND EN RUST (TAURI) - HUELLA DE HARDWARE Y VERIFICACIÓN

Desarrolla el código nativo en Rust dentro de `src-tauri/src/`:

1. **Módulo Fingerprint (`fingerprint/mod.rs`):**
   - Extrae UUID de placa base, ID de CPU y Hostname.
   - Aplica SHA-256 para generar `machine_fingerprint` determinista e irreversible.

2. **Módulo Criptográfico y Validación (`crypto/mod.rs`):**
   - Incluye la `PUBLIC_KEY` Ed25519 estática en el binario.
   - `verify_license_token(token_str)`:
     - Decodifica token y firma.
     - Valida firma criptográfica con `ed25519-dalek`.
     - Verifica coincidencia de `machine_fingerprint` con el hardware local.
     - Valida fechas de caducidad.

3. **Módulo Anti-Tamper de Reloj:**
   - Almacena en SQLite local cifrado la marca de tiempo de la última ejecución válida.
   - Si fecha actual < última marca registrada, bloquea sesión por manipulación de reloj.

4. **Comandos Tauri IPC:**
   - `get_machine_fingerprint()`
   - `verify_local_license()`
   - `save_license_cache(token)`
   - `query_local_db(sql)`

---

### FASE 5: FRONTEND REACT + TYPESCRIPT Y EXPERIENCIA OFFLINE

Construye la UI en `src/`:
- **Motor Local-First:** Lectura y escritura inmediata en SQLite local (<20ms).
- **Zustand License Store (`useLicenseStore`):**
  - Estado `ACTIVO`: 100% funcionalidades habilitadas.
  - Estado `OFFLINE_GRACE_PERIOD`: Aviso sutil, cuenta regresiva de días restantes de gracia.
  - Estado `EXPIRED` / `READ_ONLY`: Permite exportar y ver datos locales existentes, bloquea edición.
- **Componentes UI:**
  - `ActivationModal`: Login con Supabase + Botón de activación de hardware.
  - `OfflineBanner`: Barra de advertencia de periodo de gracia.
  - `SubscriptionPanel`: Gestión de plan y dispositivos.

---

### FASE 6: PRUEBAS AUTOMATIZADAS, REPOSITORIO GITHUB Y BUILD

1. **Pruebas Automatizadas:**
   - Tests unitarios en Rust para detección de firmas inválidas, fingerprints erróneos y tampering de reloj.
   - Tests en TypeScript para periodo de gracia.
2. **Repositorio Git & GitHub:**
   - Inicializar git local (`git init`).
   - Crear repositorio remoto en GitHub con `gh repo create AppSaaS --public --source=. --remote=origin`.
   - Realizar commits estructurados y push a `main`.
3. **Build de Producción:**
   - Ejecutar `tauri build` para generar los instaladores finales nativos (.exe/.msi).

---

## 5. REGLAS DE CALIDAD Y EJECUCIÓN

- **Cero Código Omiso:** Escribe implementaciones reales completas. Prohibido dejar `// TODO`.
- **Manejo Riguroso de Errores:** Todos los comandos de Rust deben retornar `Result<T, String>` estructurados.
- **Seguridad:** Garantizar que `LICENSE_PRIVATE_KEY` y `service_role` NUNCA se incluyan en el código del cliente React ni en el binario de Rust.

**INICIA LA FASE 1 DE INMEDIATO Y CONTINÚA DE FORMA AUTÓNOMA HASTA COMPLETAR EL PROYECTO.**