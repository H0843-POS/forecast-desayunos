import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/horario/db'

// Misma conexión que el módulo Horario (SUPABASE_URL), para que la ocupación
// que se guarda aquí sea la que lee el horario.
const supabase = { from: (t: string) => db().from(t) }

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: { fecha_inicio?: unknown; fecha_fin?: unknown; novotel?: { days?: unknown[] }; ibis?: { days?: unknown[] } }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON no válido' }, { status: 400 }) }
  const { fecha_inicio, fecha_fin, novotel, ibis } = body
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (typeof fecha_inicio !== 'string' || !re.test(fecha_inicio) || typeof fecha_fin !== 'string' || !re.test(fecha_fin)
    || !Array.isArray(novotel?.days) || !Array.isArray(ibis?.days) || novotel!.days!.length > 400 || ibis!.days!.length > 400) {
    return NextResponse.json({ error: 'Datos de forecast no válidos' }, { status: 400 })
  }

  const { error } = await supabase.from('forecasts').insert({
    fecha_inicio,
    fecha_fin,
    novotel_data: novotel,
    ibis_data: ibis,
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[forecasts]', error.message)
    const msg = /relation .*forecasts.* does not exist|Could not find the table/i.test(error.message)
      ? 'Falta la tabla forecasts en Supabase'
      : 'No se pudo guardar el forecast'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const { data, error } = await supabase
    .from('forecasts')
    .select('id, fecha_inicio, fecha_fin, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
