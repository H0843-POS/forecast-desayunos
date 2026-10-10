-- =====================================================================
-- Módulo HORARIO (restaurante) — forecast-desayunos
-- Ejecutar en Supabase (proyecto del HOTEL) → SQL Editor. Es idempotente:
-- se puede ejecutar más de una vez sin romper nada.
--
-- Seguridad: todas las tablas hr_* llevan RLS activado SIN políticas.
-- Eso bloquea la clave anon/publishable; la app accede solo desde el
-- servidor con la service key, que ignora RLS.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Empleados (plantilla y extras habituales con nombre) ----------
create table if not exists hr_empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 60),
  tipo text not null default 'plantilla' check (tipo in ('plantilla','extra')),
  horas_contrato numeric(4,1) check (horas_contrato is null or (horas_contrato >= 0 and horas_contrato <= 60)),
  saldo_festivos_inicial numeric(4,1) not null default 0,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Catálogo de turnos ----------
create table if not exists hr_turnos (
  codigo text primary key check (codigo ~ '^[A-Z0-9]{1,5}$'),
  inicio time not null,
  fin time not null,
  orden int not null default 0,
  activo boolean not null default true
);

insert into hr_turnos (codigo, inicio, fin, orden) values
  ('AP',  '05:30', '13:30', 1),
  ('M7',  '07:00', '15:00', 2),
  ('M8',  '08:00', '16:00', 3),
  ('M9',  '09:00', '17:00', 4),
  ('P13', '13:00', '21:00', 5),
  ('P14', '14:00', '22:00', 6),
  ('T16', '16:00', '00:00', 7),
  ('T17', '17:00', '01:00', 8),
  ('T18', '18:00', '02:00', 9)
on conflict (codigo) do nothing;

-- ---------- Asignaciones: UNA fila por empleado y día ----------
-- tipo: T = turno, L = libre, V = vacaciones, BJ = baja, FO = formación,
--       B = festivo devuelto (descuenta de la bolsa de festivos)
create table if not exists hr_asignaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references hr_empleados(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('T','L','V','BJ','FO','B')),
  turno text references hr_turnos(codigo) on update cascade on delete set null,
  inicio time,
  fin time,
  inicio2 time,
  fin2 time,
  horas numeric(4,2) check (horas is null or (horas >= 0 and horas <= 14)),
  nota text check (nota is null or char_length(nota) <= 200),
  updated_at timestamptz not null default now(),
  unique (empleado_id, fecha),
  check (tipo <> 'T' or turno is not null or (inicio is not null and fin is not null)),
  check ((inicio2 is null) = (fin2 is null))
);
create index if not exists hr_asignaciones_fecha_idx on hr_asignaciones (fecha);

-- ---------- Extras (ETT anónimos o refuerzos sin ficha) ----------
create table if not exists hr_extras (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cantidad int not null check (cantidad between 1 and 50),
  inicio time not null,
  fin time not null,
  motivo text not null default 'refuerzo' check (motivo in ('evento','ocupacion','refuerzo','otro')),
  origen text not null default 'ETT' check (char_length(origen) between 1 and 40),
  nota text check (nota is null or char_length(nota) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists hr_extras_fecha_idx on hr_extras (fecha);

-- ---------- Eventos del hotel ----------
create table if not exists hr_eventos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora time,
  -- si no hay hora se indica la franja; con hora la franja se deduce
  franja text check (franja is null or franja in ('manana','mediodia','tarde')),
  pax int check (pax is null or (pax >= 0 and pax <= 5000)),
  tipo text check (tipo is null or char_length(tipo) <= 40),
  nombre text check (nombre is null or char_length(nombre) <= 80),
  nota text check (nota is null or char_length(nota) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists hr_eventos_fecha_idx on hr_eventos (fecha);

-- ---------- Eventos de la ciudad (fútbol, conciertos, ferias...) ----------
create table if not exists hr_eventos_ciudad (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora time,
  categoria text not null default 'futbol' check (categoria in ('futbol','concierto','feria','otro')),
  descripcion text not null check (char_length(descripcion) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists hr_eventos_ciudad_fecha_idx on hr_eventos_ciudad (fecha);

-- ---------- Festivos ----------
create table if not exists hr_festivos (
  fecha date primary key,
  nombre text not null check (char_length(nombre) between 1 and 60),
  ambito text not null check (ambito in ('nacional','autonomico','local'))
);

-- 2026 ciudad de Madrid (BOCM / Ayuntamiento)
insert into hr_festivos (fecha, nombre, ambito) values
  ('2026-01-01','Año Nuevo','nacional'),
  ('2026-01-06','Epifanía del Señor','nacional'),
  ('2026-04-02','Jueves Santo','autonomico'),
  ('2026-04-03','Viernes Santo','nacional'),
  ('2026-05-01','Fiesta del Trabajo','nacional'),
  ('2026-05-02','Fiesta de la Comunidad de Madrid','autonomico'),
  ('2026-05-15','San Isidro','local'),
  ('2026-08-15','Asunción de la Virgen','nacional'),
  ('2026-10-12','Fiesta Nacional de España','nacional'),
  ('2026-11-02','Todos los Santos (trasladado)','autonomico'),
  ('2026-11-09','Nuestra Señora de la Almudena','local'),
  ('2026-12-07','Día de la Constitución (trasladado)','autonomico'),
  ('2026-12-08','Inmaculada Concepción','nacional'),
  ('2026-12-25','Navidad','nacional'),
-- 2027 Comunidad de Madrid (aprobado por el Consejo de Gobierno).
-- Los 2 locales de Madrid capital 2027 aún no están publicados: añadirlos
-- desde la app cuando salgan.
  ('2027-01-01','Año Nuevo','nacional'),
  ('2027-01-06','Epifanía del Señor','nacional'),
  ('2027-03-19','San José','autonomico'),
  ('2027-03-25','Jueves Santo','autonomico'),
  ('2027-03-26','Viernes Santo','nacional'),
  ('2027-05-01','Fiesta del Trabajo','nacional'),
  ('2027-08-16','Asunción de la Virgen (trasladado)','autonomico'),
  ('2027-10-12','Fiesta Nacional de España','nacional'),
  ('2027-11-01','Todos los Santos','nacional'),
  ('2027-12-06','Día de la Constitución','nacional'),
  ('2027-12-08','Inmaculada Concepción','nacional'),
  ('2027-12-25','Navidad','nacional')
on conflict (fecha) do nothing;

-- ---------- Datos por día: ocupación manual y notas por franja ----------
create table if not exists hr_dias (
  fecha date primary key,
  ocupacion_manual int check (ocupacion_manual is null or (ocupacion_manual >= 0 and ocupacion_manual <= 5000)),
  nota_manana text check (nota_manana is null or char_length(nota_manana) <= 200),
  nota_mediodia text check (nota_mediodia is null or char_length(nota_mediodia) <= 200),
  nota_tarde text check (nota_tarde is null or char_length(nota_tarde) <= 200)
);

-- ---------- Meses publicados (a partir de aquí los cambios son "ajustes") ----------
create table if not exists hr_meses (
  mes date primary key check (extract(day from mes) = 1),
  publicado_at timestamptz not null default now()
);

-- ---------- Historial de ajustes ----------
create table if not exists hr_ajustes (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  empleado_id uuid references hr_empleados(id) on delete set null,
  empleado_nombre text not null,
  antes text not null,
  despues text not null,
  created_at timestamptz not null default now()
);
create index if not exists hr_ajustes_fecha_idx on hr_ajustes (fecha);

-- ---------- Configuración (reglas de cobertura) ----------
create table if not exists hr_config (
  clave text primary key,
  valor jsonb not null
);

insert into hr_config (clave, valor) values ('cobertura', '{
  "laborable": { "manana": 4, "mediodia": 4, "tarde": 4 },
  "finde":     { "manana": 4, "mediodia": 2, "tarde": 4 },
  "finde_por_centena": true,
  "festivo_como_finde": true,
  "codigos_obligatorios": ["AP","M7","M8","M9"],
  "min_libres_semana": 2
}'::jsonb)
on conflict (clave) do nothing;

-- ---------- Intentos de login (freno a fuerza bruta) ----------
create table if not exists hr_login_intentos (
  id bigint generated always as identity primary key,
  ip text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists hr_login_intentos_ip_idx on hr_login_intentos (ip, created_at desc);

-- ---------- RLS: activado y sin políticas en todas las tablas hr_* ----------
alter table hr_empleados       enable row level security;
alter table hr_turnos          enable row level security;
alter table hr_asignaciones    enable row level security;
alter table hr_extras          enable row level security;
alter table hr_eventos         enable row level security;
alter table hr_eventos_ciudad  enable row level security;
alter table hr_festivos        enable row level security;
alter table hr_dias            enable row level security;
alter table hr_meses           enable row level security;
alter table hr_ajustes         enable row level security;
alter table hr_config          enable row level security;
alter table hr_login_intentos  enable row level security;
