import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/stock/hoja           -> jornada de hoy (corte 04:00)
// GET /api/stock/hoja?fecha=... -> una jornada concreta
export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get('fecha')

    // Import dinámico: si el cliente de Supabase falla al cargarse,
    // lo vemos como JSON en vez de como una respuesta vacía.
    let supabase: any
    try {
      supabase = (await import('@/lib/supabase')).supabase
    } catch (e: any) {
      return NextResponse.json(
        {
          error: 'No se pudo cargar el cliente de Supabase',
          detalle: String(e?.message || e),
          env_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          env_key: !!process.env.SUPABASE_SERVICE_KEY,
        },
        { status: 500 }
      )
    }

    const { data, error } = await supabase.rpc('stk_hoja_conteo', {
      p_fecha: fecha || null,
    })

    if (error) {
      return NextResponse.json(
        {
          error: 'Error de base de datos',
          detalle: error.message,
          code: error.code ?? null,
          hint: error.hint ?? null,
        },
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
