import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente de servidor del módulo Horario (service key). Igual que el de
// stock: variables sin NEXT_PUBLIC_. NUNCA importar desde un componente cliente.

let client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en las variables de entorno')
  }
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}
