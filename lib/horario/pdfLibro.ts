'use client'
// PDF del libro de cambios de planning: una página A4 vertical por hoja,
// 15 filas con hueco para la firma del colaborador y la del responsable.
import { FILAS_HOJA, type EntradaLibro, type HojaLibro } from './libro'

const W = 210
const M = 10
const COLS: { t: string; w: number }[] = [
  { t: 'Nº', w: 11 },
  { t: 'Fecha\npetición', w: 19 },
  { t: 'Colaborador', w: 30 },
  { t: 'Detalle del cambio', w: 74 },
  { t: 'Firma del\ncolaborador', w: 28 },
  { t: 'Firma del\nresponsable', w: 28 },
]
const Y_CAB = 27
const H_CAB = 8
const H_FILA = 16

// Las fuentes estándar del PDF no tienen todos los caracteres: flecha → », resto fuera
function pdfTxt(s: string): string {
  return s.replace(/→/g, '»').replace(/[^\x20-\x7e\xa0-\xff\n€–—…‘’“”•]/g, '?')
}
const fFecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const fMomento = (iso: string) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' })

export async function pdfLibro(hojas: HojaLibro[], filas: EntradaLibro[], copia: boolean) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  hojas.forEach((h, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait')
    const lista = filas.filter(f => f.hoja === h.numero).sort((a, b) => a.numero - b.numero)

    // Cabecera
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text('LIBRO DE CAMBIOS DE PLANNING', M, 13)
    doc.text(`HOJA Nº ${h.numero}`, W - M, 13, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    doc.text('Restaurante · Novotel & Ibis Madrid Las Ventas', M, 18.5)
    doc.text(`Impresa el ${fMomento(h.impreso_at)}`, W - M, 18.5, { align: 'right' })
    doc.setFontSize(7); doc.setTextColor(100)
    doc.text('Cada fila recoge un cambio sobre el horario publicado. El colaborador firma su conformidad y el responsable lo autoriza.', M, 23)
    if (copia) {
      doc.setTextColor(163, 34, 27); doc.setFont('helvetica', 'bold')
      doc.text('COPIA · REIMPRESIÓN', W - M, 23, { align: 'right' })
      doc.setFont('helvetica', 'normal')
    }

    // Cabecera de la tabla
    doc.setDrawColor(40); doc.setLineWidth(0.3)
    doc.setFillColor(232, 230, 224)
    doc.rect(M, Y_CAB, W - 2 * M, H_CAB, 'FD')
    doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
    let x = M
    for (const c of COLS) {
      const ls = c.t.split('\n')
      ls.forEach((l, i) => doc.text(l, x + c.w / 2, Y_CAB + H_CAB / 2 + 1 + (i - (ls.length - 1) / 2) * 3, { align: 'center' }))
      x += c.w
    }

    // Filas
    const y0 = Y_CAB + H_CAB
    for (let i = 0; i < FILAS_HOJA; i++) {
      const y = y0 + i * H_FILA
      doc.setDrawColor(120); doc.setLineWidth(0.2)
      doc.rect(M, y, W - 2 * M, H_FILA)
      let cx = M
      COLS.forEach((c, j) => { if (j > 0) doc.line(cx, y, cx, y + H_FILA); cx += c.w })
      const e = lista[i]
      if (!e) continue
      cx = M
      doc.setTextColor(0)
      // Nº
      doc.setFont('courier', 'bold'); doc.setFontSize(9)
      doc.text(String(e.numero), cx + COLS[0].w / 2, y + 5, { align: 'center' }); cx += COLS[0].w
      // Fecha petición
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
      doc.text(fFecha(e.fecha_peticion), cx + 1.5, y + 5); cx += COLS[1].w
      // Colaborador
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
      doc.text(doc.splitTextToSize(pdfTxt(e.empleado_nombre), COLS[2].w - 3).slice(0, 2), cx + 1.5, y + 5); cx += COLS[2].w
      // Detalle: reduce la letra si no cabe
      doc.setFont('helvetica', 'normal')
      const txt = pdfTxt(e.detalle)
      let fs = 8
      let lineas: string[] = []
      for (; fs >= 6; fs -= 0.5) {
        doc.setFontSize(fs)
        lineas = txt.split('\n').flatMap(l => doc.splitTextToSize(l, COLS[3].w - 3) as string[])
        if (lineas.length * fs * 0.42 <= H_FILA - 3) break
      }
      const max = Math.floor((H_FILA - 3) / (fs * 0.42))
      if (lineas.length > max) { lineas = lineas.slice(0, max); lineas[max - 1] = lineas[max - 1].replace(/.{0,2}$/, '…') }
      doc.text(lineas, cx + 1.5, y + 4.2, { lineHeightFactor: 1.2 })
    }

    // Filas sin usar: se tachan para que no se escriba a mano después
    if (lista.length < FILAS_HOJA) {
      const ya = y0 + lista.length * H_FILA
      const yb = y0 + FILAS_HOJA * H_FILA
      doc.setDrawColor(150); doc.setLineWidth(0.3)
      doc.line(M, ya, W - M, yb)
      doc.setTextColor(150); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
      doc.text('SIN USO', W / 2, (ya + yb) / 2 - 2, { align: 'center' })
    }

    // Pie: cierre de la hoja
    const yp = y0 + FILAS_HOJA * H_FILA + 7
    doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    const rango = lista.length ? `Filas Nº ${lista[0].numero} – ${lista[lista.length - 1].numero} · ${lista.length} cambio${lista.length === 1 ? '' : 's'}` : 'Sin cambios'
    doc.text(rango, M, yp)
    doc.text('Cierre de hoja · Responsable: ______________________   Fecha: ___________', W - M, yp, { align: 'right' })
    doc.setFontSize(6.5); doc.setTextColor(120)
    doc.text('Generado desde el horario del restaurante. Las filas impresas no se pueden modificar en la aplicación; una corrección va en una fila nueva.', M, yp + 6)
  })

  const nombre = hojas.length === 1 ? `libro-cambios-hoja-${hojas[0].numero}` : `libro-cambios-hojas-${hojas[0].numero}-${hojas[hojas.length - 1].numero}`
  doc.save(`${nombre}${copia ? '-copia' : ''}.pdf`)
}
