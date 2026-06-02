'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { ForecastData, DayData } from '@/lib/parseRTF'

interface CombinedDay {
  fecha: string
  dia: string
  personas: number
  bkf: number
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
      personas: (nd?.adults ?? 0) + (nd?.children ?? 0) + (id?.adults ?? 0) + (id?.children ?? 0),
      bkf: (nd?.bkf ?? 0) + (id?.bkf ?? 0) + (nd?.children ?? 0) + (id?.children ?? 0),
    }
  })
}

export default function ForecastPage() {
  const [novotelFile, setNovotelFile] = useState<File | null>(null)
  const [ibisFile, setIbisFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [novotel, setNovotel] = useState<ForecastData | null>(null)
  const [ibis, setIbis] = useState<ForecastData | null>(null)

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
    const data = [
      ['Fecha', 'Día', 'Total personas', 'Desayunos contratados'],
      ...combined.map(r => [r.fecha, r.dia, r.personas, r.bkf]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Forecast')
    XLSX.writeFile(wb, `forecast_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const combined = novotel && ibis ? buildCombined(novotel, ibis) : []

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
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
            {loading ? 'Procesando...' : 'Generar tabla'}
          </button>
        </div>

        {novotel && ibis && (
          <div>
            <div className="flex gap-3 mb-4 print:hidden">
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 bg-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                Exportar Excel
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 bg-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Imprimir
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 text-xs text-gray-400 print:hidden">
                Datos del día anterior · Novotel + Ibis
              </div>
              <table className="w-full text-sm" style={{WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Fecha</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Día</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 bg-yellow-50">Total personas</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 bg-yellow-50">Desayunos contratados</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{r.fecha}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{r.dia}</td>
                      <td className="px-4 py-2 text-center font-semibold text-red-600 bg-yellow-50">{r.personas}</td>
                      <td className="px-4 py-2 text-center font-semibold text-gray-700 bg-yellow-50">{r.bkf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
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
