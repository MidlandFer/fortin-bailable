-- Esquema inicial de Fortín Bailable

-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE artists (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE presale_stages (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock_limit INTEGER CHECK (stock_limit IS NULL OR stock_limit >= 0),
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  reserved_count INTEGER NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presale_stages_artist ON presale_stages(artist_id);

CREATE TABLE whatsapp_conversations (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  current_state TEXT NOT NULL DEFAULT 'INICIO',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_order_id INTEGER,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  artist_id INTEGER NOT NULL REFERENCES artists(id),
  stage_id INTEGER NOT NULL REFERENCES presale_stages(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  distinguishing_offset NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  buyer_name TEXT,
  buyer_dni TEXT,
  buyer_cuit_cuil TEXT,
  status TEXT NOT NULL DEFAULT 'reservado'
    CHECK (status IN ('reservado', 'esperando_pago', 'pago_confirmado', 'expirado', 'cancelado')),
  comprobante_media_id TEXT,
  mp_payment_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_phone ON orders(phone_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stage ON orders(stage_id);

ALTER TABLE whatsapp_conversations
  ADD CONSTRAINT fk_active_order FOREIGN KEY (active_order_id) REFERENCES orders(id);

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  unit_index INTEGER NOT NULL,
  qr_payload TEXT,
  qr_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'generado', 'usado')),
  generated_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by_device_id INTEGER,
  UNIQUE (order_id, unit_index)
);

CREATE INDEX idx_tickets_order ON tickets(order_id);
CREATE INDEX idx_tickets_status ON tickets(status);

CREATE TABLE mp_payments (
  id SERIAL PRIMARY KEY,
  mp_payment_id TEXT NOT NULL UNIQUE,
  raw_payload JSONB NOT NULL,
  transaction_amount NUMERIC(10, 2) NOT NULL,
  date_created TIMESTAMPTZ NOT NULL,
  payer_cbu_cvu TEXT,
  payer_identification JSONB,
  bank_name_resolved TEXT,
  matched_order_id INTEGER REFERENCES orders(id),
  matched_at TIMESTAMPTZ,
  match_method TEXT CHECK (match_method IS NULL OR match_method IN ('auto', 'manual')),
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mp_payments_amount ON mp_payments(transaction_amount);
CREATE INDEX idx_mp_payments_matched_order ON mp_payments(matched_order_id);

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_mp_payment FOREIGN KEY (mp_payment_id) REFERENCES mp_payments(id);

CREATE TABLE cbu_bank_prefixes (
  prefix CHAR(3) PRIMARY KEY,
  bank_name TEXT NOT NULL
);

CREATE TABLE scanner_devices (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tickets
  ADD CONSTRAINT fk_tickets_device FOREIGN KEY (used_by_device_id) REFERENCES scanner_devices(id);

CREATE TABLE scan_logs (
  id SERIAL PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id),
  device_id INTEGER REFERENCES scanner_devices(id),
  result TEXT NOT NULL CHECK (result IN ('ok', 'ya_usado', 'invalido', 'no_encontrado')),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB
);

CREATE INDEX idx_scan_logs_ticket ON scan_logs(ticket_id);

CREATE TABLE venue_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tabla de sesiones para el panel admin (usada por connect-pg-simple)
CREATE TABLE session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
)
WITH (OIDS = FALSE);

ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX idx_session_expire ON session(expire);

-- Down Migration

DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS venue_info;
DROP TABLE IF EXISTS scan_logs;
DROP TABLE IF EXISTS scanner_devices CASCADE;
DROP TABLE IF EXISTS cbu_bank_prefixes;
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS fk_orders_mp_payment;
DROP TABLE IF EXISTS mp_payments;
DROP TABLE IF EXISTS tickets;
ALTER TABLE IF EXISTS whatsapp_conversations DROP CONSTRAINT IF EXISTS fk_active_order;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS whatsapp_conversations;
DROP TABLE IF EXISTS presale_stages;
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS admins;
