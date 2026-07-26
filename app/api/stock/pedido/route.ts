import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const num = (v: any) =>
  v === undefined || v === null || v === '' ? null : Number(String(v).replace(',', '.'))

// GET  /api/stock/pedido[?fecha=...]
// POST acciones: rellenar | linea | borrar | recibir | enviar
export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get('fecha')
    const { data, error } = await supabaseStock.rpc('stk_pedido_detalle', {
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
  let b: any
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }

  const rpc = async (fn: string, args: any) => {
    const { data, error } = await supabaseStock.rpc(fn, args)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  switch (b?.accion) {
    case 'rellenar':
      return rpc('stk_pedido_rellenar', { p_pedido_id: Number(b.pedidoId) })

    case 'linea': {
      const unidades = num(b.unidades)
      if (!unidades || unidades <= 0) {
        return NextResponse.json({ error: 'Cantidad no valida' }, { status: 400 })
      }
      if (!b.productoId && !String(b.nombre || '').trim()) {
        return NextResponse.json({ error: 'Falta el articulo' }, { status: 400 })
      }
      return rpc('stk_pedido_linea', {
        p_pedido_id: Number(b.pedidoId),
        p_producto_id: b.productoId ? Number(b.productoId) : null,
        p_nombre: b.nombre ? String(b.nombre).slice(0, 120) : null,
        p_unidades: unidades,
        p_unidad: b.unidad ? String(b.unidad).slice(0, 30) : null,
        p_nota: b.nota ? String(b.nota).slice(0, 300) : null,
      })
    }

    case 'borrar':
      return rpc('stk_pedido_borrar_linea', { p_linea_id: Number(b.lineaId) })

    case 'recibir':
      return rpc('stk_pedido_recibir', {
        p_linea_id: Number(b.lineaId),
        p_recibido: num(b.recibido),
        p_estado: b.estado ? String(b.estado) : null,
      })

    case 'enviar':
      return rpc('stk_pedido_enviar', {
        p_pedido_id: Number(b.pedidoId),
        p_quien: b.quien ? String(b.quien).slice(0, 80) : null,
      })

    default:
      return NextResponse.json({ error: 'Accion desconocida' }, { status: 400 })
  }
}
