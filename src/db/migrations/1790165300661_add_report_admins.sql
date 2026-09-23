-- Reportes de ventas por WhatsApp para administradores: 3 números habilitados que,
-- tras validar una contraseña propia, pueden consultar entradas vendidas e ingresos
-- por artista (separando preventa de entrada general) y un resumen general.

-- Up Migration

ALTER TABLE presale_stages
  ADD COLUMN stage_type TEXT NOT NULL DEFAULT 'general'
    CHECK (stage_type IN ('general', 'preventa'));

CREATE TABLE report_admins (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estado de a lo sumo una fila por admin: authenticated=false mientras espera
-- que mande la contraseña (después de escribir "informe"/"resumen"),
-- authenticated=true una vez logueado. Su ausencia, o un last_activity_at
-- vencido (en cualquiera de los dos casos), significa que hay que volver a
-- escribir "informe"/"resumen" desde cero. Se upsertea por phone_number, así
-- que nunca crece más allá de la cantidad de admins.
CREATE TABLE report_admin_sessions (
  phone_number TEXT PRIMARY KEY REFERENCES report_admins(phone_number) ON DELETE CASCADE,
  authenticated BOOLEAN NOT NULL DEFAULT false,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS report_admin_sessions;
DROP TABLE IF EXISTS report_admins;
ALTER TABLE presale_stages DROP COLUMN IF EXISTS stage_type;
