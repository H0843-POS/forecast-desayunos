import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/stock/hoja           -> jornada de hoy (corte 04:00)
// GET /api/stock/hoja?fecha=... -> una jornada concreta
export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get('fecha')
    const { supabaseStock } = await import('@/lib/supabaseStock')

    const { data, error } = await supabaseStock.rpc('stk_hoja_conteo', {
      p_fecha: fecha || null,
    })

    if (error) {
      return NextResponse.json(
        { error: 'Error de base de datos', detalle: error.message, hint: error.hint ?? null },
        { status: 500 }
      )
    }
    if (!data) {
      return NextResponse.json(
        { error: 'La funcion devolvio vacio', pista: 'Revisa que se aplico 03_rpc_conteo.sql' },
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
