-- =====================================================================
-- Módulo HORARIO — actualización 2: partidos sincronizados automáticamente
-- Ejecutar en Supabase (proyecto del HOTEL) → SQL Editor, DESPUÉS de
-- supabase_horario.sql. Idempotente: se puede ejecutar más de una vez.
-- =====================================================================

-- Partidos importados de football-data.org (los manuales no llevan external_id)
alter table hr_eventos_ciudad add column if not exists external_id text;
alter table hr_eventos_ciudad add column if not exists competicion text
  check (competicion is null or char_length(competicion) <= 40);
-- true = se juega en Madrid (el equipo de Madrid juega en casa)
alter table hr_eventos_ciudad add column if not exists en_madrid boolean not null default false;

-- índice único normal (los NULL no chocan entre sí), necesario para el upsert
create unique index if not exists hr_eventos_ciudad_external_id_key
  on hr_eventos_ciudad (external_id);

-- La descripción de un partido puede ser algo más larga ("Club Atlético de Madrid - …")
alter table hr_eventos_ciudad drop constraint if exists hr_eventos_ciudad_descripcion_check;
alter table hr_eventos_ciudad add constraint hr_eventos_ciudad_descripcion_check
  check (char_length(descripcion) between 1 and 120);

-- Registro de la última sincronización (para mostrarla en la app)
insert into hr_config (clave, valor) values ('partidos_sync', '{}'::jsonb)
on conflict (clave) do nothing;

-- Notas libres por empleado ("le debemos L23", etc.)
alter table hr_empleados add column if not exists notas text
  check (notas is null or char_length(notas) <= 500);

-- Libres numerados por semana: a qué semana corresponde cada L (lunes de esa semana).
-- Vacío = la semana en la que cae. Si un libre de la semana 40 se da en la 42,
-- se marca libre_de = lunes de la semana 40 y la app lo muestra como L40.
alter table hr_asignaciones add column if not exists libre_de date;
alter table hr_asignaciones drop constraint if exists hr_asignaciones_libre_de_check;
alter table hr_asignaciones add constraint hr_asignaciones_libre_de_check
  check (libre_de is null or (tipo = 'L' and extract(isodow from libre_de) = 1));
