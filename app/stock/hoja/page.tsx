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
  pedido: string | null
  pedido_sugerido: string
  recibido: string | null
  estado_pedido: string
  contado: boolean
}
type Datos = {
  jornada: { id: number; fecha: string; estado: string; perfil: string | null } | null
  filas: Fila[]
}

const n = (v: any) => (v === null || v === undefined ? null : Number(v))
const f = (v: any) => {
  const x = n(v)
  return x === null ? '—' : String(Math.round(x * 100) / 100).replace('.', ',')
}
const hoyOperativo = () => {
  const d = new Date()
  d.setHours(d.getHours() - 4)
  return d.toISOString().slice(0, 10)
}
const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const CSS = `
.stkh{--bg:#12141a;--panel:#1b1f28;--line:#2f3644;--txt:#eef1f6;--dim:#8b94a7;--acc:#4ea3ff;
  --ok:#3ddc97;--warn:#ffb454;
  background:var(--bg);color:var(--txt);min-height:100vh;padding-bottom:104px;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.stkh *{box-sizing:border-box}
.stkh-top{position:sticky;top:0;z-index:20;background:rgba(18,20,26,.97);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line);padding:11px 14px}
.stkh-row1{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
.stkh-h1{font-size:16px;font-weight:650;margin:0}
.stkh-sub{font-size:11.5px;color:var(--dim);margin:2px 0 0}
.stkh-link{font-size:13px;color:var(--acc);text-decoration:none;background:none;border:0;padding:6px;
  cursor:pointer;white-space:nowrap}
.stkh-nav{display:flex;align-items:center;gap:6px;margin-bottom:9px}
.stkh-nav button{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);font-size:15px;cursor:pointer}
.stkh-nav input[type=date]{flex:1 1 auto;min-width:0;height:34px;border-radius:8px;
  border:1px solid var(--line);background:var(--panel);color:var(--txt);padding:0 8px;font-size:13px;
  font-family:inherit;color-scheme:dark}
.stkh-hoy{padding:0 11px!important;width:auto!important;font-size:12.5px!important;font-weight:600}
.stkh-busca{position:relative;margin-bottom:9px}
.stkh-busca input{width:100%;height:38px;border-radius:9px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);padding:0 34px 0 12px;font-size:14.5px;font-family:inherit}
.stkh-busca input:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkh-x{position:absolute;right:4px;top:4px;width:30px;height:30px;border:0;background:none;
  color:var(--dim);font-size:17px;cursor:pointer}
.stkh-filtros{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}
.stkh-filtros::-webkit-scrollbar{display:none}
.stkh-f{flex:0 0 auto;padding:7px 12px;border-radius:999px;border:1px solid var(--line);
  background:var(--panel);color:var(--dim);font-size:12.5px;white-space:nowrap;cursor:pointer}
.stkh-f[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:600}
.stkh-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.stkh-t{border-collapse:collapse;width:100%;min-width:820px;font-size:13.5px}
.stkh-t th{position:sticky;top:0;background:#1b1f28;color:var(--dim);font-weight:600;font-size:11px;
  text-transform:uppercase;letter-spacing:.05em;padding:9px 10px;text-align:right;white-space:nowrap;
  border-bottom:1px solid var(--line)}
.stkh-t th:first-child,.stkh-t td:first-child{text-align:left;position:sticky;left:0;
  background:var(--bg);z-index:2;min-width:180px;box-shadow:1px 0 0 var(--line)}
.stkh-t th:first-child{background:#1b1f28;z-index:3}
.stkh-t td{padding:8px 10px;text-align:right;border-bottom:1px solid #20252f;
  font-variant-numeric:tabular-nums;white-space:nowrap}
.stkh-t tr[data-sin="1"] td{color:#5d6577}
.stkh-sec td{background:#171b23;color:var(--dim);font-size:10.5px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;text-align:left!important;padding:7px 10px}
.stkh-cons{font-weight:650;color:var(--txt)}
.stkh-ini sup{color:var(--warn);font-size:10px;margin-left:2px}
.stkh-in{width:60px;height:31px;border-radius:7px;border:1px solid var(--line);background:#12151c;
  color:var(--txt);text-align:center;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.stkh-in:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkh-sel{height:31px;border-radius:7px;border:1px solid var(--line);background:#12151c;
  color:var(--txt);font-size:12px;padding:0 4px;font-family:inherit}
.stkh-nota{max-width:220px;white-space:normal;color:var(--warn);font-size:11.5px;
  text-align:left!important;line-height:1.35}
.stkh-msg{padding:60px 24px;text-align:center;color:var(--dim);font-size:14px;line-height:1.6}
.stkh-pie{padding:16px 14px 6px;color:#5d6577;font-size:11.5px;line-height:1.5}
.stkh-bar{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(27,31,40,.97);
  backdrop-filter:blur(8px);border-top:1px solid var(--line);
  padding:10px 14px calc(10px + env(safe-area-inset-bottom))}
.stkh-barrow{display:flex;gap:8px;align-items:center;justify-content:space-between;
  font-size:12px;color:var(--dim)}
.stkh-barrow b{color:var(--txt)}
.stkh-acc{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
.stkh-acc button,.stkh-acc a{border:1px solid var(--line);border-radius:9px;background:var(--panel);
  color:var(--txt);font-size:12.5px;font-weight:600;padding:9px 12px;cursor:pointer;
  text-decoration:none;font-family:inherit}
.stkh-acc .pri{background:var(--acc);border-color:var(--acc);color:#08111c}
.stkh-acc button:disabled{opacity:.4}
`

export default function HojaPage() {
  const [fecha, setFecha] = useState(hoyOperativo())
  const [d, setD] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('todo')
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const esHoy = fecha === hoyOperativo()

  const cargar = async (fch: string) => {
    setCargando(true)
    setFallo(null)
    try {
      const url = fch === hoyOperativo() ? '/api/stock/pedido' : `/api/stock/pedido?fecha=${fch}`
      const r = await fetch(url)
      const t = await r.text()
      let j: any
      try {
        j = JSON.parse(t)
      } catch {
        throw new Error(t.slice(0, 200) || 'respuesta vacía')
      }
      if (!r.ok) throw new Error(j.detalle || j.error)
      setD(j)
    } catch (e: any) {
      setFallo(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar(fecha)
  }, [fecha])

  const mover = (dias: number) => {
    const x = new Date(fecha + 'T12:00:00')
    x.setDate(x.getDate() + dias)
    setFecha(x.toISOString().slice(0, 10))
  }

  const guardar = async (lineaId: number, campo: 'pedido' | 'recibido' | 'estado', valor: string) => {
    await fetch('/api/stock/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineaId, [campo]: valor }),
    })
  }

  const cats = useMemo(() => {
    const m = new Map<string, string>()
    d?.filas.forEach((x) => m.set(x.cat_codigo, x.categoria))
    return Array.from(m, ([codigo, nombre]) => ({ codigo, nombre }))
  }, [d])

  const filas = useMemo(() => {
    if (!d) return []
    let r = d.filas
    if (busca.trim()) {
      const q = sinTildes(busca.trim())
      r = r.filter((x) => sinTildes(x.producto).includes(q))
    }
    if (filtro === 'consumo') r = r.filter((x) => x.contado && n(x.consumo) !== 0)
    else if (filtro === 'sincontar') r = r.filter((x) => !x.contado)
    else if (filtro === 'pedido') r = r.filter((x) => n(x.pedido) !== null && n(x.pedido)! > 0)
    else if (filtro === 'nota') r = r.filter((x) => !!x.nota)
    else if (filtro !== 'todo') r = r.filter((x) => x.cat_codigo === filtro)
    return r
  }, [d, filtro, busca])

  const pedidoLineas = useMemo(
    () => (d?.filas || []).filter((x) => n(x.pedido) !== null && n(x.pedido)! > 0),
    [d]
  )

  const textoPedido = useMemo(() => {
    const l = [`Pedido a economato — ${fecha}`, '']
    let cat = ''
    pedidoLineas.forEach((x) => {
      if (x.categoria !== cat) {
        cat = x.categoria
        l.push(`— ${cat.toUpperCase()} —`)
      }
      l.push(`${f(x.pedido)} · ${x.producto}`)
    })
    if (!pedidoLineas.length) l.push('(sin lineas)')
    return l.join('\n')
  }, [pedidoLineas, fecha])

  const descargarCsv = () => {
    const cab = ['Producto', 'Categoria', 'Inicial', 'Entradas', 'Final', 'Consumo', 'Pedido', 'Recibido', 'Estado', 'Comentarios']
    const filasCsv = (d?.filas || []).map((x) =>
      [x.producto, x.categoria, x.inicial, x.entradas, x.final, x.consumo, x.pedido ?? '', x.recibido ?? '', x.estado_pedido, (x.nota || '').replace(/[\r\n]+/g, ' ')]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';')
    )
    const csv = '\uFEFF' + [cab.join(';'), ...filasCsv].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `stock_${fecha}.csv`
    a.click()
  }

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

  const sinContar = (d?.filas || []).filter((x) => !x.contado).length
  const consumoTotal = (d?.filas || [])
    .filter((x) => x.contado)
    .reduce((a, x) => a + (n(x.consumo) || 0), 0)
  let seccionActual: string | null | undefined = undefined

  return (
    <div className="stkh">
      <style>{CSS}</style>

      <div className="stkh-top">
        <div className="stkh-row1">
          <div>
            <h1 className="stkh-h1">Hoja de stock</h1>
            <p className="stkh-sub">
              {d?.jornada
                ? `${d.jornada.perfil ? `par ${d.jornada.perfil} · ` : ''}${d.filas.length} referencias`
                : 'sin datos para esta fecha'}
            </p>
          </div>
          <Link className="stkh-link" href="/stock">
            ← Contar
          </Link>
        </div>

        <div className="stkh-nav">
          <button onClick={() => mover(-1)} aria-label="Dia anterior">
            &#8249;
          </button>
          <input type="date" value={fecha} max={hoyOperativo()} onChange={(e) => setFecha(e.target.value)} />
          <button onClick={() => mover(1)} disabled={esHoy} aria-label="Dia siguiente">
            &#8250;
          </button>
          {!esHoy && (
            <button className="stkh-hoy" onClick={() => setFecha(hoyOperativo())}>
              Hoy
            </button>
          )}
        </div>

        <div className="stkh-busca">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar producto…"
            autoComplete="off"
          />
          {busca && (
            <button className="stkh-x" onClick={() => setBusca('')} aria-label="Limpiar">
              ×
            </button>
          )}
        </div>

        <div className="stkh-filtros">
          {[
            { k: 'todo', n: 'Todo' },
            { k: 'consumo', n: 'Con consumo' },
            { k: 'pedido', n: `Pedido (${pedidoLineas.length})` },
            { k: 'sincontar', n: `Sin contar (${sinContar})` },
            { k: 'nota', n: 'Con comentario' },
            ...cats.map((c) => ({ k: c.codigo, n: c.nombre })),
          ].map((x) => (
            <button key={x.k} className="stkh-f" data-on={filtro === x.k ? '1' : '0'} onClick={() => setFiltro(x.k)}>
              {x.n}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="stkh-msg">Cargando…</p>
      ) : !d?.jornada ? (
        <p className="stkh-msg">
          No hay hoja del {fecha}.
          <br />
          Ese día no se abrió ninguna jornada.
        </p>
      ) : filas.length === 0 ? (
        <p className="stkh-msg">Ningún producto coincide con la búsqueda.</p>
      ) : (
        <div className="stkh-scroll">
          <table className="stkh-t">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Inicial</th>
                <th>Entradas</th>
                <th>Final</th>
                <th>Consumo</th>
                <th>Pedido</th>
                <th>Recibido</th>
                <th>Estado</th>
                <th style={{ textAlign: 'left' }}>Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((x) => {
                const etiqueta = [x.categoria, x.seccion].filter(Boolean).join(' · ')
                const cab =
                  filtro === 'todo' && !busca && etiqueta !== seccionActual
                    ? ((seccionActual = etiqueta), etiqueta)
                    : null
                const arrastre = Math.abs((n(x.inicial) || 0) - (n(x.par) || 0)) > 0.001
                return (
                  <>
                    {cab && (
                      <tr className="stkh-sec" key={`s${x.linea_id}`}>
                        <td colSpan={9}>{cab}</td>
                      </tr>
                    )}
                    <tr key={x.linea_id} data-sin={x.contado ? '0' : '1'}>
                      <td>{x.producto}</td>
                      <td className="stkh-ini">
                        {f(x.inicial)}
                        {arrastre && <sup title={`El par es ${f(x.par)}`}>&#9650;</sup>}
                      </td>
                      <td>{n(x.entradas) ? f(x.entradas) : '—'}</td>
                      <td>{x.contado ? f(x.final) : '—'}</td>
                      <td className={x.contado ? 'stkh-cons' : ''}>{x.contado ? f(x.consumo) : '—'}</td>
                      <td>
                        <input
                          className="stkh-in"
                          inputMode="decimal"
                          placeholder={x.contado ? f(x.pedido_sugerido) : ''}
                          defaultValue={x.pedido ?? ''}
                          onBlur={(e) => guardar(x.linea_id, 'pedido', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="stkh-in"
                          inputMode="decimal"
                          defaultValue={x.recibido ?? ''}
                          onBlur={(e) => guardar(x.linea_id, 'recibido', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="stkh-sel"
                          defaultValue={x.estado_pedido}
                          onChange={(e) => guardar(x.linea_id, 'estado', e.target.value)}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="subido">Subido</option>
                          <option value="parcial">A medias</option>
                          <option value="no_subido">No subido</option>
                        </select>
                      </td>
                      <td className="stkh-nota">{x.nota || ''}</td>
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {d?.jornada && (
        <p className="stkh-pie">
          Inicial = lo que quedó ayer más lo que subió el economato; el triángulo marca las que no coinciden
          con el par. Consumo = inicial + entradas − final. El pedido devuelve al par.
        </p>
      )}

      <div className="stkh-bar">
        <div className="stkh-barrow">
          <span>
            Consumo: <b>{Math.round(consumoTotal * 100) / 100}</b> · Pedido: <b>{pedidoLineas.length}</b> líneas
          </span>
          {sinContar > 0 ? (
            <span style={{ color: 'var(--warn)' }}>Faltan {sinContar}</span>
          ) : (
            <span style={{ color: 'var(--ok)' }}>Todo contado</span>
          )}
        </div>
        <div className="stkh-acc">
          <button
            className="pri"
            disabled={ocupado || !d?.jornada}
            onClick={async () => {
              setOcupado(true)
              await fetch('/api/stock/pedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generar: true, jornadaId: d!.jornada!.id }),
              })
              await cargar(fecha)
              setOcupado(false)
            }}
          >
            {ocupado ? 'Calculando…' : 'Rellenar pedido'}
          </button>
          <button
            disabled={!pedidoLineas.length}
            onClick={async () => {
              await navigator.clipboard.writeText(textoPedido)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 2000)
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar pedido'}
          </button>
          <a
            href={`mailto:?subject=${encodeURIComponent('Pedido economato ' + fecha)}&body=${encodeURIComponent(textoPedido)}`}
          >
            Enviar por email
          </a>
          <button onClick={descargarCsv} disabled={!d?.jornada}>
            Descargar CSV
          </button>
        </div>
      </div>
    </div>
  )
}
