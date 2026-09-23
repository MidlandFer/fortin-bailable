-- Elimina la funcionalidad de padrón de bancos por prefijo de CBU/CVU: nunca se usó
-- desde el código (no había ningún lookup contra cbu_bank_prefixes) y no hace falta
-- resolver el banco emisor de la transferencia.

-- Up Migration

ALTER TABLE mp_payments
  DROP COLUMN IF EXISTS payer_cbu_cvu,
  DROP COLUMN IF EXISTS bank_name_resolved;

DROP TABLE IF EXISTS cbu_bank_prefixes;

-- Down Migration

CREATE TABLE cbu_bank_prefixes (
  prefix CHAR(3) PRIMARY KEY,
  bank_name TEXT NOT NULL
);

ALTER TABLE mp_payments
  ADD COLUMN payer_cbu_cvu TEXT,
  ADD COLUMN bank_name_resolved TEXT;
