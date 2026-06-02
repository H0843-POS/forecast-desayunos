-- Tabla para guardar forecasts generados
CREATE TABLE IF NOT EXISTS forecasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  novotel_data jsonb NOT NULL,
  ibis_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índice para consultas por fecha
CREATE INDEX IF NOT EXISTS forecasts_fecha_inicio_idx ON forecasts(fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS forecasts_created_at_idx ON forecasts(created_at DESC);
