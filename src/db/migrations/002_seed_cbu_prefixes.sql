-- Tabla de prefijos de CBU/CVU (primeros 3 dígitos = código de entidad BCRA) -> nombre de banco.
-- Se cargan acá solo un par de entidades ampliamente conocidas como punto de partida.
-- IMPORTANTE: esta tabla está incompleta a propósito. Antes de ir a producción hay que
-- completarla con el padrón oficial y actualizado de entidades financieras del BCRA
-- (https://www.bcra.gob.ar, sección "Entidades financieras" / "Códigos de entidad"),
-- para no asociar mal una transferencia a un banco incorrecto en el reporte final.
-- Ver scripts/seedCbuPrefixes.ts para cargar un CSV completo desde data/cbu_prefixes.csv.

-- Up Migration

INSERT INTO cbu_bank_prefixes (prefix, bank_name) VALUES
  ('011', 'Banco de la Nación Argentina'),
  ('014', 'Banco de la Provincia de Buenos Aires'),
  ('007', 'Banco Galicia'),
  ('029', 'Banco Ciudad')
ON CONFLICT (prefix) DO NOTHING;

-- Down Migration

DELETE FROM cbu_bank_prefixes WHERE prefix IN ('011', '014', '007', '029');
