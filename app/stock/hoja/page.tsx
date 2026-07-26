'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Fila = {
  linea_id: number
  producto: string
  categoria: string
  cat_codigo: string
  seccion: string | null
  par: string
  inicial: string
  entradas: string
  final: string
  consumo: string
  nota: string | null
  contado: boolean
}
type Datos = {
  jornada: { id: number; fecha: string; estado: string; perfil: string | null }
  filas: Fila[]
}

const n = (v: any) => (v === null || v === undefined ? null : Number(v))
const f = (v: any) => {
  const x = n(v)
  return x === null ? '—' : String(Math.round(x * 100) / 100).replace('.', ',')
}

const CSS = `
.stkh{--bg:#12141a;--panel:#1b1f28;--line:#2f3644;--txt:#eef1f6;--dim:#8b94a7;--acc:#4ea3ff;
  --ok:#3ddc97;--warn:#ffb454;
  background:var(--bg);color:var(--txt);min-height:100vh;padding-bottom:78px;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.stkh *{box-sizing:border-box}
.stkh-top{position:sticky;top:0;z-index:20;background:rgba(18,20,26,.97);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line);padding:12px 14px}
.stkh-row1{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.stkh-h1{font-size:17px;font-weight:650;margin:0}
.stkh-sub{font-size:12px;color:var(--dim);margin:2px 0 0}
.stkh-link{font-size:13px;color:var(--acc);text-decoration:none;background:none;border:0;padding:6px;cursor:pointer}
.stkh-filtros{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}
.stkh-filtros::-webkit-scrollbar{display:none}
.stkh-f{flex:0 0 auto;padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:var(--panel);
  color:var(--dim);font-size:12.5px;white-space:nowrap;cursor:pointer}
.stkh-f[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:600}
.stkh-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.stkh-t{border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px}
.stkh-t th{position:sticky;top:0;background:#1b1f28;color:var(--dim);font-weight:600;font-size:11px;
  text-transform:uppercase;letter-spacing:.05em;padding:9px 10px;text-align:right;white-space:nowrap;
  border-bottom:1px solid var(--line)}
.stkh-t th:first-child,.stkh-t td:first-child{text-align:left;position:sticky;left:0;background:var(--bg);
  z-index:2;min-width:180px;box-shadow:1px 0 0 var(--line)}
.stkh-t th:first-child{background:#1b1f28;z-index:3}
.stkh-t td{padding:9px 10px;text-align:right;border-bottom:1px solid #20252f;
  font-variant-numeric:tabular-nums;white-space:nowrap}
.stkh-t tr[data-sin="1"] td{color:#5d6577}
.stkh-sec td{background:#171b23;color:var(--dim);font-size:10.5px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;text-align:left!important;padding:7px 10px}
.stkh-cons{font-weight:650;color:var(--txt)}
.stkh-ini sup{color:var(--warn);font-size:10px;margin-left:2px}
.stkh-nota{max-width:230px;white-space:normal;color:var(--warn);font-size:11.5px;text-align:left!important;
  line-height:1.35}
.stkh-msg{padding:60px 24px;text-align:center;color:var(--dim);font-size:14px;line-height:1.6}
.stkh-bar{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(27,31,40,.97);
  backdrop-filter:blur(8px);border-top:1px solid var(--line);
  padding:12px 14px calc(12px + env(safe-area-inset-bottom));display:flex;gap:12px;
  align-items:center;justify-content:space-between;font-size:12.5px;color:var(--dim)}
.stkh-bar b{color:var(--txt)}
.stkh-aviso{color:var(--warn)}
.stkh-pie{padding:18px 14px 8px;color:#5d6577;font-size:11.5px;line-height:1.5}
`

export default function HojaPage() {
  const [d, setD] = useState<Datos | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('todo')

  useEffect(() => {
    fetch('/api/stock/pedido')
      .then(async (r) => {
        const t = await r.text()
        let j: any
        try {
          j = JSON.parse(t)
        } catch {
          throw new Error(t.slice(0, 200) || 'respuesta vacía')
        }
        if (!r.ok) throw new Error(j.detalle || j.error)
        return j as Datos
      })
      .then(setD)
      .catch((e) => setFallo(e.message))
  }, [])

  const cats = useMemo(() => {
    const m = new Map<string, string>()
    d?.filas.forEach((x) => m.set(x.cat_codigo, x.categoria))
    return Array.from(m, ([codigo, nombre]) => ({ codigo, nombre }))
  }, [d])

  const filas = useMemo(() => {
    if (!d) return []
    if (filtro === 'todo') return d.filas
    if (filtro === 'sincontar') return d.filas.filter((x) => !x.contado)
    if (filtro === 'movido') return d.filas.filter((x) => x.contado && n(x.consumo)! !== 0)
    return d.filas.filter((x) => x.cat_codigo === filtro)
  }, [d, filtro])

  if (fallo)
    return (
      <div className="stkh">
        <style>{CSS}</style>
        <p className="stkh-msg">
          No se pudo cargar la hoja.
          <br />
          {fallo}
        </p>
      </div>
    )
  if (!d)
    return (
      <div className="stkh">
        <style>{CSS}</style>
        <p className="stkh-msg">Cargando la hoja…</p>
      </div>
    )

  const sinContar = d.filas.filter((x) => !x.contado).length
  const consumoTotal = d.filas.filter((x) => x.contado).reduce((a, x) => a + (n(x.consumo) || 0), 0)
  let seccionActual: string | null | undefined = undefined

  return (
    <div className="stkh">
      <style>{CSS}</style>

      <div className="stkh-top">
        <div className="stkh-row1">
          <div>
            <h1 className="stkh-h1">Hoja del {d.jornada.fecha}</h1>
            <p className="stkh-sub">
              {d.jornada.perfil ? `par ${d.jornada.perfil} · ` : ''}
              {d.filas.length} referencias
            </p>
          </div>
          <Link className="stkh-link" href="/stock">
            ← Contar
          </Link>
        </div>
        <div className="stkh-filtros">
          {[
            { k: 'todo', n: 'Todo' },
            { k: 'movido', n: 'Con consumo' },
            { k: 'sincontar', n: `Sin contar (${sinContar})` },
            ...cats.map((c) => ({ k: c.codigo, n: c.nombre })),
          ].map((x) => (
            <button key={x.k} className="stkh-f" data-on={filtro === x.k ? '1' : '0'} onClick={() => setFiltro(x.k)}>
              {x.n}
            </button>
          ))}
        </div>
      </div>

      <div className="stkh-scroll">
        <table className="stkh-t">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Inicial</th>
              <th>Entradas</th>
              <th>Final</th>
              <th>Consumo</th>
              <th style={{ textAlign: 'left' }}>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((x) => {
              const etiqueta = [x.categoria, x.seccion].filter(Boolean).join(' · ')
              const cab =
                filtro === 'todo' && etiqueta !== seccionActual ? ((seccionActual = etiqueta), etiqueta) : null
              const arrastre = Math.abs((n(x.inicial) || 0) - (n(x.par) || 0)) > 0.001
              return (
                <>
                  {cab && (
                    <tr className="stkh-sec" key={`s${x.linea_id}`}>
                      <td colSpan={6}>{cab}</td>
                    </tr>
                  )}
                  <tr key={x.linea_id} data-sin={x.contado ? '0' : '1'}>
                    <td>{x.producto}</td>
                    <td className="stkh-ini">
                      {f(x.inicial)}
                      {arrastre && <sup title={`El par es ${f(x.par)}`}>▲</sup>}
                    </td>
                    <td>{n(x.entradas) ? f(x.entradas) : '—'}</td>
                    <td>{x.contado ? f(x.final) : '—'}</td>
                    <td className={x.contado ? 'stkh-cons' : ''}>{x.contado ? f(x.consumo) : '—'}</td>
                    <td className="stkh-nota">{x.nota || ''}</td>
                  </tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="stkh-pie">
        Inicial = lo que quedó ayer más lo que subió el economato. El ▲ marca las que no coinciden con el par.
        Consumo = inicial + entradas − final.
      </p>

      <div className="stkh-bar">
        <span>
          Consumo del día: <b>{Math.round(consumoTotal * 100) / 100}</b> envases
        </span>
        {sinContar > 0 ? (
          <span className="stkh-aviso">Faltan {sinContar} por contar</span>
        ) : (
          <span style={{ color: 'var(--ok)' }}>Todo contado</span>
        )}
      </div>
    </div>
  )
}
