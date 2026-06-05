'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

const TARIFA_STD = 22.50

interface Col { cod: string; cantidad: number }
interface HotelData { hotel: string; cols: Col[] }

function getPrecio(cod: string): number {
  const m = cod.match(/(\d+)/)
  return m ? parseInt(m[1]) / 100 : TARIFA_STD
}

function parseHTML(html: string): HotelData | null {
  let hotel = ''
  if (/ibis/i.test(html)) hotel = 'Ibis Styles Madrid City Las Ventas'
  else if (/novotel/i.test(html)) hotel = 'Novotel Madrid City Las Ventas'
  else hotel = 'Hotel desconocido'

  const texts: string[] = []
  const re = /<font[^>]*size=["']?1["']?[^>]*>([\s\S]*?)<\/font>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const t = m[1].replace(/&nbsp;/g, '').replace(/<[^>]+>/g, '').trim()
    if (t) texts.push(t)
  }

  const dateIdx = texts.indexOf('Date')
  if (dateIdx === -1) return null

  const codigos: string[] = []
  let i = dateIdx + 1
  while (i < texts.length && !/^\d+$/.test(texts[i]) && texts[i] !== 'Total') {
    if (/^[A-Z][A-Z0-9\-]+$/.test(texts[i])) codigos.push(texts[i])
    i++
  }
  if (texts[i] === 'Total') i++
  while (i < texts.length && !/^\d+$/.test(texts[i])) i++

  const nums: number[] = []
  while (i < texts.length && /^\d+$/.test(texts[i])) {
    nums.push(parseInt(texts[i])); i++
  }

  const cantidades = nums.slice(0, codigos.length)
  const cols = codigos.map((cod, idx) => ({ cod, cantidad: cantidades[idx] || 0 }))
  return { hotel, cols }
}

function euros(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function mañana(): Date {
  const d = new Date(); d.setDate(d.getDate() + 1); return d
}
function fmtLong(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtShort(d: Date): string {
  return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), String(d.getFullYear()).slice(-2)].join('.')
}
function fmtISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function PrefacturacionPage() {
  const fechaFact = mañana()
  const [files, setFiles] = useState<File[]>([])
  const [hoteles, setHoteles] = useState<HotelData[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  function handleFiles(newFiles: File[]) {
    setFiles(newFiles)
    setHoteles([])
    setSaved(false)
    setError('')
  }

  async function procesar() {
    setError(''); setHoteles([]); setSaved(false)
    const result: HotelData[] = []
    for (const file of files) {
      const text = await file.text()
      const parsed = parseHTML(text)
      if (!parsed || !parsed.cols.length) {
        setError(`No se encontraron datos en ${file.name}`)
        return
      }
      result.push(parsed)
    }
    setHoteles(result)
  }

  async function guardar() {
    setSaving(true)
    try {
      const payload = {
        fecha_facturacion: fmtISO(fechaFact),
        hoteles: hoteles.map(h => ({
          hotel: h.hotel,
          cols: h.cols.map(c => ({
            cod: c.cod,
            cantidad: c.cantidad,
            precio: getPrecio(c.cod),
            importe: c.cantidad * getPrecio(c.cod),
          })),
        })),
      }
      const res = await fetch('/api/prefacturacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setSaved(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  function imprimir() {
    window.print()
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .hotel-card { break-inside: avoid; border: 1px solid #ccc !important; }
          .global-card { break-inside: avoid; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        {/* Topbar */}
        <div className="no-print" style={{ background: '#1a1916', color: '#f5f4f0', padding: '0 2rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 12, fontFamily: 'var(--mono)' }}>← Inicio</Link>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, opacity: 0.9 }}>NOVOTEL · IBIS</span>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize: 13, opacity: 0.6 }}>Prefacturación desayunos</span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, opacity: 0.5 }}>
            {fmtShort(new Date())} · {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 6 }}>Prefacturación desayunos</h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4caf50', flexShrink: 0, display: 'inline-block' }} />
              Facturación: {fmtLong(fechaFact)}
            </div>
          </div>

          {/* Upload */}
          <div className="no-print" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(Array.from(e.dataTransfer.files).filter(f => /\.html?$/i.test(f.name))) }}
              style={{ border: `1.5px dashed ${drag ? '#1a1916' : 'var(--border-strong)'}`, background: drag ? '#f0efe9' : 'var(--bg)', borderRadius: 6, padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem', transition: 'all .15s' }}
            >
              <div style={{ width: 40, height: 40, margin: '0 auto 10px', border: '1.5px solid var(--border-strong)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4M8 8l4-4 4 4"/></svg>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Arrastra los dos archivos HTML o <span style={{ color: 'var(--text)', fontWeight: 500 }}>haz clic para seleccionar</span></p>
              <small style={{ fontSize: 11, color: 'var(--text-faint)', display: 'block', marginTop: 4 }}>pkgforecast Ibis Styles + Novotel (.html)</small>
            </div>
            <input ref={fileRef} type="file" multiple accept=".html,.htm" style={{ display: 'none' }} onChange={e => handleFiles(Array.from(e.target.files || []))} />

            {files.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
                {files.map(f => (
                  <div key={f.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 4, fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid #c3e8cc' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
                    {f.name}
                  </div>
                ))}
              </div>
            )}

            {error && <div style={{ background: '#fff0f0', border: '1px solid #fcc', color: '#c00', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: '1rem' }}>{error}</div>}

            <button
              onClick={procesar}
              disabled={files.length < 1}
              style={{ width: '100%', padding: 11, background: files.length < 1 ? '#ccc' : '#1a1916', color: '#f5f4f0', border: 'none', borderRadius: 6, fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, cursor: files.length < 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h2M8 12h2M8 16h2M14 8h2M14 12h2M14 16h2"/></svg>
              Calcular prefacturación
            </button>
          </div>

          {/* Resultados */}
          {hoteles.length > 0 && (
            <div ref={printRef}>
              {/* Acciones */}
              <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button onClick={imprimir} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--sans)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Imprimir / PDF
                </button>
                <button
                  onClick={guardar}
                  disabled={saving || saved}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', background: saved ? 'var(--success-bg)' : '#1a1916', color: saved ? 'var(--success-text)' : '#f5f4f0', borderRadius: 6, cursor: saving || saved ? 'default' : 'pointer', fontSize: 13, fontFamily: 'var(--sans)', opacity: saving ? 0.6 : 1 }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  {saving ? 'Guardando...' : saved ? '✓ Guardado en historial' : 'Guardar en historial'}
                </button>
              </div>

              {hoteles.map((h, hi) => {
                const precios = h.cols.map(c => getPrecio(c.cod))
                const importes = h.cols.map((c, i) => c.cantidad * precios[i])
                const totCub = h.cols.reduce((s, c) => s + c.cantidad, 0)
                const totImp = importes.reduce((s, v) => s + v, 0)
                const prefNum = Math.floor(totImp / TARIFA_STD)
                const prefImp = prefNum * TARIFA_STD
                const ajuste = totImp - prefImp

                return (
                  <div key={hi} className="hotel-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '1.5rem', overflow: 'hidden' }}>
                    {/* Header hotel */}
                    <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{h.hotel}</div>
                      <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--info-bg)', color: 'var(--info-text)', padding: '3px 8px', borderRadius: 4 }}>{fmtShort(fechaFact)}</div>
                    </div>

                    {/* Tabla columnas */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', background: 'var(--bg)', minWidth: 120, whiteSpace: 'nowrap' }}></th>
                            {h.cols.map((c, ci) => {
                              const tieneNum = /\d/.test(c.cod)
                              return (
                                <th key={ci} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', borderRight: ci < h.cols.length - 1 ? '1px solid var(--border)' : 'none', textAlign: 'center', background: 'var(--bg)', whiteSpace: 'nowrap' }}>
                                  {c.cod}<br />
                                  <span style={{ fontSize: 9, fontFamily: 'var(--mono)', padding: '1px 5px', borderRadius: 3, background: tieneNum ? 'var(--info-bg)' : 'var(--bg)', color: tieneNum ? 'var(--info-text)' : 'var(--text-faint)', border: tieneNum ? 'none' : '1px solid var(--border)', display: 'inline-block', marginTop: 3 }}>
                                    {tieneNum ? 'código' : 'std'}
                                  </span>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Cubiertos */}
                          <tr>
                            <td style={{ padding: '9px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>Cubiertos</td>
                            {h.cols.map((c, ci) => (
                              <td key={ci} style={{ padding: '9px 14px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, borderBottom: '1px solid var(--border)', borderRight: ci < h.cols.length - 1 ? '1px solid var(--border)' : 'none' }}>{c.cantidad}</td>
                            ))}
                          </tr>
                          {/* Tarifa */}
                          <tr>
                            <td style={{ padding: '5px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>Tarifa</td>
                            {precios.map((p, ci) => (
                              <td key={ci} style={{ padding: '5px 14px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', borderRight: ci < h.cols.length - 1 ? '1px solid var(--border)' : 'none' }}>{euros(p)}</td>
                            ))}
                          </tr>
                          {/* Importe */}
                          <tr>
                            <td style={{ padding: '9px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--info-text)', fontWeight: 500, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--info-bg)', whiteSpace: 'nowrap' }}>Importe</td>
                            {importes.map((v, ci) => (
                              <td key={ci} style={{ padding: '9px 14px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 500, color: 'var(--info-text)', background: 'var(--info-bg)', borderBottom: '1px solid var(--border)', borderRight: ci < h.cols.length - 1 ? '1px solid var(--border)' : 'none' }}>{euros(v)}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen */}
                    <div style={{ borderTop: '2px solid var(--border-strong)' }}>
                      {/* Fila sup: importe total + comensales */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ padding: '1.1rem 1.5rem', borderRight: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', marginBottom: 4 }}>Importe total</div>
                          <div style={{ fontSize: 26, fontWeight: 300, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>{euros(totImp)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>suma de todas las columnas</div>
                        </div>
                        <div style={{ padding: '1.1rem 1.5rem' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', marginBottom: 4 }}>Total comensales</div>
                          <div style={{ fontSize: 26, fontWeight: 300, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>{totCub}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>cubiertos reales</div>
                        </div>
                      </div>
                      {/* Fila inf: desayunos | importe | ajuste */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div style={{ padding: '1.1rem 1.5rem', borderRight: '1px solid var(--border)', background: 'var(--success-bg)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--success-text)', opacity: 0.8, marginBottom: 4 }}>Desayunos a facturar</div>
                          <div style={{ fontSize: 26, fontWeight: 300, fontFamily: 'var(--mono)', letterSpacing: '-0.02em', color: 'var(--success-text)' }}>{prefNum}</div>
                          <div style={{ fontSize: 11, color: 'var(--success-text)', opacity: 0.6, fontFamily: 'var(--mono)', marginTop: 2 }}>unidades × 22,50 €</div>
                        </div>
                        <div style={{ padding: '1.1rem 1.5rem', borderRight: '1px solid var(--border)', background: 'var(--success-bg)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--success-text)', opacity: 0.8, marginBottom: 4 }}>Importe a facturar</div>
                          <div style={{ fontSize: 26, fontWeight: 300, fontFamily: 'var(--mono)', letterSpacing: '-0.02em', color: 'var(--success-text)' }}>{euros(prefImp)}</div>
                          <div style={{ fontSize: 11, color: 'var(--success-text)', opacity: 0.6, fontFamily: 'var(--mono)', marginTop: 2 }}>{prefNum} × 22,50 €</div>
                        </div>
                        <div style={{ padding: '1.1rem 1.5rem', background: 'var(--warning-bg)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--warning-text)', opacity: 0.8, marginBottom: 4 }}>Ajuste</div>
                          <div style={{ fontSize: 26, fontWeight: 300, fontFamily: 'var(--mono)', letterSpacing: '-0.02em', color: 'var(--warning-text)' }}>{euros(ajuste)}</div>
                          <div style={{ fontSize: 11, color: 'var(--warning-text)', opacity: 0.6, fontFamily: 'var(--mono)', marginTop: 2 }}>{euros(prefImp)} + {euros(ajuste)} = {euros(totImp)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Global */}
              {(() => {
                const gCub = hoteles.reduce((s, h) => s + h.cols.reduce((ss, c) => ss + c.cantidad, 0), 0)
                const gImp = hoteles.reduce((s, h) => s + h.cols.reduce((ss, c) => ss + c.cantidad * getPrecio(c.cod), 0), 0)
                const gPrefNum = Math.floor(gImp / TARIFA_STD)
                const gPrefImp = gPrefNum * TARIFA_STD
                const gAjuste = gImp - gPrefImp
                return (
                  <div className="global-card" style={{ background: '#1a1916', color: '#f5f4f0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 500, letterSpacing: '0.03em', opacity: 0.9 }}>
                      Resumen global — ambos hoteles
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                      {[
                        { label: 'Importe total', value: euros(gImp), sub: 'ambos hoteles' },
                        { label: 'Total comensales', value: String(gCub), sub: 'cubiertos reales' },
                        { label: 'Desayunos a facturar', value: String(gPrefNum), sub: 'unidades' },
                        { label: 'Importe a facturar', value: euros(gPrefImp), sub: `${gPrefNum} × 22,50 €` },
                        { label: 'Ajuste global', value: euros(gAjuste), sub: `${euros(gPrefImp)} + ${euros(gAjuste)}` },
                      ].map((item, i, arr) => (
                        <div key={i} style={{ padding: '1.1rem 1.25rem', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 300, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.95)' }}>{item.value}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)', marginTop: 3 }}>{item.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
