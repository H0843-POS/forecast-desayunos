-- Tabla prefacturaciones
CREATE TABLE IF NOT EXISTS prefacturaciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_facturacion date NOT NULL,
  hoteles jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índice para consultas recientes
CREATE INDEX IF NOT EXISTS prefacturaciones_created_at_idx ON prefacturaciones(created_at DESC);
CREATE INDEX IF NOT EXISTS prefacturaciones_fecha_idx ON prefacturaciones(fecha_facturacion DESC);

-- RLS desactivado (uso interno, no público)
ALTER TABLE prefacturaciones DISABLE ROW LEVEL SECURITY;
