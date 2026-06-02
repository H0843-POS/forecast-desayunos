'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import type { ForecastData, DayData } from '@/lib/parseRTF'

interface CombinedDay {
  fecha: string
  dia: string
  nov_rooms: number
  ibis_rooms: number
  adults: number
  children: number
  nov_bkf: number
  ibis_bkf: number
  total_bkf: number
}

function shiftDay(day: DayData): DayData {
  const d = new Date(day.iso + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return { ...day, fecha: `${dd}/${mm}`, iso: `${d.getFullYear()}-${mm}-${dd}`, dia: dias[d.getDay()] }
}

function buildCombined(novotel: ForecastData, ibis: ForecastData): CombinedDay[] {
  const len = Math.max(novotel.days.length, ibis.days.length)
  return Array.from({ length: len }, (_, i) => {
    const nd = novotel.days[i]
    const id = ibis.days[i]
    const ref = nd || id
    const shifted = shiftDay(ref)
    return {
      fecha: shifted.fecha,
      dia: shifted.dia,
      nov_rooms: nd?.rooms ?? 0,
      ibis_rooms: id?.rooms ?? 0,
      adults: (nd?.adults ?? 0) + (id?.adults ?? 0),
      children: (nd?.children ?? 0) + (id?.children ?? 0),
      nov_bkf: nd?.bkf ?? 0,
      ibis_bkf: id?.bkf ?? 0,
      total_bkf: (nd?.bkf ?? 0) + (id?.bkf ?? 0),
    }
  })
}

function sum(arr: number[]) { return arr.reduce((a, b) => a + b, 0) }

export default function ForecastPage() {
  const [novotelFile, setNovotelFile] = useState<File | null>(null)
  const [ibisFile, setIbisFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [novotel, setNovotel] = useState<ForecastData | null>(null)
  const [ibis, setIbis] = useState<ForecastData | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  async function handleGenerate() {
    if (!novotelFile || !ibisFile) return
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('novotel', novotelFile)
      fd.append('ibis', ibisFile)
      const res = await fetch('/api/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNovotel(data.novotel)
      setIbis(data.ibis)
      await fetch('/api/forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: data.novotel.days[0]?.iso,
          fecha_fin: data.novotel.days[data.novotel.days.length - 1]?.iso,
          novotel: data.novotel,
          ibis: data.ibis,
        }),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  function handleExportExcel() {
    if (!novotel || !ibis) return
    const combined = buildCombined(novotel, ibis)
    const wb = XLSX.utils.book_new()
    const combinedData = [
      ['Fecha', 'Día', 'Ocup. Novotel', 'Ocup. Ibis', 'Adultos total', 'Niños total', 'BKF Novotel', 'BKF Ibis', 'BKF Total'],
      ...combined.map(r => [r.fecha, r.dia, r.nov_rooms, r.ibis_rooms, r.adults, r.children, r.nov_bkf, r.ibis_bkf, r.total_bkf]),
      ['TOTAL', '', sum(combined.map(r => r.nov_rooms)), sum(combined.map(r => r.ibis_rooms)), sum(combined.map(r => r.adults)), sum(combined.map(r => r.children)), sum(combined.map(r => r.nov_bkf)), sum(combined.map(r => r.ibis_bkf)), sum(combined.map(r => r.total_bkf))],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(combinedData), 'Combinado')
    const novShifted = novotel.days.map(d => shiftDay(d))
    const novData = [
      ['Fecha', 'Día', 'Hab. Ocup.', 'Adultos', 'Niños', 'BKF'],
      ...novotel.days.map((d, i) => [novShifted[i].fecha, novShifted[i].dia, d.rooms, d.adults, d.children, d.bkf]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(novData), 'Novotel')
    const ibisShifted = ibis.days.map(d => shiftDay(d))
    const ibisData = [
      ['Fecha', 'Día', 'Hab. Ocup.', 'Adultos', 'Niños', 'BKF'],
      ...ibis.days.map((d, i) => [ibisShifted[i].fecha, ibisShifted[i].dia, d.rooms, d.adults, d.children, d.bkf]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ibisData), 'Ibis')
    XLSX.writeFile(wb, `forecast_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const combined = novotel && ibis ? buildCombined(novotel, ibis) : []

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Forecast desayunos</h1>
          <p className="text-sm text-gray-500 mt-1">Novotel + Ibis Styles Madrid City Las Ventas</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FileZone label="Archivo Novotel (.RTF)" file={novotelFile} onChange={setNovotelFile} color="blue" />
            <FileZone label="Archivo Ibis (.RTF)" file={ibisFile} onChange={setIbisFile} color="teal" />
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={!novotelFile || !ibisFile || loading}
            className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
          >
            {loading ? 'Procesando...' : 'Generar tabla combinada'}
          </button>
        </div>

        {novotel && ibis && (
          <div ref={printRef}>
            <div className="flex gap-3 mb-6 print:hidden">
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors bg-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                Exportar Excel
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors bg-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Imprimir
              </button>
            </div>

            <Section title="Tabla combinada" subtitle="Datos del día anterior · suma Novotel + Ibis" color="amber">
              <Table
                headers={['Fecha', 'Día', 'Ocup. Novotel', 'Ocup. Ibis', 'Adultos total', 'Niños total', 'BKF Novotel', 'BKF Ibis', 'BKF Total']}
                rows={combined.map(r => [r.fecha, r.dia, r.nov_rooms, r.ibis_rooms, r.adults, r.children, r.nov_bkf, r.ibis_bkf, r.total_bkf])}
                boldCols={[4, 5, 8]}
                totals={['', '', sum(combined.map(r => r.nov_rooms)), sum(combined.map(r => r.ibis_rooms)), sum(combined.map(r => r.adults)), sum(combined.map(r => r.children)), sum(combined.map(r => r.nov_bkf)), sum(combined.map(r => r.ibis_bkf)), sum(combined.map(r => r.total_bkf))]}
              />
            </Section>

            <Section title="Novotel Madrid City Las Ventas" color="blue">
              <HotelTable data={novotel} />
            </Section>

            <Section title="Ibis Styles Madrid City Las Ventas" color="teal">
              <HotelTable data={ibis} />
            </Section>
          </div>
        )}
      </div>
      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </main>
  )
}

function FileZone({ label, file, onChange, color }: { label: string; file: File | null; onChange: (f: File) => void; color: 'blue' | 'teal' }) {
  const active = color === 'blue' ? 'border-blue-300 bg-blue-50' : 'border-teal-300 bg-teal-50'
  return (
    <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${file ? active : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
      <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
      <span className="text-sm text-gray-600 font-medium">{label}</span>
      {file ? <span className="text-xs text-gray-500 mt-1 truncate max-w-full">{file.name}</span> : <span className="text-xs text-gray-400 mt-1">Haz clic para seleccionar</span>}
      <input type="file" accept=".rtf,.RTF" className="hidden" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} />
    </label>
  )
}

function Section({ title, subtitle, color, children }: { title: string; subtitle?: string; color: 'blue' | 'teal' | 'amber'; children: React.ReactNode }) {
  const dot = { blue: 'bg-blue-500', teal: 'bg-teal-500', amber: 'bg-amber-500' }
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${dot[color]}`} />
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {subtitle && <span className="text-xs text-gray-400 ml-1">{subtitle}</span>}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">{children}</div>
    </div>
  )
}

function Table({ headers, rows, boldCols = [], totals }: { headers: string[]; rows: (string | number)[][]; boldCols?: number[]; totals?: (string | number)[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {headers.map((h, i) => <th key={i} className={`px-3 py-2.5 text-xs font-medium text-gray-500 ${i < 2 ? 'text-left' : 'text-center'}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-50 hover:bg-gray-50/50">
              {row.map((cell, ci) => <td key={ci} className={`px-3 py-2 text-gray-700 ${ci < 2 ? 'text-left' : 'text-center'} ${boldCols.includes(ci) ? 'font-semibold' : ''} ${ci === 1 ? 'text-gray-400 text-xs' : ''}`}>{cell}</td>)}
            </tr>
          ))}
          {totals && (
            <tr className="bg-gray-50 font-semibold border-t border-gray-200">
              <td className="px-3 py-2.5 text-gray-600 text-xs">TOTAL</td>
              {totals.slice(1).map((t, i) => <td key={i} className="px-3 py-2.5 text-center text-gray-700">{t}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function HotelTable({ data }: { data: ForecastData }) {
  const shifted = data.days.map(d => shiftDay(d))
  return (
    <Table
      headers={['Fecha', 'Día', 'Hab. ocup.', 'Adultos', 'Niños', 'BKF']}
      rows={data.days.map((d, i) => [shifted[i].fecha, shifted[i].dia, d.rooms, d.adults, d.children, d.bkf])}
      boldCols={[3, 4]}
      totals={['', '', sum(data.days.map(d => d.rooms)), sum(data.days.map(d => d.adults)), sum(data.days.map(d => d.children)), sum(data.days.map(d => d.bkf))]}
    />
  )
}

