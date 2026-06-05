import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fecha_facturacion, hoteles } = body

    // Insertar registro
    const { data, error } = await supabase
      .from('prefacturaciones')
      .insert({
        fecha_facturacion,
        hoteles, // jsonb con todos los datos por hotel y columna
        created_at: new Date().toISOString(),
      })
      .select()

    if (error) throw error

    // Mantener solo los últimos 30 registros
    const { data: todos } = await supabase
      .from('prefacturaciones')
      .select('id, created_at')
      .order('created_at', { ascending: false })

    if (todos && todos.length > 30) {
      const aEliminar = todos.slice(30).map((r: { id: string }) => r.id)
      await supabase.from('prefacturaciones').delete().in('id', aEliminar)
    }

    return NextResponse.json({ ok: true, data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('prefacturaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
