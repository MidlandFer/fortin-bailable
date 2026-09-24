-- Se elimina el envío del reporte de ventas por mail ("informe final"/"reporte
-- final" + artista), así que ya no hace falta recordar qué artista se pidió
-- mientras el admin ingresaba la contraseña. Correr después de desplegar el
-- código que ya no usa esta columna.

-- Up Migration

ALTER TABLE report_admin_sessions DROP COLUMN IF EXISTS pending_email_query;

-- Down Migration

ALTER TABLE report_admin_sessions ADD COLUMN pending_email_query TEXT;
