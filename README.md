# F&B Tools — Novotel + Ibis Madrid

App Next.js con dos herramientas integradas:
- **Forecast**: ocupación y desayunos contratados
- **Prefacturación**: cálculo de desayunos a facturar por hotel

## Estructura

```
app/
  page.tsx                  ← Home con selector de herramienta
  forecast/page.tsx         ← App de forecast
  prefacturacion/page.tsx   ← App de prefacturación
  api/prefacturacion/       ← API para guardar en Supabase
lib/
  supabase.ts               ← Cliente Supabase
```

## Variables de entorno (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://lhmneirvruxheteftnoh.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
```

## Supabase — ejecutar migración

En Supabase → SQL Editor, ejecutar `supabase_migration.sql`.

## Deploy

```bash
git add .
git commit -m "Add prefacturacion app + home"
git push
```

Vercel despliega automáticamente desde el repo `H0843-POS/forecast-desayunos`.

## Módulo Horario restaurante (`/horario`)

Protegido con contraseña (middleware + comprobación en cada ruta API).

Variables de entorno nuevas en Vercel (Production y Preview):

```
HORARIO_PASSWORD=<mín. 8 caracteres>
HORARIO_SESSION_SECRET=<cadena aleatoria de 32+ caracteres>
SUPABASE_URL=<url del proyecto Supabase del hotel>   # ya existe para stock
SUPABASE_SERVICE_KEY=<service_role key>             # ya existe
```

Base de datos: ejecutar `supabase_horario.sql` en el SQL Editor (idempotente).
Crea las tablas `hr_*` con RLS activado sin políticas y carga turnos, festivos 2026-2027 y reglas de cobertura.

Cambiar `HORARIO_PASSWORD` cierra todas las sesiones abiertas.

### Actualización 2 (eventos, partidos, libres numerados)

1. Ejecutar `supabase_horario_2.sql` en Supabase **antes** de desplegar.
2. Variables nuevas en Vercel (Production y Preview):
   - `FOOTBALL_DATA_TOKEN`: clave gratuita de football-data.org (partidos de Champions y LaLiga).
   - `CRON_SECRET`: texto aleatorio de 16+ caracteres; Vercel lo usa para lanzar la actualización diaria (`vercel.json`).
   - `TICKETMASTER_KEY`: Consumer Key gratuita de developer.ticketmaster.com (grandes conciertos).

### Actualización 3 (libro de cambios de planning)

1. Ejecutar `supabase_horario_3.sql` en Supabase (idempotente). Sin él, los turnos se guardan igual pero no se apuntan en el libro.
2. Pestaña **Libro de cambios**: con el mes publicado, cada cambio de turno crea una fila (fecha de petición, colaborador, detalle).
   Hojas de 15 filas con firma del colaborador y del responsable; al imprimir se numeran y quedan bloqueadas.
