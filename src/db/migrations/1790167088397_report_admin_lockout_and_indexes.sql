-- Endurecimiento de cara a producción: bloqueo temporal tras varios intentos
-- fallidos de contraseña de un admin de reportes, un campo para recordar qué
-- artista pidió por mail mientras todavía está ingresando la contraseña
-- (disparador "informe final"/"reporte final" + artista), e índice para que
-- las consultas de reporte por artista no escaneen toda la tabla orders.

-- Up Migration

ALTER TABLE report_admin_sessions
  ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN pending_email_query TEXT;

CREATE INDEX idx_orders_artist ON orders(artist_id);

-- Down Migration

DROP INDEX IF EXISTS idx_orders_artist;
ALTER TABLE report_admin_sessions
  DROP COLUMN IF EXISTS pending_email_query,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS failed_attempts;
