# Fortín Bailable — Bot de venta de entradas por WhatsApp

Sistema para vender entradas por artista vía WhatsApp, cobrar por transferencia
(Mercado Pago), emitir entradas con QR, controlar el ingreso el día del evento
desde varios celulares, y generar/enviar el reporte de ventas por mail.

Ver el plan completo de arquitectura y roadmap en
`C:\Users\Usuario\.claude\plans\necesito-que-te-p-ngas-iridescent-crab.md`.

## Estado actual

Implementado y probado: venta de entradas por WhatsApp (por artista, con
preventa y stock), emisión de entradas con QR firmado, control de acceso por
WhatsApp (verificadores que escanean/mandan el QR), y el bot de admins de
reportes de venta (con envío del reporte por mail a pedido). El auto-deploy a
Coolify está armado pero sin activar (ver más abajo). **Lo único que falta
para estar 100% en producción es Mercado Pago real** (hoy corre en modo mock:
confirma el pago sin corroborarlo, porque no hay `MERCADOPAGO_ACCESS_TOKEN` de
producción cargado todavía).

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
nuevo deploy manualmente (por la API de Coolify o desde su panel), salvo que
actives el workflow de auto-deploy ya armado — ver la sección "Auto-deploy"
más abajo.

La capa de IA (Anthropic) no está implementada; `ANTHROPIC_API_KEY` queda
cargada en el `.env` para cuando se defina qué uso puntual se le va a dar.

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
- `npm run seed:report-admins` — carga/actualiza las contraseñas de los 3
  números de WhatsApp habilitados como admins de reportes de venta (completar
  `REPORT_ADMIN_PASSWORD_1/2/3` en el `.env` antes de correrlo)
- `npm run lint` / `npm run typecheck` — chequeos de calidad de código

## Reportes de venta por WhatsApp (admins)

Los 3 números de WhatsApp cargados en `report_admins` (ver
`scripts/seedReportAdmins.ts`) pueden pedirle al bot un resumen de ventas:
escriben *informe* o *resumen*, el bot les pide la contraseña, y una vez
logueados eligen por número un artista puntual (entradas vendidas, monto
transferido y detalle de cada transferencia, separando *preventa* de
*entrada general* cuando corresponda) o el resumen general con el total de
todos los artistas.

- La sesión se cierra sola tras `REPORT_ADMIN_SESSION_IDLE_MINUTES` sin
  actividad, o antes si escriben *salir*.
- Tras 5 contraseñas incorrectas seguidas, el número queda bloqueado 15
  minutos (`REPORT_ADMIN_MAX_FAILED_ATTEMPTS` / `REPORT_ADMIN_LOCKOUT_MINUTES`
  en `src/config/constants.ts`).
- Escribiendo *informe final `<artista>`* o *reporte final `<artista>`* (antes
  o después de loguearse) se manda por mail el reporte de ese artista puntual,
  con un Excel adjunto (resumen + detalle de cada transferencia) a las
  direcciones cargadas en `ADMIN_EMAILS`. Si `GMAIL_USER` /
  `GMAIL_APP_PASSWORD` / `ADMIN_EMAILS` no están completos, el bot avisa que
  el envío no está configurado en vez de fallar en silencio.

Al cargar una etapa de venta (`presale_stages`) nueva a mano por SQL, hay que
indicar su `stage_type` (`'general'` o `'preventa'`); si se omite, queda como
`'general'` por default.

## Auto-deploy (Fase 9)

Hay un workflow en `.github/workflows/deploy.yml` que dispara un deploy en
Coolify en cada push a `main`, pero está inactivo hasta que cargues estos
secrets en el repo de GitHub (`Settings > Secrets and variables > Actions`):

- `COOLIFY_DEPLOY_WEBHOOK_URL` (obligatorio): la URL de webhook de deploy de
  esta app, desde el panel de Coolify (sección del recurso de la app →
  Webhooks, o la URL de deploy de su API).
- `COOLIFY_API_TOKEN` (opcional): solo si el método que uses en Coolify pide
  un token vía header `Authorization: Bearer`, en vez de una URL de webhook
  autocontenida.

Mientras no cargues esos secrets, seguí disparando el deploy a mano como
hasta ahora — el workflow no rompe nada, simplemente falla (avisando qué
falta) si corre sin el secret configurado.

## Notas importantes

- **Mercado Pago no tiene sandbox para transferencias por alias/CVU.** La
  Fase 4 (verificación de pagos) requiere probar con transferencias reales
  de bajo monto — ver la sección 5 del plan.
- No confirmar el webhook de WhatsApp contra el número real de negocio hasta
  completar la Fase 9 (la verificación de negocio ante Meta puede tardar
  varios días).

## Checklist para dejar todo en producción (solo falta Mercado Pago)

1. **Variables de entorno en Coolify** (además de las que ya están para que
   el webhook de WhatsApp funcione): `REPORT_ADMIN_SESSION_IDLE_MINUTES`
   (opcional, default 15), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_EMAILS`.
   `REPORT_ADMIN_PASSWORD_1/2/3` solo hacen falta un momento, para el paso 3.
2. **Migraciones**: correr `npm run migrate:up` contra la base de producción
   (agrega `stage_type`, `report_admins`, `report_admin_sessions`, el índice
   de `orders.artist_id`, y elimina la tabla de prefijos de CBU que ya no se
   usa).
3. **Seed de admins de reportes**: con `REPORT_ADMIN_PASSWORD_1/2/3` cargadas,
   correr `npm run seed:report-admins` apuntando a producción, y después
   borrar esas 3 variables (las contraseñas ya quedaron hasheadas en la base).
4. **Revisar `stage_type`** de las etapas de venta que ya estén cargadas en
   producción: por default quedan en `'general'`; actualizar a `'preventa'`
   a mano (`UPDATE presale_stages SET stage_type = 'preventa' WHERE id = ...`)
   las que correspondan.
5. **Deploy**: disparar el deploy en Coolify (manual, o activar el
   auto-deploy de la sección anterior) para que tome todo el código nuevo.
6. **Pendiente único: Mercado Pago.** Cargar el `MERCADOPAGO_ACCESS_TOKEN`
   real de producción (y `MERCADOPAGO_WEBHOOK_SECRET` si corresponde) para
   que la confirmación de pago deje de usar el modo mock y empiece a validar
   contra la API de Mercado Pago de verdad.
