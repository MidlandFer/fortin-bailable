# Fortín Bailable — Bot de venta de entradas por WhatsApp

Sistema para vender entradas por artista vía WhatsApp, cobrar por transferencia
(Mercado Pago), emitir entradas con QR, controlar el ingreso el día del evento
desde varios celulares, y generar/enviar el reporte de ventas por mail.

Ver el plan completo de arquitectura y roadmap en
`C:\Users\Usuario\.claude\plans\necesito-que-te-p-ngas-iridescent-crab.md`.

## Estado actual

**Fase 1 y Fase 2 completas** (esqueleto, esquema de base de datos, healthcheck,
webhook de WhatsApp Cloud API funcionando de punta a punta con eco simple) **y
Fase 9 adelantada parcialmente** (infraestructura de hosting ya operativa,
aunque el resto de las fases del roadmap todavía no está implementado).

### WhatsApp Cloud API — estado

- **Número real en producción**: `+54 2284 15-54-2607`, dedicado 100% a la
  Cloud API (no lo uses en ninguna app de WhatsApp instalada, se
  desconfiguraría).
- **App de Meta**: "Fortin Bailable" (`developers.facebook.com`, app id
  `1075933261860482`), WhatsApp Business Account "fortin"
  (`2136530420265686`).
- **Token de acceso**: generado desde un **System User** (`FortinBailableBot`,
  rol Admin) en Business Settings, con expiración **"Nunca"** y permisos
  `whatsapp_business_messaging` + `whatsapp_business_management`. Los tokens
  generados desde el botón rápido de "Paso 1: Pruébalo" son de corta duración
  y no sirven para producción — ya causaron una falla real en esta sesión.
- **App sin publicar todavía**: para escalar a muchos usuarios en algún
  momento va a hacer falta completar "Paso 3: Verificación del negocio" en
  Meta — no bloquea el uso actual con el número propio.

### Infraestructura desplegada

- **Servidor**: VPS de Hostinger (Ubuntu 24.04) con [Coolify](https://coolify.io)
  como plataforma de despliegue (Docker + Traefik + Let's Encrypt automático).
- **Panel de Coolify**: `https://appfortin.fortinbailable.com` (no confundir
  con el dominio de la app — ver nota abajo).
- **App en producción**: `https://bot.fortinbailable.com` — healthcheck en
  `/health`. Este va a ser el dominio del webhook de WhatsApp (Fase 2).
- **Base de datos**: Postgres 16 provisionado como recurso de Coolify dentro
  del proyecto "Fortin Bailable" (ambiente "production"), con las migraciones
  de `src/db/migrations/` ya aplicadas y el usuario admin inicial ya creado.
- **Repositorio**: `github.com/MidlandFer/fortin-bailable` (privado). Coolify
  hace pull vía deploy key propia; el push desde esta PC usa otra deploy key
  dedicada (`~/.ssh/fortin_bailable_github`).
- **Acceso SSH al servidor**: por clave (`~/.ssh/fortin_bailable_deploy`),
  usuario `root`. El login por contraseña sigue habilitado por ahora.

**⚠️ Importante — dominios**: `appfortin.fortinbailable.com` está reservado
para el panel de Coolify (así se configuró al instalar Coolify en el
servidor). Cualquier app nueva que se despliegue en este mismo servidor tiene
que usar un subdominio *distinto* (ej. `bot`, `admin`, `scanner`) — asignarle
el mismo dominio que Coolify genera un conflicto de ruteo en Traefik.

El deploy no es automático todavía: cada `git push` requiere disparar un
nuevo deploy manualmente (por la API de Coolify o desde su panel). Configurar
el webhook de auto-deploy queda pendiente para cuando se retome la Fase 9
formalmente.

Las fases siguientes del roadmap (bot de WhatsApp, Mercado Pago, capa de IA,
panel admin, PWA de escaneo, reportes) todavía no están implementadas y se
van a ir agregando de forma incremental.

## Requisitos

- Node.js 20.x (el proyecto fija `engines.node` en `20.x`; localmente se probó
  también con Node 24, pero para producción usar 20 LTS)
- Docker Desktop (para levantar Postgres local y, eventualmente, correr todo
  el stack en contenedores) — **no estaba instalado en esta máquina al momento
  de armar el esqueleto**, hay que instalarlo antes de poder correr las
  migraciones y probar el servidor contra una base de datos real.
- Una cuenta de Mercado Pago con Access Token (Fase 4)
- Una app de Meta for Developers con el producto WhatsApp habilitado (Fase 2)
- Una cuenta de Gmail con contraseña de aplicación (Fase 8)
- Un API key de Anthropic (Fase 3.5)

## Setup local

```bash
npm install

cp .env.example .env
# completar .env con las credenciales reales a medida que se vayan
# implementando las integraciones. QR_SIGNING_SECRET, SESSION_SECRET y
# JWT_SECRET pueden generarse con: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# Levantar Postgres local (requiere Docker Desktop instalado y corriendo)
docker compose -f docker/docker-compose.yml up -d postgres

# Correr las migraciones
npm run migrate:up

# Crear el primer usuario admin (usa ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD del .env)
npm run seed:admin

# (Opcional) completar la tabla de prefijos de CBU con el padrón del BCRA
# ver el comentario en scripts/seedCbuPrefixes.ts
npm run seed:cbu

# Levantar el servidor en modo desarrollo
npm run dev
```

Con el servidor corriendo, `GET http://localhost:3000/health` debe devolver
`{"status":"ok","db":"up"}` una vez que Postgres esté disponible y las
migraciones se hayan corrido.

## Scripts

- `npm run dev` — servidor en modo desarrollo con recarga automática
- `npm run build` / `npm start` — build de producción
- `npm run migrate:up` / `npm run migrate:down` — migraciones de base de datos
- `npm run seed:admin` — crea/actualiza el usuario admin inicial
- `npm run seed:cbu` — carga el padrón de prefijos CBU/CVU desde `data/cbu_prefixes.csv`
- `npm run lint` / `npm run typecheck` — chequeos de calidad de código

## Notas importantes

- **`cbu_bank_prefixes`** solo tiene 4 bancos cargados como placeholder
  (Nación, Provincia, Galicia, Ciudad). Antes de ir a producción hay que
  completarla con el padrón oficial del BCRA — ver el comentario en
  `scripts/seedCbuPrefixes.ts`.
- **Mercado Pago no tiene sandbox para transferencias por alias/CVU.** La
  Fase 4 (verificación de pagos) requiere probar con transferencias reales
  de bajo monto — ver la sección 5 del plan.
- No confirmar el webhook de WhatsApp contra el número real de negocio hasta
  completar la Fase 9 (la verificación de negocio ante Meta puede tardar
  varios días).
