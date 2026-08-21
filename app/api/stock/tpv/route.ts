import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/stock/tpv?buscar=texto   -> productos activos que coinciden (para el selector al mapear)
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('buscar')?.trim() || ''
  if (q.length < 2) return NextResponse.json([])
  const { data, error } = await supabaseStock
    .from('stk_productos')
    .select('id, nombre')
    .eq('activo', true)
    .ilike('nombre', `%${q}%`)
    .order('nombre')
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST acciones: mapear | ignorar | importar
export async function POST(req: Request) {
  let b: any
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }

  if (b?.accion === 'mapear') {
    const nombre = String(b.nombreTpv || '').trim().slice(0, 200)
    const productoId = Number(b.productoId)
    const cantidad = b.cantidad === undefined || b.cantidad === null || b.cantidad === '' ? 1 : Number(b.cantidad)
    if (!nombre) return NextResponse.json({ error: 'Falta el nombre del TPV' }, { status: 400 })
    if (!Number.isFinite(productoId)) return NextResponse.json({ error: 'Producto no valido' }, { status: 400 })
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json({ error: 'Cantidad no valida' }, { status: 400 })
    }
    const { error } = await supabaseStock.rpc('stk_tpv_mapear', {
      p_nombre_tpv: nombre,
      p_producto_id: productoId,
      p_cantidad: cantidad,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (b?.accion === 'ignorar') {
    const nombre = String(b.nombreTpv || '').trim().slice(0, 200)
    if (!nombre) return NextResponse.json({ error: 'Falta el nombre del TPV' }, { status: 400 })
    const { error } = await supabaseStock.rpc('stk_tpv_ignorar_nombre', {
      p_nombre_tpv: nombre,
      p_motivo: b.motivo ? String(b.motivo).slice(0, 200) : null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (b?.accion === 'importar') {
    const fecha = String(b.fecha || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Fecha no valida' }, { status: 400 })
    }
    if (!Array.isArray(b.lineas) || b.lineas.length > 3000) {
      return NextResponse.json({ error: 'Faltan las lineas a importar, o son demasiadas' }, { status: 400 })
    }
    const { data, error } = await supabaseStock.rpc('stk_tpv_importar', {
      p_fecha: fecha,
      p_lineas: b.lineas,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Accion desconocida' }, { status: 400 })
}
