import { createClient } from '@supabase/supabase-js'

// Cliente propio del modulo de stock.
// Usa variables SIN prefijo NEXT_PUBLIC_ a proposito: esas se leen en tiempo
// de ejecucion, no se incrustan al compilar, asi que un cambio en Vercel surte
// efecto con un redeploy normal y no depende de la cache de build.
// Nunca importar este fichero desde un componente 'use client'.

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  throw new Error(
    'Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en las variables de entorno'
  )
}

export const supabaseStock = createClient(url, key, {
  auth: { persistSession: false },
})
