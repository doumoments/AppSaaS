# CHRONOSAGENT SAFESTATE: PLATAFORMA LOCAL-FIRST DE GOBERNANZA, AISLAMIENTO EN TIEMPO DE EJECUCIÓN Y REVERSIÓN DETERMINISTA PARA AGENTES IA

## 1. CONTEXTO Y ENTORNO PRECONFIGURADO DEL SISTEMA

Este entorno de desarrollo ya cuenta con todas las herramientas, credenciales y accesos globales configurados en la máquina:

### A. Credenciales y Conexión a Supabase Cloud (PostgreSQL)
- **Supabase Project URL:** `https://wephfzqyrjdqgrxmwypn.supabase.co`
- **Publishable Key (Frontend):** `sb_publishable_ady5n2IiVZHuNKXSdAEGAw_MkuOCC02`
- **Service Role Key (Backend Admin / Migrations):** `[CONFIGURED_IN_ENV_LOCAL]`
- **Database Password (Postgres Direct):** `[CONFIGURED_IN_ENV_LOCAL]`
- **Archivo de Entorno Local:** `.env.local` configurado con claves Ed25519 y Supabase.

### B. Claves Criptográficas Asimétricas Ed25519
- **PUBLIC KEY (HEX):** `909465fb30e096f87bc3ecba52288495c0ef7613a8210045ff15d9ca9b7e56b6`
- **PRIVATE KEY (HEX):** `a703af26b525b55db9fe7431c6d663f7032b6b4810581f264319b4d1a52736e8`

### C. Herramientas de Desarrollo y Git
- **Git Config:** Usuario `doumoments` | Correo `elpepinillojoseuwu@gmail.com`
- **GitHub CLI (`gh`):** Autenticado y vinculado a la cuenta `doumoments` con permisos de creación de repositorios remotos.
- **Rust Toolchain:** `rustc 1.98.0` / `cargo` (`stable-x86_64-pc-windows-msvc`) instalado y activo.
- **Node.js & NPM:** `v24.19.0` / `npm 11.17.0` instalado.
- **Vercel CLI:** Instalado y autenticado.

---

## 2. ROL DEL AGENTE Y VISIÓN GENERAL DEL PRODUCTO

Eres un **Arquitecto de Software Principal y Desarrollador Autónomo Full-Stack Senior**. Tu objetivo es construir, configurar, probar, documentar y desplegar desde cero la arquitectura completa de **ChronosAgent SafeState**.

### Propósito Técnico de ChronosAgent SafeState
Los agentes de IA autónomos (basados en LLMs como GPT-4o, Claude 3.5 Sonnet, Llama 3) no operan mediante flujos de código estáticos: generan hipótesis en tiempo real y deciden dinámicamente qué herramientas invocar, qué código ejecutar y qué APIs consumir. Esta autonomía introduce riesgos operativos críticos:
- Alucinaciones que ejecutan comandos destructivos (`rm -rf`, DROP TABLE).
- Bucles infinitos de consumo de cómputo y APIs pagas.
- Modificaciones no deseadas o corrupciones en entornos de producción.

**ChronosAgent SafeState** resuelve esto mediante una capa de contención **Zero-Trust Runtime Guardrail Local-First**. Intercepta cada acción del agente antes de su consolidación en el sistema real, toma micro-instantáneas (snapshots) del estado informático mediante técnicas Copy-on-Write (CoW), evalúa la intención contra políticas de seguridad estrictas y ejecuta una reversión determinista (rollback) a nivel de memoria, disco y estado de API externa si el agente se desvía de los parámetros permitidos.

---

## 3. ARQUITECTURA MODULAR DEL SISTEMA (5 SUBSISTEMAS + CAPA DE LICENCIAMIENTO)

```text
┌─────────────────────────────────────────────────────────────┐
│                       Agente de IA                          │
│         (LangChain / AutoGen / CrewAI / Python / TS)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Agent Sandbox Runtime (Aislamiento de Procesos / Wasm)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Syscalls / Intercepción L7)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Intent & Syscall Proxy (Cortafuegos Semántico en Rust)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Validación de Estado)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CoW State Storage Engine (SQLite / RocksDB <10ms)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Anomalía / Violación)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Saga External Compensation Engine (Reversión de APIs)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Telemetría / Replay)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Time-Travel Debugging Console (React 19 + Tauri v2)      │
└─────────────────────────────────────────────────────────────┘
```

### A. Subsystem 1: Agent Sandbox Runtime (Aislamiento Ligero Local)
- Cada instancia de un agente autónomo se ejecuta dentro de un micro-sandbox efímero que aísla sus capacidades de ejecución.
- Soporte para envoltorio de procesos en Rust y entornos WebAssembly (Wasm).
- Tiempos de arranque inferiores a 10ms.

### B. Subsystem 2: Syscall & Network Proxy (El Guardián en Rust)
- Proxy de ultra-baja latencia desarrollado nativamente en Rust dentro de Tauri (`http://127.0.0.1:4040`).
- **Intercepción Total:**
  - Acciones de sistema y comandos.
  - Peticiones HTTP REST, gRPC y consultas SQL.
- **Cortafuegos Semántico (Intent Firewall):** Compara el prompt inicial y la traza de razonamiento (Chain-of-Thought) del agente con la acción técnica solicitada en menos de 15ms. Si el agente intenta ejecutar una acción que viola las políticas de seguridad (ej. borrar datos no autorizados), la bloquea de inmediato emitiendo una respuesta sintética controlada.

### C. Subsystem 3: CoW Snapshots & State Storage Engine (Motor de Reversión)
- Base de datos embebida local ultra-rápida (SQLite incrustado con latencia <10ms).
- Registra el estado diferencial de memoria, variables y transacciones antes de permitir que la acción se libere al exterior.

### D. Subsystem 4: Saga External Compensation Engine (Reversión Causal de APIs)
- Implementa el patrón arquitectónico Saga para APIs de terceros (Stripe, GitHub, Twilio, SendGrid, bases de datos externas):
  - *Acción del Agente:* `POST /v1/charges` (Crear cargo) -> *Acción Compensatoria Saga:* `POST /v1/refunds` (Reembolsar).
  - *Acción del Agente:* `POST /v1/issues` (Crear ticket) -> *Acción Compensatoria Saga:* `DELETE /v1/issues/{id}`.
- Si el agente falla o se cancela la ejecución, ChronosAgent ejecuta automáticamente el grafo de compensación inversa.

### E. Subsystem 5: Time-Travel Debugging & Audit Console (Frontend UI)
- Interfaz moderna y dinámica desarrollada en React 19, TypeScript y TailwindCSS empaquetada en Tauri v2.
- **Capacidades:**
  - Navegar la línea de tiempo de ejecución del agente paso a paso (*step-back / step-forward*).
  - Inspeccionar estado exacto de memoria, variables y peticiones antes y después de cada llamada.
  - Editor interactivo de Políticas de Seguridad (dominios permitidos, syscalls bloqueadas, tiempos máximos de ejecución).
  - Simulador de decisiones alternativas ajustando prompts.

### F. Capa Base: Seguridad y Licenciamiento Offline (Ed25519 + Supabase)
- **Módulo Criptográfico en Rust:**
  - Generación de huella digital de hardware inmutable (`machine_fingerprint` con SHA-256 de CPU/Placa base).
  - Verificación matemática de firmas Ed25519 con clave pública embebida.
  - Período de gracia fuera de línea (7 a 30 días) y anti-tamper de reloj local (detección de manipulación de fecha del sistema).
- **Sincronización con Supabase Cloud:** Activación de licencias y gestión de suscripciones.

---

## 4. INTEGRACIÓN PARA DESARROLLADORES (SDK HOOKS)

SDK ligero en Python y TypeScript que envuelve cualquier agente:

```python
from chronos_agent import SafeStateRuntime, Policy, SagaConnector

# 1. Definir la política de seguridad
policy = Policy(
    max_execution_time_sec=30,
    allowed_domains=["api.github.com", "api.stripe.com"],
    blocked_syscalls=["sys_raw_socket", "execve"],
    auto_rollback_on_error=True
)

# 2. Registrar conectores de compensación externa (Patrón Saga)
saga_engine = SagaConnector()
saga_engine.register(
    action="stripe.charge.create",
    compensate="stripe.refund.create"
)

# 3. Inicializar el Runtime Aislado
runtime = SafeStateRuntime(
    proxy_url="http://127.0.0.1:4040",
    policy=policy,
    saga=saga_engine
)

# 4. Ejecutar el agente dentro de la capa de contención determinista
with runtime.protect(agent_id="devops-auto-fixer-01"):
    agent.run("Analizar el despliegue y corregir configuración")
```

---

## 5. ESQUEMA DE BASE DE DATOS Y MIGRACIONES EN SUPABASE (POSTGRESQL)

El agente de código debe asegurarse de crear y desplegar todas las tablas y endpoints RPC en Supabase con Row Level Security (RLS) estricto:

### Tablas a Gestionar:
1. `profiles`: Extensión de usuarios de `auth.users` (`id`, `email`, `created_at`).
2. `subscriptions`: Estado de suscripción (`id`, `user_id`, `stripe_customer_id`, `status`, `current_period_end`).
3. `licenses`: Llaves de licencia (`id`, `user_id`, `license_key`, `max_devices`, `status`, `created_at`).
4. `device_activations`: Dispositivos vinculados (`id`, `license_id`, `machine_fingerprint`, `device_name`, `activated_at`, `last_seen_at`).
5. `agent_traces`: Registro de telemetría y auditoría de agentes (`id`, `user_id`, `agent_id`, `session_id`, `action_type`, `payload`, `verdict`, `latency_ms`, `created_at`).
6. `saga_compensations`: Historial de acciones compensatorias ejecutadas (`id`, `session_id`, `original_action`, `compensating_action`, `status`, `executed_at`).
7. `security_policies`: Plantillas de políticas de seguridad configurables (`id`, `user_id`, `name`, `policy_json`, `created_at`).

### Endpoints RPC en PostgreSQL (Zero-Cost Serverless):
- `activate_device_license(p_license_key, p_machine_fingerprint, p_device_name)`
- `verify_device_license(p_license_key, p_machine_fingerprint)`
- `log_agent_trace(p_agent_id, p_session_id, p_action_type, p_payload, p_verdict, p_latency_ms)`

---

## 6. HOJA DE RUTA Y FASES DE EJECUCIÓN AUTÓNOMA

El agente de código debe ejecutar todas las fases de forma autónoma:

```text
[FASE 1: Scaffolding Limpio (Tauri v2 + Rust + React 19 + TailwindCSS)]
  │
  ▼
[FASE 2: Migraciones de Base de Datos y RPCs en Supabase]
  │
  ▼
[FASE 3: Core en Rust (Proxy L7, Intent Firewall, Saga, CoW Engine, Cripto)]
  │
  ▼
[FASE 4: SDK de Integración (Python & TypeScript Hooks)]
  │
  ▼
[FASE 5: Frontend UI (Time-Travel Console, Network Inspector, Saga Dashboard)]
  │
  ▼
[FASE 6: Documentación Completa (README.md) y Pruebas Automatizadas]
  │
  ▼
[FASE 7: Repositorio Git y Publicación en GitHub (`gh repo create`)]
```

---

## 7. REGLAS DE CALIDAD Y EJECUCIÓN

- **Cero Código Omiso / Placeholders:** Escribe implementaciones reales completas. Prohibido dejar `// TODO`.
- **Manejo Riguroso de Errores:** Todos los comandos de Rust deben retornar `Result<T, String>` estructurados.
- **Seguridad:** Garantizar que `LICENSE_PRIVATE_KEY` y `service_role` NUNCA se incluyan en el código empaquetado del cliente.
- **Rendimiento:** Intercepción y guardarraíl con latencia total inferior a 20ms.
