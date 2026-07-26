import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET  /api/stock/pedido            -> hoja de hoy (la crea si no existe)
// GET  /api/stock/pedido?fecha=...  -> hoja de un dia pasado (NO la crea)
// POST /api/stock/pedido            -> { lineaId, pedido?, recibido?, estado? }
//                                   -> { generar: true, jornadaId }
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

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }

  if (body?.generar === true) {
    const { data, error } = await supabaseStock.rpc('stk_generar_pedido', {
      p_jornada_id: Number(body.jornadaId),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, lineas: data })
  }

  const lineaId = Number(body?.lineaId)
  if (!Number.isFinite(lineaId)) {
    return NextResponse.json({ error: 'Falta lineaId' }, { status: 400 })
  }

  const num = (v: any) =>
    v === undefined || v === null || v === '' ? null : Number(String(v).replace(',', '.'))

  const { error } = await supabaseStock.rpc('stk_guardar_pedido', {
    p_linea_id: lineaId,
    p_pedido: num(body.pedido),
    p_recibido: num(body.recibido),
    p_estado: typeof body.estado === 'string' ? body.estado : null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
