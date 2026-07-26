import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PERMITIDAS = ['email_economato', 'email_copia', 'email_from']

// GET  /api/stock/config
// POST /api/stock/config   { clave, valor }
export async function GET() {
  const { data, error } = await supabaseStock.rpc('stk_config_get')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  let b: any
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }
  if (!PERMITIDAS.includes(b?.clave)) {
    return NextResponse.json({ error: 'Clave no permitida' }, { status: 400 })
  }
  const { error } = await supabaseStock.rpc('stk_config_set', {
    p_clave: b.clave,
    p_valor: String(b.valor ?? '').slice(0, 200),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
