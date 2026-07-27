import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET  /api/stock/movimientos[?fecha=...]
// POST { productoId, origenId, destinoId, unidades, quien?, nota? }
// POST { accion: 'borrar', id }
export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get('fecha')
    const { data, error } = await supabaseStock.rpc('stk_mov_listado', {
      p_fecha: fecha || null,
    })
    if (error) {
      return NextResponse.json(
        { error: 'Error de base de datos', detalle: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Fallo inesperado', detalle: String(e?.message || e) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  let b: any
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }

  if (b?.accion === 'borrar') {
    const { error } = await supabaseStock.rpc('stk_mov_del', { p_id: Number(b.id) })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const unidades = Number(String(b?.unidades ?? '').replace(',', '.'))
  if (!Number.isFinite(unidades) || unidades <= 0) {
    return NextResponse.json({ error: 'Cantidad no valida' }, { status: 400 })
  }
  if (!b?.productoId || !b?.origenId || !b?.destinoId) {
    return NextResponse.json({ error: 'Faltan producto, origen o destino' }, { status: 400 })
  }
  if (Number(b.origenId) === Number(b.destinoId)) {
    return NextResponse.json({ error: 'Origen y destino no pueden ser el mismo' }, { status: 400 })
  }

  const { data, error } = await supabaseStock.rpc('stk_mov_add', {
    p_producto: Number(b.productoId),
    p_origen: Number(b.origenId),
    p_destino: Number(b.destinoId),
    p_unidades: unidades,
    p_quien: b.quien ? String(b.quien).slice(0, 80) : null,
    p_nota: b.nota ? String(b.nota).slice(0, 300) : null,
    p_fecha: b.fecha ? String(b.fecha) : null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
