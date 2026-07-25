import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// TEMPORAL. Diagnostico de credenciales. Borrar cuando este resuelto.
// No expone la clave: solo longitud, prefijo y los datos publicos del token.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_KEY || ''

  let tokenRef: string | null = null
  let tokenRole: string | null = null
  let tokenExp: string | null = null
  let tipo = 'desconocido'

  if (key.startsWith('sb_secret_')) tipo = 'secret nueva (sb_secret_)'
  else if (key.startsWith('sb_publishable_')) tipo = 'PUBLISHABLE - INCORRECTA'
  else if (key.split('.').length === 3) {
    tipo = 'legacy JWT'
    try {
      const p = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString())
      tokenRef = p.ref ?? null
      tokenRole = p.role ?? null
      tokenExp = p.exp ? new Date(p.exp * 1000).toISOString() : null
    } catch {
      tipo = 'JWT ilegible'
    }
  }

  let host: string | null = null
  try {
    host = new URL(url).hostname.split('.')[0]
  } catch {
    host = null
  }

  return NextResponse.json({
    url_proyecto: host,
    url_completa_ok: url.startsWith('https://') && url.includes('.supabase.co'),
    clave_tipo: tipo,
    clave_longitud: key.length,
    clave_empieza: key.slice(0, 12),
    clave_termina: key.slice(-6),
    clave_tiene_espacios: key !== key.trim(),
    token_proyecto: tokenRef,
    token_rol: tokenRole,
    token_caduca: tokenExp,
    coinciden_proyecto: tokenRef ? tokenRef === host : 'no aplica (clave nueva)',
  })
}
