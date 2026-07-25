import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/stock/conteo
//   { lineaId, ubicacionId, unidades, quien }  -> guarda un conteo
//   { lineaId, nota }                          -> guarda la nota de la línea
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }

  const lineaId = Number(body?.lineaId)
  if (!Number.isFinite(lineaId)) {
    return NextResponse.json({ error: 'Falta lineaId' }, { status: 400 })
  }

  // --- nota ---
  if (typeof body.nota === 'string' && body.ubicacionId === undefined) {
    const { error } = await supabase.rpc('stk_guardar_nota', {
      p_linea_id: lineaId,
      p_nota: body.nota,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // --- conteo ---
  const ubicacionId = Number(body?.ubicacionId)
  const unidades = Number(body?.unidades)

  if (!Number.isFinite(ubicacionId)) {
    return NextResponse.json({ error: 'Falta ubicacionId' }, { status: 400 })
  }
  if (!Number.isFinite(unidades) || unidades < 0) {
    return NextResponse.json({ error: 'Cantidad no válida' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('stk_guardar_conteo', {
    p_linea_id: lineaId,
    p_ubicacion_id: ubicacionId,
    p_unidades: unidades,
    p_quien: typeof body.quien === 'string' ? body.quien.slice(0, 80) : null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, total: data })
}
