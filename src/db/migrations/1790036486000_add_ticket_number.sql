-- Agrega un número de entrada secuencial global (independiente del UUID del
-- ticket), para mostrar como ID legible tipo "00000", "00001", etc.

-- Up Migration

ALTER TABLE tickets ADD COLUMN ticket_number SERIAL;
CREATE UNIQUE INDEX idx_tickets_ticket_number ON tickets(ticket_number);

-- Down Migration

DROP INDEX IF EXISTS idx_tickets_ticket_number;
ALTER TABLE tickets DROP COLUMN IF EXISTS ticket_number;
