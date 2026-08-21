'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type FilaTPV = { nombre: string; cantidad: number }
type Reconciliacion = { seccion: string; declarado: number; sumado: number; cuadra: boolean }
type Analisis = {
  fecha: string
  lineas: FilaTPV[]
  reconciliacion: Reconciliacion[]
  sinMapear: string[]
}
type Producto = { id: number; nombre: string }

const f = (v: number) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return (Math.round(n * 100) / 100).toString().replace('.', ',')
}

const CSS = `
.stkt{min-height:100vh;background:var(--bg,#0c0f14);color:var(--txt,#eef1f6);
  font-family:-apple-system,system-ui,sans-serif;padding-bottom:40px}
.stkt-top{padding:14px 14px 6px;border-bottom:1px solid var(--line,#242a36)}
.stkt-top h1{font-size:16px;margin:0 0 3px}
.stkt-top p{margin:0;font-size:12.5px;color:var(--dim,#8992a3)}
.stkt-nav{margin-top:8px;display:flex;gap:14px}
.stkt-nav a{font-size:12px;color:var(--dim,#8992a3);text-decoration:underline}
.stkt-drop{margin:16px 14px;border:1.5px dashed var(--line,#242a36);border-radius:14px;
  padding:28px 16px;text-align:center;cursor:pointer}
.stkt-drop:hover{border-color:var(--acc,#5fd0ff)}
.stkt-drop input{display:none}
.stkt-drop p{margin:0;font-size:13px;color:var(--dim,#8992a3)}
.stkt-drop b{color:var(--txt,#eef1f6);font-weight:600}
.stkt-msg{margin:16px 14px;font-size:13px;color:var(--dim,#8992a3)}
.stkt-err{margin:16px 14px;padding:10px 12px;border:1px solid #7a3a3a;background:#2a1616;
  border-radius:10px;font-size:12.5px;color:#e08080}
.stkt-sec{margin:0 14px 14px}
.stkt-sec h2{font-size:13px;margin:0 0 8px;color:var(--dim,#8992a3);font-weight:600;
  text-transform:uppercase;letter-spacing:.03em}
.stkt-recon{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:4px}
.stkt-recon th,.stkt-recon td{padding:6px 8px;border-bottom:1px solid #1c212b;text-align:right}
.stkt-recon th:first-child,.stkt-recon td:first-child{text-align:left}
.stkt-recon td[data-ok="0"]{color:var(--warn,#e2a33d);font-weight:700}
.stkt-recon td[data-ok="1"]{color:var(--ok,#57c785)}
.stkt-item{border:1px solid var(--line,#242a36);border-radius:10px;padding:10px 12px;
  margin-bottom:8px}
.stkt-item-nom{font-size:13.5px;font-weight:600;margin-bottom:8px}
.stkt-item-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.stkt-item input[type=text]{flex:1;min-width:140px;height:34px;border-radius:8px;
  border:1px solid var(--line,#242a36);background:var(--bg,#0c0f14);color:var(--txt,#eef1f6);
  padding:0 9px;font-size:13px;font-family:inherit}
.stkt-item input[type=number]{width:64px;height:34px;border-radius:8px;
  border:1px solid var(--line,#242a36);background:var(--bg,#0c0f14);color:var(--txt,#eef1f6);
  padding:0 9px;font-size:13px;font-family:inherit}
.stkt-sugs{position:relative}
.stkt-suglist{position:absolute;top:36px;left:0;right:0;background:#161a22;
  border:1px solid var(--line,#242a36);border-radius:8px;max-height:180px;overflow:auto;z-index:5}
.stkt-suglist button{display:block;width:100%;text-align:left;background:none;border:0;
  color:var(--txt,#eef1f6);padding:7px 10px;font-size:12.5px;cursor:pointer;font-family:inherit}
.stkt-suglist button:hover{background:#20252f}
.stkt-item button.acc{height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--acc,#5fd0ff);
  background:var(--acc,#5fd0ff);color:#08111c;font-size:12.5px;font-weight:600;cursor:pointer;
  font-family:inherit}
.stkt-item button.acc:disabled{opacity:.4}
.stkt-item button.ign{height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--line,#242a36);
  background:none;color:var(--dim,#8992a3);font-size:12px;cursor:pointer;font-family:inherit}
.stkt-item[data-resuelto="1"]{opacity:.5}
.stkt-item-ok{font-size:12px;color:var(--ok,#57c785)}
.stkt-bar{margin:20px 14px;display:flex;gap:10px}
.stkt-bar button{flex:1;height:42px;border-radius:10px;border:1px solid var(--acc,#5fd0ff);
  background:var(--acc,#5fd0ff);color:#08111c;font-size:14px;font-weight:700;cursor:pointer;
  font-family:inherit}
.stkt-bar button:disabled{opacity:.4}
.stkt-ok{margin:16px 14px;padding:12px;border:1px solid #2e6b46;background:#122019;
  border-radius:10px;font-size:13px}
.stkt-ok a{color:var(--acc,#5fd0ff)}
`

export default function TpvPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<Analisis | null>(null)
  const [resueltos, setResueltos] = useState<Record<string, boolean>>({})
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const subir = async (file: File) => {
    setCargando(true)
    setError(null)
    setDatos(null)
    setResultado(null)
    setResueltos({})
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const r = await fetch('/api/stock/tpv/analizar', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) throw new Error(j.detalle || j.error || 'no se pudo analizar')
      setDatos(j)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const pendientes = useMemo(
    () => (datos?.sinMapear || []).filter((n) => !resueltos[n]),
    [datos, resueltos]
  )

  const importar = async () => {
    if (!datos) return
    setImportando(true)
    setError(null)
    try {
      const r = await fetch('/api/stock/tpv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'importar', fecha: datos.fecha, lineas: datos.lineas }),
      })
      const j = await r.json()
      if (!r.ok || j.ok === false) {
        if (j.sin_mapear) {
          setError('Aún quedan nombres sin resolver: ' + j.sin_mapear.join(', '))
        } else {
          throw new Error(j.detalle || j.error || 'no se pudo importar')
        }
        return
      }
      setResultado(j)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="stkt">
      <style>{CSS}</style>
      <div className="stkt-top">
        <h1>Cotejo con el TPV</h1>
        <p>Sube el informe "Operaciones diarias" y contrasta las ventas con el conteo de stock.</p>
        <div className="stkt-nav">
          <Link href="/stock/hoja">← Volver a la Hoja</Link>
        </div>
      </div>

      <div
        className="stkt-drop"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) subir(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) subir(file)
          }}
        />
        <p>
          <b>Toca para elegir el Excel</b> o arrástralo aquí
        </p>
      </div>

      {cargando && <p className="stkt-msg">Leyendo el informe…</p>}
      {error && <p className="stkt-err">{error}</p>}

      {datos && (
        <>
          <div className="stkt-sec">
            <h2>Fecha detectada: {datos.fecha}</h2>
            <table className="stkt-recon">
              <thead>
                <tr>
                  <th>Sección</th>
                  <th>Informe</th>
                  <th>Contabilizado</th>
                </tr>
              </thead>
              <tbody>
                {datos.reconciliacion.map((r) => (
                  <tr key={r.seccion}>
                    <td>{r.seccion}</td>
                    <td>{f(r.declarado)}</td>
                    <td data-ok={r.cuadra ? '1' : '0'}>
                      {f(r.sumado)} {r.cuadra ? '✓' : '⚠ no cuadra'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pendientes.length > 0 && (
            <div className="stkt-sec">
              <h2>{pendientes.length} nombres nuevos por resolver</h2>
              {pendientes.map((nombre) => (
                <ItemPendiente
                  key={nombre}
                  nombre={nombre}
                  onResuelto={() => setResueltos((s) => ({ ...s, [nombre]: true }))}
                />
              ))}
            </div>
          )}

          {!resultado && (
            <div className="stkt-bar">
              <button disabled={pendientes.length > 0 || importando} onClick={importar}>
                {importando
                  ? 'Importando…'
                  : pendientes.length > 0
                  ? `Resuelve los ${pendientes.length} pendientes primero`
                  : `Importar ventas del ${datos.fecha}`}
              </button>
            </div>
          )}

          {resultado && (
            <div className="stkt-ok">
              Importado: {resultado.aplicados} líneas actualizadas para el {resultado.fecha}.
              {resultado.sin_linea?.length > 0 && (
                <p style={{ marginTop: 6, color: 'var(--warn)' }}>
                  Ojo: {resultado.sin_linea.length} producto(s) con venta pero sin línea activa hoy
                  ({resultado.sin_linea.map((x: any) => x.producto).join(', ')}) — revisa sus zonas en
                  Ajustes.
                </p>
              )}
              <p style={{ marginTop: 8 }}>
                <Link href="/stock/hoja">Ver la Hoja del día →</Link>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ItemPendiente({ nombre, onResuelto }: { nombre: string; onResuelto: () => void }) {
  const [busca, setBusca] = useState('')
  const [sugs, setSugs] = useState<Producto[]>([])
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscar = async (texto: string) => {
    setBusca(texto)
    setElegido(null)
    if (texto.trim().length < 2) {
      setSugs([])
      return
    }
    try {
      const r = await fetch(`/api/stock/tpv?buscar=${encodeURIComponent(texto.trim())}`)
      const j = await r.json()
      if (r.ok) setSugs(j)
    } catch {
      // no critico
    }
  }

  const mapear = async () => {
    if (!elegido) return
    setEnviando(true)
    setError(null)
    try {
      const r = await fetch('/api/stock/tpv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'mapear',
          nombreTpv: nombre,
          productoId: elegido.id,
          cantidad: cantidad.replace(',', '.'),
        }),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'no se pudo guardar')
      setHecho(true)
      onResuelto()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const ignorar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const r = await fetch('/api/stock/tpv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'ignorar', nombreTpv: nombre, motivo: 'marcado manualmente' }),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'no se pudo guardar')
      setHecho(true)
      onResuelto()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (hecho) {
    return (
      <div className="stkt-item" data-resuelto="1">
        <div className="stkt-item-nom">{nombre}</div>
        <span className="stkt-item-ok">✓ resuelto</span>
      </div>
    )
  }

  return (
    <div className="stkt-item">
      <div className="stkt-item-nom">{nombre}</div>
      <div className="stkt-item-row">
        <div className="stkt-sugs" style={{ flex: 1, minWidth: 140 }}>
          <input
            type="text"
            placeholder="Buscar producto de tu catálogo…"
            value={elegido ? elegido.nombre : busca}
            onChange={(e) => buscar(e.target.value)}
          />
          {sugs.length > 0 && !elegido && (
            <div className="stkt-suglist">
              {sugs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setElegido(p)
                    setSugs([])
                  }}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="number"
          step="0.01"
          min="0"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          title="Cantidad de stock por unidad vendida (1 = directo, 0,1667 = 1/6 de botella…)"
        />
        <button className="acc" disabled={!elegido || enviando} onClick={mapear}>
          Asociar
        </button>
        <button className="ign" disabled={enviando} onClick={ignorar}>
          No cuenta stock
        </button>
      </div>
      {error && <p style={{ color: 'var(--warn)', fontSize: 11.5, marginTop: 6 }}>{error}</p>}
    </div>
  )
}
