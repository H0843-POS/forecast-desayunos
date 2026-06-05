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
