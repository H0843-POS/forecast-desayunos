import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/stock/resumen            -> hoja de hoy (la crea si no existe)
// GET /api/stock/resumen?fecha=...  -> hoja de un dia pasado (NO la crea)
export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get('fecha')
    const { data, error } = await supabaseStock.rpc('stk_hoja_resumen', {
      p_fecha: fecha || null,
      p_crear: !fecha,
    })
    if (error) {
      return NextResponse.json(
        { error: 'Error de base de datos', detalle: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Fallo inesperado', detalle: String(e?.message || e) },
      { status: 500 }
    )
  }
}

// POST /api/stock/resumen   { lineaId, nota }
export async function POST(req: Request) {
  let b: any
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }
  const lineaId = Number(b?.lineaId)
  if (!Number.isFinite(lineaId)) {
    return NextResponse.json({ error: 'Falta lineaId' }, { status: 400 })
  }
  const { error } = await supabaseStock.rpc('stk_guardar_nota', {
    p_linea_id: lineaId,
    p_nota: String(b?.nota ?? '').slice(0, 500),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
