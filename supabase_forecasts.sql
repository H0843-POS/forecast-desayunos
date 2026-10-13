-- Tabla donde la app "Previsión de ocupación" guarda cada forecast generado.
-- El horario del restaurante lee la ocupación de aquí. Idempotente.
create extension if not exists pgcrypto;

create table if not exists forecasts (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio date,
  fecha_fin date,
  novotel_data jsonb not null,
  ibis_data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists forecasts_created_at_idx on forecasts (created_at desc);

-- Solo se accede desde el servidor con la service key
alter table forecasts enable row level security;
