'use client'

import Link from 'next/link'
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Topbar */}
      <div style={{ background: '#1a1916', color: '#f5f4f0', padding: '0 2rem', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 12, fontFamily: 'var(--mono)' }}>← Inicio</Link>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, opacity: 0.9 }}>NOVOTEL · IBIS</span>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: 13, opacity: 0.6 }}>Previsión de ocupación y desayunos contratados</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Upload */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FileZone label="Archivo Novotel (.RTF)" file={novotelFile} onChange={setNovotelFile} />
            <FileZone label="Archivo Ibis (.RTF)" file={ibisFile} onChange={setIbisFile} />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={!novotelFile || !ibisFile || loading}
            style={{
              width: '100%', padding: '10px', background: '#1a1916', color: '#f5f4f0',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              opacity: (!novotelFile || !ibisFile || loading) ? 0.4 : 1,
            }}
          >
            {loading ? 'Procesando...' : 'Generar tabla'}
          </button>
        </div>

        {/* Results */}
        {novotel && ibis && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }} className="print:hidden">
              <button onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                ↓ Exportar Excel
              </button>
              <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                ⎙ Imprimir
              </button>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)' }}>Fecha</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)' }}>Día</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', background: '#fefce8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>Total personas</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 500, fontSize: 11, color: 'var(--text-muted)', background: '#fefce8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>Desayunos contratados</th>
                  </tr>
                </thead>
                <tbody>
                  {combined.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 500 }}>{r.fecha}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{r.dia}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 600, color: '#dc2626', background: '#fefce8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>{r.personas}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 600, background: '#fefce8', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>{r.bkf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  )
}

function FileZone({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File) => void }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1.25rem', border: `2px dashed ${file ? '#86efac' : 'var(--border)'}`,
      borderRadius: 10, cursor: 'pointer', background: file ? '#f0fdf4' : 'var(--bg)',
      transition: 'all 0.15s',
    }}>
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.4, marginBottom: 6 }}>
        <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
      </svg>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
      {file && <span style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>{file.name}</span>}
      <input type="file" accept=".rtf,.RTF" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} />
    </label>
  )
}
