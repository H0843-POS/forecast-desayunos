-- Horario restaurante · Libro de cambios de planning
-- Pegar en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

-- Cada fila del libro = un cambio pedido por/para un colaborador.
-- Las filas automáticas agrupan los cambios de turno que se hacen seguidos
-- (p. ej. mover un libre del martes al jueves = una sola fila).
create table if not exists hr_libro (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  fecha_peticion date not null,
  empleado_id uuid references hr_empleados(id) on delete set null,
  empleado_nombre text not null check (char_length(empleado_nombre) between 1 and 60),
  detalle text not null check (char_length(detalle) between 1 and 400),
  -- cambios automáticos: [{fecha, antes, despues, con?}]
  cambios jsonb not null default '[]'::jsonb,
  -- true = escrito o retocado a mano (ya no se le añaden cambios automáticos)
  detalle_manual boolean not null default false,
  hoja integer,
  impreso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_libro_hoja_idx on hr_libro (hoja, numero);
create index if not exists hr_libro_abiertas_idx on hr_libro (empleado_id, updated_at) where hoja is null;

create table if not exists hr_libro_hojas (
  numero integer primary key,
  impreso_at timestamptz not null default now(),
  firmada boolean not null default false,
  firmada_at timestamptz
);

-- El historial de ajustes apunta a la fila del libro que lo recoge
alter table hr_ajustes add column if not exists libro_id uuid references hr_libro(id) on delete set null;

alter table hr_libro       enable row level security;
alter table hr_libro_hojas enable row level security;

-- Cierra las filas pendientes en hojas numeradas (15 filas por hoja).
-- p_solo_llenas = true deja sin imprimir la última hoja si no está completa.
-- Con bloqueo para que dos impresiones a la vez no repitan número de hoja.
create or replace function hr_libro_imprimir(p_filas integer, p_solo_llenas boolean)
returns integer[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
  pendientes integer;
  hojas integer[] := '{}';
begin
  if p_filas is null or p_filas < 1 or p_filas > 30 then
    raise exception 'p_filas fuera de rango';
  end if;
  perform pg_advisory_xact_lock(843001);
  select coalesce(max(numero), 0) into n from hr_libro_hojas;
  loop
    select count(*) into pendientes from hr_libro where hoja is null;
    exit when pendientes = 0 or (p_solo_llenas and pendientes < p_filas);
    n := n + 1;
    insert into hr_libro_hojas (numero) values (n);
    update hr_libro set hoja = n, impreso_at = now()
      where id in (select id from hr_libro where hoja is null order by numero limit p_filas);
    hojas := hojas || n;
  end loop;
  return hojas;
end;
$$;

revoke all on function hr_libro_imprimir(integer, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function hr_libro_imprimir(integer, boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function hr_libro_imprimir(integer, boolean) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function hr_libro_imprimir(integer, boolean) to service_role;
  end if;
end $$;
