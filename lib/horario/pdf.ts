'use client'
// PDFs del Horario: mensual (A4 apaisado, una hoja) y semanal (A4 vertical).
import type { jsPDF as JsPDF } from 'jspdf'
import {
  AUSENCIAS,
  COLORES,
  DIAS_CORTO,
  DIAS_LARGO,
  FRANJAS,
  FRANJA_LABEL,
  MESES,
  MOTIVO_LABEL,
  colorAsignacion,
  corto,
  diaSemana,
  esFinde,
  etiqueta,
  fmtH,
  type Asignacion,
  type Cobertura,
  type DatosHorario,
  type Empleado,
  type Festivo,
  type Turno,
} from './core'
import { horasEmpleadoRango, horasExtra, vistaDia } from './vista'
import { malaTerraza, textoCorto, type TiempoDia } from './tiempo'

interface Derivados {
  tm: Map<string, Turno>
  idx: Map<string, Map<string, Asignacion>>
  festivos: Map<string, Festivo>
  cob: Map<string, Cobertura>
  visibles: Empleado[]
  planificados: Set<string>
}

function fuenteOcupacion(fechas: string[], datos: DatosHorario): string {
  const ultima = fechas.map(f => datos.ocupacion[f]?.cargado).filter(Boolean).sort().pop()
  return ultima
    ? `Ocupación: forecast del ${new Date(ultima).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
    : 'Ocupación: sin forecast'
}

async function nuevoDoc(orientation: 'portrait' | 'landscape'): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' })
}

const ROJO: [number, number, number] = [253, 225, 222]
const GRIS: [number, number, number] = [245, 244, 240]

// ------------------------------------------------------------------ MENSUAL

export async function pdfMensual(mes: string, fechas: string[], datos: DatosHorario, d: Derivados) {
  const doc = await nuevoDoc('landscape')
  const autoTable = (await import('jspdf-autotable')).default
  const W = 297
  const M = 7
  const [y, m] = mes.split('-').map(Number)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`HORARIO RESTAURANTE · ${MESES[m - 1].toUpperCase()} ${y}`, M, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110)
  doc.text('Novotel · Ibis Madrid City Las Ventas', W - M, 8.5, { align: 'right' })
  doc.text(`Impreso ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} · ${fuenteOcupacion(fechas, datos)}`, W - M, 12, { align: 'right' })
  doc.setTextColor(0)

  const emps = d.visibles
  const n = fechas.length
  const nameW = 30
  const cW = 8
  const totW = 11
  const dayW = (W - 2 * M - nameW - cW - totW) / n
  const filas = emps.length + 7
  const disponible = 210 - 17 - 26
  const rowH = Math.min(6.4, disponible / filas)
  const font = rowH < 4.2 ? 5.6 : 6.6

  const ocup = (f: string) => datos.ocupacion[f]?.personas
  const paxDia = (f: string) => datos.eventos.filter(e => e.fecha === f).reduce((s, e) => s + (e.pax ?? 0), 0)

  const head = [
    ['Empleado', 'Ctr', ...fechas.map(f => String(Number(f.slice(8)))), 'Mes'],
    ['', '', ...fechas.map(f => DIAS_CORTO[diaSemana(f)]), 'h'],
    ['Ocupación', '', ...fechas.map(f => (ocup(f) != null ? String(ocup(f)) : '')), ''],
    ['Eventos (pax)', '', ...fechas.map(f => (paxDia(f) ? String(paxDia(f)) : '')), ''],
  ]
  let ultimoTipo: string | null = null
  const body = emps.map(e => {
    const sep = ultimoTipo !== null && ultimoTipo !== e.tipo
    ultimoTipo = e.tipo
    return {
      sep,
      cells: [
        e.tipo === 'extra' ? `${e.nombre} (extra)` : e.nombre,
        e.horas_contrato != null ? fmtH(e.horas_contrato) : '',
        ...fechas.map(f => etiqueta(d.idx.get(e.id)?.get(f), d.tm)),
        fmtH(horasEmpleadoRango(e.id, fechas, d.idx, d.tm, e)),
      ],
    }
  })
  const foot = FRANJAS.map(fr => [
    FRANJA_LABEL[fr],
    '',
    ...fechas.map(f => {
      const c = d.cob.get(f)
      return c && d.planificados.has(f) ? `${c.tiene[fr]}/${c.necesita[fr]}` : ''
    }),
    '',
  ])

  autoTable(doc, {
    startY: 15,
    margin: { left: M, right: M },
    head,
    body: body.map(b => b.cells),
    foot,
    theme: 'grid',
    tableWidth: W - 2 * M,
    styles: {
      font: 'helvetica', fontSize: font, cellPadding: 0.4, halign: 'center', valign: 'middle',
      minCellHeight: rowH, lineColor: [190, 186, 176], lineWidth: 0.15, textColor: [26, 25, 22], overflow: 'hidden',
    },
    headStyles: { fillColor: [250, 249, 246], textColor: [26, 25, 22], fontStyle: 'bold', minCellHeight: rowH * 0.85 },
    footStyles: { fillColor: [250, 249, 246], textColor: [26, 25, 22], fontStyle: 'normal', minCellHeight: rowH * 0.85 },
    columnStyles: {
      0: { cellWidth: nameW, halign: 'left', cellPadding: { left: 1.2, right: 0.4, top: 0.4, bottom: 0.4 } },
      1: { cellWidth: cW },
      [n + 2]: { cellWidth: totW },
      ...Object.fromEntries(fechas.map((_, i) => [i + 2, { cellWidth: dayW }])),
    },
    didParseCell: data => {
      const col = data.column.index
      const f = col >= 2 && col < n + 2 ? fechas[col - 2] : null
      if (data.section === 'head') {
        if (data.row.index > 1) data.cell.styles.fontStyle = 'normal'
        if (data.row.index === 0 && col === 0) data.cell.styles.halign = 'left'
        if (f && d.festivos.has(f)) { data.cell.styles.fillColor = ROJO; data.cell.styles.textColor = [163, 34, 27] }
        else if (f && esFinde(f)) data.cell.styles.fillColor = [236, 234, 228]
        if (data.row.index > 1 && col === 0) data.cell.styles.halign = 'left'
      }
      if (data.section === 'body' && f) {
        const emp = emps[data.row.index]
        const a = d.idx.get(emp.id)?.get(f)
        const color = colorAsignacion(a, d.tm)
        if (color) data.cell.styles.fillColor = COLORES[color].rgb
        if (color === 'libre') data.cell.styles.textColor = [168, 165, 158]
        if (d.festivos.has(f) && !a) data.cell.styles.fillColor = [253, 240, 238]
      }
      if (data.section === 'body' && body[data.row.index]?.sep) {
        data.cell.styles.lineWidth = { top: 0.6, bottom: 0.15, left: 0.15, right: 0.15 }
      }
      if (data.section === 'foot' && f) {
        const c = d.cob.get(f)
        const fr = FRANJAS[data.row.index]
        if (c && d.planificados.has(f) && c.tiene[fr] < c.necesita[fr]) { data.cell.styles.fillColor = ROJO; data.cell.styles.textColor = [163, 34, 27]; data.cell.styles.fontStyle = 'bold' }
      }
      if (data.section === 'foot' && col === 0) data.cell.styles.halign = 'left'
    },
  })

  // Leyenda
  const yL = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  let x = M
  doc.setFontSize(6.8)
  for (const t of datos.turnos.filter(t => t.activo)) {
    const c = COLORES[colorAsignacion({ tipo: 'T', turno: t.codigo } as Asignacion, d.tm) ?? 'blanco']
    doc.setFillColor(...c.rgb)
    doc.setDrawColor(190, 186, 176)
    doc.rect(x, yL - 2.6, 7, 3.6, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.text(t.codigo, x + 3.5, yL, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    const txt = `${t.inicio}-${t.fin}`
    doc.text(txt, x + 8, yL)
    x += 8 + doc.getTextWidth(txt) + 3
  }
  doc.text(AUSENCIAS.map(a => `${a.tipo} ${a.label.toLowerCase()}`).join(' · ') + ' · * horario distinto del habitual', M, yL + 4.5)

  const fes = fechas.filter(f => d.festivos.has(f)).map(f => `${Number(f.slice(8))} ${d.festivos.get(f)!.nombre}`)
  const ciudad = datos.ciudad.filter(c => fechas.includes(c.fecha)).map(c => `${Number(c.fecha.slice(8))} ${c.descripcion}${c.competicion ? ` (${c.competicion})` : ''}${c.hora ? ' ' + corto(c.hora) : ''}${c.en_madrid ? ' en Madrid' : ''}`)
  doc.setTextColor(110)
  let yy = yL + 8.5
  if (fes.length) { doc.text(doc.splitTextToSize(`Festivos: ${fes.join(' · ')}`, W - 2 * M), M, yy); yy += 3.6 }
  if (ciudad.length) doc.text(doc.splitTextToSize(`Ciudad: ${ciudad.join(' · ')}`, W - 2 * M).slice(0, 2), M, yy)

  doc.save(`horario-${mes.slice(0, 7)}.pdf`)
}

// ------------------------------------------------------------------ SEMANAL

export async function pdfSemanal(lunes: string, fechas: string[], datos: DatosHorario, d: Derivados, tiempo?: Map<string, TiempoDia>) {
  const doc = await nuevoDoc('portrait')
  const W = 210
  const H = 297
  const M = 7
  const top = 15
  const bottom = 9
  const blockH = (H - top - bottom) / 7
  const leftW = 27
  const colW = (W - 2 * M - leftW) / 3
  const LH = 2.85

  const f0 = fechas[0]
  const f6 = fechas[6]
  const fmt = (f: string) => `${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1].toLowerCase()}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`HORARIO SEMANAL · ${fmt(f0)} – ${fmt(f6)} ${f6.slice(0, 4)}`, M, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(110)
  doc.text('Restaurante · Novotel · Ibis Madrid City Las Ventas', W - M, 7.5, { align: 'right' })
  doc.text(`Impreso ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} · ${fuenteOcupacion(fechas, datos)}`, W - M, 11, { align: 'right' })
  doc.setTextColor(0)

  let ettPersonas = 0
  let ettHoras = 0

  fechas.forEach((f, i) => {
    const y0 = top + i * blockH
    const v = vistaDia(f, datos, d.tm, d.cob.get(f))
    const fes = d.festivos.get(f)
    // marco y columna izquierda
    doc.setDrawColor(60)
    doc.setLineWidth(0.35)
    doc.rect(M, y0, W - 2 * M, blockH)
    doc.setFillColor(...(fes ? ROJO : GRIS))
    doc.rect(M, y0, leftW, blockH, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.setTextColor(fes ? 163 : 26, fes ? 34 : 25, fes ? 27 : 22)
    doc.text(DIAS_LARGO[diaSemana(f)].toUpperCase(), M + 2, y0 + 4.5)
    doc.setFontSize(20); doc.setFont('helvetica', 'normal')
    doc.text(String(Number(f.slice(8))), M + 2, y0 + 12.5)
    doc.setTextColor(0)
    doc.setFontSize(6.5); doc.setTextColor(110)
    doc.text('OCUPACIÓN', M + 2, y0 + 17)
    doc.setTextColor(0); doc.setFontSize(12)
    const oc = datos.ocupacion[f]
    doc.text(oc ? String(oc.personas) : '____', M + 2, y0 + 22)
    let yl = y0 + 25.5
    doc.setFontSize(6)
    if (oc?.desayunos != null) { doc.setTextColor(110); doc.text(`Desay. contr. ${oc.desayunos}`, M + 2, yl); yl += 2.6 }
    const ti = tiempo?.get(f)
    if (ti) {
      const lineas = doc.splitTextToSize(textoCorto(ti), leftW - 3).slice(0, 2)
      doc.setTextColor(...((malaTerraza(ti) ? [45, 79, 212] : [90, 90, 90]) as [number, number, number]))
      doc.text(lineas, M + 2, yl); yl += 2.6 * lineas.length
    }
    if (fes) { doc.setTextColor(163, 34, 27); doc.text(doc.splitTextToSize(fes.nombre, leftW - 3).slice(0, 2), M + 2, yl); yl += 2.6 * Math.min(2, doc.splitTextToSize(fes.nombre, leftW - 3).length) }
    doc.setTextColor(45, 79, 212)
    for (const c of datos.ciudad.filter(c => c.fecha === f).slice(0, 2)) {
      const t = doc.splitTextToSize(`${c.hora ? corto(c.hora) + ' ' : ''}${c.descripcion}${c.en_madrid ? ' (Madrid)' : ''}`, leftW - 3).slice(0, 2)
      if (yl + 2.6 * t.length > y0 + blockH - 1) break
      doc.text(t, M + 2, yl); yl += 2.6 * t.length
    }
    doc.setTextColor(0)

    FRANJAS.forEach((fr, k) => {
      const x0 = M + leftW + k * colW
      const vf = v.franjas[fr]
      doc.setDrawColor(150); doc.setLineWidth(0.2)
      if (k > 0) doc.line(x0, y0, x0, y0 + blockH)
      // cabecera de franja
      const planificado = d.planificados.has(f)
      const corta = planificado && vf.tiene < vf.necesita
      doc.setFillColor(...(corta ? ROJO : ([250, 249, 246] as [number, number, number])))
      doc.rect(x0, y0, colW, 4, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8)
      doc.text(FRANJA_LABEL[fr].toUpperCase(), x0 + 1.5, y0 + 2.9)
      doc.setTextColor(corta ? 163 : 26, corta ? 34 : 25, corta ? 27 : 22)
      doc.text(planificado ? `${vf.tiene}/${vf.necesita}${corta ? ' FALTA ' + (vf.necesita - vf.tiene) : ''}` : `mín. ${vf.necesita}`, x0 + colW - 1.5, y0 + 2.9, { align: 'right' })
      doc.setTextColor(0)
      let yy = y0 + 4 + LH
      const limite = y0 + blockH - 1.2
      const linea = (txt: string, opts?: { bold?: boolean; color?: [number, number, number]; code?: string }) => {
        if (yy > limite) return false
        doc.setFontSize(6.6)
        let xx = x0 + 1.5
        if (opts?.code) {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(110)
          doc.text(opts.code, xx, yy)
          xx += 8
        }
        doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
        doc.setTextColor(...(opts?.color ?? ([26, 25, 22] as [number, number, number])))
        const t = doc.splitTextToSize(txt, x0 + colW - 1.5 - xx)[0] ?? ''
        doc.text(t, xx, yy)
        doc.setTextColor(0)
        yy += LH
        return true
      }
      for (const ev of vf.eventos) {
        linea([ev.hora ? corto(ev.hora) : '', ev.pax ? `${ev.pax} pax` : '', ev.tipo, ev.nombre].filter(Boolean).join(' · '), { color: [45, 79, 212], bold: true })
      }
      for (const g of vf.grupos) linea(g.personas.map(p => p.emp.nombre).join(' / '), { code: g.label })
      if (vf.apoyo.length) linea(vf.apoyo.map(a => `${a.emp.nombre} (${a.label})`).join(', '), { code: '+', color: [120, 120, 120] })
      for (const x of vf.extras) {
        ettPersonas += x.cantidad
        ettHoras += horasExtra(x)
        linea(`${x.cantidad > 1 ? x.cantidad + ' ' : ''}${x.origen} ${corto(x.inicio)}-${corto(x.fin)} · ${MOTIVO_LABEL[x.motivo].toLowerCase()}${x.nota ? ' · ' + x.nota : ''}`, { code: 'EXT', color: [138, 90, 0] })
      }
      if (vf.nota) linea(vf.nota, { color: [80, 80, 80] })
      if (fr === 'manana' && planificado && v.faltanCodigos.length) linea(`Sin cubrir: ${v.faltanCodigos.join(', ')}`, { color: [163, 34, 27], bold: true })
      // líneas en blanco para apuntar a mano
      doc.setDrawColor(215); doc.setLineWidth(0.15)
      let yb = Math.max(yy - LH + 1.6, y0 + blockH - 3 * LH - 0.5)
      if (yb < yy - LH + 1.6) yb = yy - LH + 1.6
      doc.setFontSize(5.5); doc.setTextColor(160)
      if (yb + 1 < y0 + blockH - 1) doc.text('EXTRAS / AJUSTES', x0 + 1.5, yb + 1.6)
      doc.setTextColor(0)
      for (let yLine = yb + LH + 0.6; yLine < y0 + blockH - 0.8; yLine += LH) doc.line(x0 + 1.5, yLine, x0 + colW - 1.5, yLine)
    })
  })

  doc.setFontSize(7); doc.setTextColor(90)
  const ausencias = fechas.flatMap(f => vistaDia(f, datos, d.tm, d.cob.get(f)).ausentes.map(a => `${Number(f.slice(8))} ${a.emp.nombre} ${a.asig.tipo}`))
  const pie = `Extras de la semana: ${ettPersonas} personas · ${fmtH(ettHoras)} h` + (ausencias.length ? `   ·   Ausencias: ${ausencias.join(', ')}` : '')
  doc.text(doc.splitTextToSize(pie, W - 2 * M)[0], M, H - 4.5)

  // Hoja 2: ajustes sobre el horario publicado
  const ajustes = datos.ajustes.filter(a => a.fecha >= f0 && a.fecha <= f6)
  if (ajustes.length) {
    const autoTable = (await import('jspdf-autotable')).default
    doc.addPage('a4', 'portrait')
    doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(`AJUSTES SOBRE EL HORARIO PUBLICADO · ${fmt(f0)} – ${fmt(f6)}`, M, 12)
    autoTable(doc, {
      startY: 16,
      margin: { left: M, right: M },
      head: [['Día', 'Empleado', 'Antes', 'Ahora', 'Cambiado']],
      body: ajustes
        .slice()
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at))
        .map(a => [
          `${DIAS_CORTO[diaSemana(a.fecha)]} ${Number(a.fecha.slice(8))}`,
          a.empleado_nombre, a.antes, a.despues,
          new Date(a.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
        ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.2 },
      headStyles: { fillColor: [26, 25, 22] },
    })
  }

  doc.save(`horario-semana-${lunes}.pdf`)
}
