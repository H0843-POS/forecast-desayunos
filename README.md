# Forecast Desayunos — Novotel + Ibis

App Next.js para procesar los RTF de Oracle Reports y generar la tabla combinada de desayunos contratados.

## Despliegue en Vercel + GitHub

### 1. Subir a GitHub
```bash
cd forecast-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/forecast-desayunos.git
git push -u origin main
```

### 2. Supabase — ejecutar migración
En el SQL Editor de Supabase (proyecto lhmneirvruxheteftnoh), ejecutar el contenido de supabase_migration.sql.

### 3. Vercel — importar repo y añadir variables de entorno
En vercel.com → New Project → importar el repo de GitHub.

Variables de entorno en Vercel:
- NEXT_PUBLIC_SUPABASE_URL = https://lhmneirvruxheteftnoh.supabase.co
- SUPABASE_SERVICE_KEY = (tu service role key de Supabase → Project Settings → API → service_role)

### 4. Deploy
Vercel despliega automáticamente.

## Uso
1. Abrir la URL desde cualquier ordenador
2. Subir el RTF de Novotel y el de Ibis
3. Pulsar "Generar tabla combinada"
4. Ver tablas, exportar a Excel o imprimir
