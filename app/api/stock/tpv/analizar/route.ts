import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Categorias raiz del informe que nos interesan para el cotejo de
// stock de bebidas. El resto (ROOM HIRE, Comida, etc.) se ignora
// entero sin necesidad de mapear nada linea a linea.
const RAIZ_INTERES = ['alcohol', 'aguas y refrescos', 'vinos']
const MARCADOR_FIN = ['tipos de medios de pago']

const norm = (s: any) => String(s ?? '').trim().toLowerCase()

type FilaTPV = { nombre: string; cantidad: number }

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('archivo')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo demasiado grande' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const nombreHoja = wb.SheetNames.find((n) => n.toLowerCase() === 'reports') || wb.SheetNames[0]
    const ws = wb.Sheets[nombreHoja]
    if (!ws) return NextResponse.json({ error: 'El Excel no tiene hojas legibles' }, { status: 400 })

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

    // Fecha del informe
    let fecha: string | null = null
    for (const r of rows) {
      if (norm(r[0]) === 'fechas de negocio') {
        const v = r[1]
        if (typeof v === 'string') {
          const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/)
          if (m) fecha = `${m[3]}-${m[2]}-${m[1]}`
        } else if (v instanceof Date) {
          fecha = v.toISOString().slice(0, 10)
        }
        break
      }
    }
    if (!fecha) {
      return NextResponse.json({ error: 'No se encontró la fecha del informe en el Excel' }, { status: 400 })
    }

    // Localizar la tabla detallada de productos vendidos
    let headerIdx = -1
    for (let i = 0; i < rows.length; i++) {
      if (norm(rows[i][0]) === 'nombre' && norm(rows[i][1]) === 'cantidad vendida') {
        headerIdx = i
        break
      }
    }
    if (headerIdx === -1) {
      return NextResponse.json(
        { error: 'No se encontró la tabla "Nombre / Cantidad vendida" en el Excel' },
        { status: 400 }
      )
    }

    // Los nombres de categoria raiz salen del bloque justo antes de
    // esa tabla (una fila en blanco los separa)
    const nombresRaiz = new Set<string>()
    for (let i = headerIdx - 1; i >= 0; i--) {
      const nombre = rows[i][0]
      if (nombre === null || String(nombre).trim() === '') break
      nombresRaiz.add(norm(nombre))
    }
    if (!nombresRaiz.size) {
      return NextResponse.json({ error: 'No se pudo identificar el bloque de categorías del informe' }, { status: 400 })
    }

    // Filas de la tabla detallada hasta el marcador de fin
    const detalle: FilaTPV[] = []
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const nombre = rows[i][0]
      if (nombre === null || String(nombre).trim() === '') continue
      if (MARCADOR_FIN.includes(norm(nombre))) break
      const cantidad = Number(rows[i][1])
      if (!Number.isFinite(cantidad)) continue
      detalle.push({ nombre: String(nombre), cantidad })
    }

    // Extraer solo las secciones de interes (agrupadas), sin sumar
    // todavia — la suma de cuadre necesita saber antes cuales de
    // estas filas son cabeceras de subtotal del propio informe.
    const secciones: { seccion: string; declarado: number; propios: FilaTPV[] }[] = []
    let i = 0
    while (i < detalle.length) {
      const esRaiz = nombresRaiz.has(norm(detalle[i].nombre))
      if (esRaiz && RAIZ_INTERES.includes(norm(detalle[i].nombre))) {
        const seccion = detalle[i].nombre
        const declarado = detalle[i].cantidad
        let j = i + 1
        const propios: FilaTPV[] = []
        while (j < detalle.length && !nombresRaiz.has(norm(detalle[j].nombre))) {
          propios.push(detalle[j])
          j++
        }
        secciones.push({ seccion, declarado, propios })
        i = j
      } else {
        i++
      }
    }

    const candidatos: FilaTPV[] = secciones.flatMap((s) => s.propios)
    if (!candidatos.length) {
      return NextResponse.json(
        { error: 'No se encontraron líneas de Alcohol / Aguas y refrescos / Vinos en este informe' },
        { status: 400 }
      )
    }

    // Clasificar contra lo ya guardado
    const nombresUnicos = Array.from(new Set(candidatos.map((c) => c.nombre)))
    const { data: recetas, error: e1 } = await supabaseStock
      .from('stk_tpv_receta')
      .select('nombre_tpv, producto_id, cantidad')
      .in('nombre_tpv', nombresUnicos)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    const { data: ignorados, error: e2 } = await supabaseStock
      .from('stk_tpv_ignorar')
      .select('nombre_tpv, es_subtotal')
      .in('nombre_tpv', nombresUnicos)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    const mapeados = new Set((recetas || []).map((r) => r.nombre_tpv))
    const ignoradosSet = new Set((ignorados || []).map((r) => r.nombre_tpv))
    const subtotales = new Set((ignorados || []).filter((r) => r.es_subtotal).map((r) => r.nombre_tpv))

    // Ahora si, la suma de cuadre: excluye las cabeceras de subtotal
    // (su cantidad ya esta contenida en las filas que le siguen).
    const reconciliacion = secciones.map((s) => {
      const sumado = s.propios
        .filter((p) => !subtotales.has(p.nombre))
        .reduce((acc, p) => acc + p.cantidad, 0)
      return {
        seccion: s.seccion,
        declarado: s.declarado,
        sumado: Math.round(sumado * 100) / 100,
        cuadra: Math.abs(sumado - s.declarado) < 0.05,
      }
    })

    const sinMapear = Array.from(
      new Set(
        candidatos
          .filter((c) => c.cantidad !== 0 && !mapeados.has(c.nombre) && !ignoradosSet.has(c.nombre))
          .map((c) => c.nombre)
      )
    ).sort()

    return NextResponse.json({
      fecha,
      lineas: candidatos,
      reconciliacion,
      sinMapear,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Fallo al procesar el archivo', detalle: String(e?.message || e) },
      { status: 500 }
    )
  }
}
