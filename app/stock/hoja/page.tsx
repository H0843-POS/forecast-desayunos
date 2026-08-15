'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
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
  origen_inicial: 'manual' | 'par'
}
type Datos = {
  jornada: { id: number; fecha: string; estado: string; perfil: string | null } | null
  filas: Fila[]
}

type Ubicacion = { id: number; codigo: string; nombre: string; almacen: boolean }
type ProductoConteo = {
  linea_id: number
  ubicaciones: number[]
  conteos: Record<string, number>
}
type DatosConteo = { ubicaciones: Ubicacion[]; productos: ProductoConteo[] }

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

// La tabla vive en su PROPIO contenedor con scroll. Asi la cabecera se pega a
// top:0 de ese contenedor y no depende de medir el alto del panel superior,
// que era justo lo que la descolocaba.
const CSS = `
.stkh{--bg:#12141a;--panel:#1b1f28;--line:#2f3644;--txt:#eef1f6;--dim:#8b94a7;--acc:#4ea3ff;
  --ok:#3ddc97;--warn:#ffb454;
  background:var(--bg);color:var(--txt);
  height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.stkh *{box-sizing:border-box}

.stkh-top{flex:0 0 auto;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 14px}
.stkh-row1{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.stkh-h1{font-size:16px;font-weight:650;margin:0}
.stkh-sub{font-size:11.5px;color:var(--dim);margin:2px 0 0}
.stkh-tabs{display:flex;gap:4px;flex:0 0 auto}
.stkh-tabs a{font-size:12.5px;color:var(--dim);text-decoration:none;padding:6px 10px;border-radius:8px;
  border:1px solid var(--line);white-space:nowrap}
.stkh-tabs a[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:650}
.stkh-nav{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.stkh-nav button{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);font-size:15px;cursor:pointer;flex:0 0 auto}
.stkh-nav input[type=date]{flex:1 1 auto;min-width:0;height:34px;border-radius:8px;
  border:1px solid var(--line);background:var(--panel);color:var(--txt);padding:0 8px;font-size:13px;
  font-family:inherit;color-scheme:dark}
.stkh-hoy{padding:0 11px!important;width:auto!important;font-size:12.5px!important;font-weight:600}
.stkh-busca{position:relative;margin-bottom:8px}
.stkh-busca input{width:100%;height:36px;border-radius:9px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);padding:0 34px 0 12px;font-size:14.5px;font-family:inherit}
.stkh-busca input:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkh-x{position:absolute;right:3px;top:3px;width:30px;height:30px;border:0;background:none;
  color:var(--dim);font-size:17px;cursor:pointer}
.stkh-filtros{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.stkh-filtros::-webkit-scrollbar{display:none}
.stkh-f{flex:0 0 auto;padding:6px 11px;border-radius:999px;border:1px solid var(--line);
  background:var(--panel);color:var(--dim);font-size:12.5px;white-space:nowrap;cursor:pointer}
.stkh-f[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:600}

.stkh-scroll{flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}
.stkh-t{border-collapse:separate;border-spacing:0;width:100%;min-width:640px;font-size:13.5px}

/* cabecera: se pega arriba del contenedor de scroll */
.stkh-t thead th{position:sticky;top:0;z-index:20;background:#262c39;color:#cfd6e2;
  font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;
  padding:10px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line)}
.stkh-t thead th:first-child{left:0;z-index:30;text-align:left;min-width:170px}

/* primera columna: se pega a la izquierda */
.stkh-t tbody td:first-child{position:sticky;left:0;z-index:10;background:var(--bg);
  text-align:left;min-width:170px}
.stkh-t tbody td{padding:9px 10px;text-align:right;border-bottom:1px solid #20252f;
  font-variant-numeric:tabular-nums;white-space:nowrap}
.stkh-t tbody tr[data-sin="1"] td{color:#5d6577}
.stkh-sec td{background:#171b23!important;color:var(--dim);font-size:10.5px;font-weight:700;
  letter-spacing:.09em;text-transform:uppercase;text-align:left!important;padding:8px 10px;
  position:sticky;left:0;z-index:12}
.stkh-cons{font-weight:700;color:var(--txt)}
.stkh-ini{position:relative}
.stkh-ini-v{display:flex;align-items:center;justify-content:flex-end;gap:5px}
.stkh-badge{font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;
  padding:2px 5px;border-radius:5px;white-space:nowrap}
.stkh-badge[data-o="par"]{background:#1d2a3a;color:#7fa8d6}
.stkh-badge[data-o="manual"]{background:#3a2a1d;color:var(--warn)}
.stkh-reset{border:1px solid var(--line);border-radius:6px;background:none;color:var(--dim);
  font-size:9.5px;padding:2px 6px;cursor:pointer;font-family:inherit;white-space:nowrap;
  margin-top:3px}
.stkh-reset:disabled{opacity:.4;cursor:default}
.stkh-nota{padding:5px 6px!important;min-width:210px}
.stkh-nota textarea{width:100%;min-width:200px;min-height:34px;border-radius:8px;
  border:1px solid transparent;background:transparent;color:var(--warn);font-size:12px;
  font-family:inherit;line-height:1.35;padding:5px 7px;resize:vertical;display:block}
.stkh-nota textarea::placeholder{color:#404a5c}
.stkh-nota textarea:hover{border-color:var(--line)}
.stkh-nota textarea:focus{outline:none;border-color:var(--acc);background:#12151c;color:var(--txt)}
.stkh-guardado{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:60;
  background:#1d3a2c;border:1px solid #2a4a3c;color:#a9d8c2;font-size:12.5px;
  padding:8px 14px;border-radius:999px;pointer-events:none}
.stkh-msg{padding:56px 24px;text-align:center;color:var(--dim);font-size:14px;line-height:1.6}
.stkh-pie{padding:14px;color:#5d6577;font-size:11.5px;line-height:1.5}

.stkh-bar{flex:0 0 auto;background:var(--panel);border-top:1px solid var(--line);
  padding:10px 14px calc(10px + env(safe-area-inset-bottom))}
.stkh-barrow{display:flex;gap:8px;align-items:center;justify-content:space-between;
  font-size:12px;color:var(--dim)}
.stkh-barrow b{color:var(--txt)}
.stkh-acc{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
.stkh-acc button,.stkh-acc a{border:1px solid var(--line);border-radius:9px;background:var(--bg);
  color:var(--txt);font-size:12.5px;font-weight:600;padding:9px 12px;cursor:pointer;
  text-decoration:none;font-family:inherit}
.stkh-acc .pri{background:var(--acc);border-color:var(--acc);color:#08111c}
.stkh-acc button:disabled{opacity:.4}
.stkh-quien{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim)}
.stkh-quien input{height:32px;border-radius:8px;border:1px solid var(--line);background:var(--bg);
  color:var(--txt);padding:0 9px;font-size:13px;font-family:inherit;width:130px}

.stkh-onscreen{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;width:100%}

.stkh-print{display:none}
@media print{
  .stkh{height:auto!important;overflow:visible!important}
  .stkh-onscreen{display:none!important}
  .stkh-print{display:block!important;background:#fff;color:#000;
    font-family:Georgia,'Times New Roman',serif}
  .stkh-print *{box-sizing:border-box}
  .stkh-p-pagina{page-break-before:always}
  .stkh-p-pagina:first-child{page-break-before:auto}
  .stkh-p-cab{border-bottom:2.5px solid #000;padding-bottom:8px;margin-bottom:14px;
    display:flex;justify-content:space-between;align-items:flex-end}
  .stkh-p-cab h1{font-size:12px;margin:0 0 3px;font-weight:400;letter-spacing:.03em;
    text-transform:uppercase;color:#555;font-family:Arial,sans-serif}
  .stkh-p-cab h2{font-size:22px;margin:0;font-weight:700}
  .stkh-p-cab-r{text-align:right;font-size:11px;font-family:Arial,sans-serif;color:#333;
    line-height:1.7}
  .stkh-p-cab-r b{color:#000}
  .stkh-print table{width:100%;border-collapse:collapse;margin-bottom:6px;
    font-family:Arial,sans-serif}
  .stkh-print th,.stkh-print td{border-bottom:1px solid #ccc;padding:5px 6px;text-align:right}
  .stkh-print th:first-child,.stkh-print td:first-child{text-align:left}
  .stkh-print thead th{border-bottom:1.5px solid #000;font-size:9.5px;
    text-transform:uppercase;letter-spacing:.04em;color:#333;padding-bottom:6px}
  .stkh-p-tabla-zona td{font-size:13px;padding:7px 6px}
  .stkh-p-tabla-zona td:nth-child(2){font-weight:700;font-size:15px;min-width:60px}
  .stkh-p-tabla-zona tbody tr:nth-child(even){background:#fafafa}
  .stkh-p-tabla-resumen{font-size:9px}
  .stkh-p-sec td{background:#f0f0f0!important;font-weight:700;text-align:left!important;
    text-transform:uppercase;font-size:9.5px;letter-spacing:.03em;border-bottom:1px solid #ccc}
  .stkh-p-extra table{width:55%}
  .stkh-p-firma{margin-top:34px;display:flex;justify-content:space-between;
    font-family:Arial,sans-serif;font-size:10.5px}
  .stkh-p-firma div{width:40%;border-top:1px solid #000;padding-top:5px}
  @page{margin:12mm 10mm}
}
`

export default function HojaPage() {
  // La fecha NO se calcula en el primer render: el servidor va en UTC y el
  // navegador en Madrid, y esa diferencia rompe la hidratacion de React.
  const [fecha, setFecha] = useState<string | null>(null)
  const [d, setD] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('todo')
  const [busca, setBusca] = useState('')
  const [guardado, setGuardado] = useState(false)
  const [quien, setQuien] = useState('')

  useEffect(() => {
    setFecha(hoyOperativo())
    setQuien(localStorage.getItem('stk_quien') || '')
  }, [])

  const cargar = async (fch: string | null) => {
    if (!fch) return
    setCargando(true)
    setFallo(null)
    try {
      const url = fch === hoyOperativo() ? '/api/stock/resumen' : `/api/stock/resumen?fecha=${fch}`
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

  const [dConteo, setDConteo] = useState<DatosConteo | null>(null)

  const cargarConteo = async (fch: string | null) => {
    if (!fch) return
    try {
      const url = fch === hoyOperativo() ? '/api/stock/hoja' : `/api/stock/hoja?fecha=${fch}`
      const r = await fetch(url)
      const j = await r.json()
      if (r.ok) setDConteo(j)
    } catch {
      // el desglose por ubicacion es solo para la impresion: si falla, se
      // imprime sin esas columnas en vez de romper la pantalla principal
    }
  }

  useEffect(() => {
    if (fecha) {
      cargar(fecha)
      cargarConteo(fecha)
    }
  }, [fecha])

  const guardarNota = async (lineaId: number, texto: string) => {
    await fetch('/api/stock/resumen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineaId, nota: texto }),
    })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1600)
  }

  const [tocando, setTocando] = useState<number | null>(null)
  const tocarInicial = async (lineaId: number, accion: 'restablecer_inicial' | 'quitar_override', valor?: number) => {
    setTocando(lineaId)
    try {
      const quien = localStorage.getItem('stk_quien')
      const r = await fetch('/api/stock/resumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineaId, accion, quien, valor }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        throw new Error(j?.error || 'no se pudo actualizar')
      }
      await cargar(fecha)
    } catch (e: any) {
      alert('No se pudo actualizar el inicial: ' + e.message)
    } finally {
      setTocando(null)
    }
  }

  const fijarInicial = (lineaId: number, parActual: number) => {
    const txt = prompt('Stock inicial de hoy para esta línea:', f(parActual))
    if (txt === null) return
    const valor = Number(txt.replace(',', '.'))
    if (!Number.isFinite(valor) || valor < 0) {
      alert('Cantidad no válida')
      return
    }
    tocarInicial(lineaId, 'restablecer_inicial', valor)
  }

  const cambiarQuien = (v: string) => {
    setQuien(v)
    localStorage.setItem('stk_quien', v)
  }

  const mover = (dias: number) => {
    if (!fecha) return
    const x = new Date(fecha + 'T12:00:00')
    x.setDate(x.getDate() + dias)
    setFecha(x.toISOString().slice(0, 10))
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
    else if (filtro === 'nota') r = r.filter((x) => !!x.nota)
    else if (filtro !== 'todo') r = r.filter((x) => x.cat_codigo === filtro)
    return r
  }, [d, filtro, busca])

  const descargarCsv = () => {
    const cab = ['Producto', 'Categoria', 'Inicial', 'Entradas', 'Final', 'Consumo', 'Comentarios']
    const filasCsv = (d?.filas || []).map((x) =>
      [x.producto, x.categoria, x.inicial, x.entradas, x.final, x.consumo, (x.nota || '').replace(/[\r\n]+/g, ' ')]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';')
    )
    const csv = '\uFEFF' + [cab.join(';'), ...filasCsv].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `stock_${fecha || ''}.csv`
    a.click()
  }

  const conteoPorLinea = useMemo(() => {
    const m = new Map<number, ProductoConteo>()
    dConteo?.productos.forEach((p) => m.set(p.linea_id, p))
    return m
  }, [dConteo])

  const idPorCodigo = useMemo(() => {
    const m = new Map<string, number>()
    ;(dConteo?.ubicaciones || []).forEach((u) => m.set(u.codigo, u.id))
    return m
  }, [dConteo])

  const gruposImpresion = useMemo(() => {
    const def: { titulo: string; codigos: string[]; categorias?: string[] }[] = [
      { titulo: 'Bar interior + Office + Terraza', codigos: ['bar_interior', 'office_cocina', 'bar_terraza'] },
      { titulo: 'Rack eventos', codigos: ['rack'] },
      { titulo: 'Cava — vinos tintos', codigos: ['cava'], categorias: ['tintos'] },
      { titulo: 'Cava — blancos, rosados y cavas', codigos: ['cava'], categorias: ['blancos', 'rosados_cavas'] },
    ]
    return def
      .map((g) => ({ ...g, ids: g.codigos.map((c) => idPorCodigo.get(c)).filter((x): x is number => !!x) }))
      .filter((g) => g.ids.length > 0)
  }, [idPorCodigo])

  const celdaSumaZonas = (lineaId: number, ids: number[]) => {
    const pc = conteoPorLinea.get(lineaId)
    if (!pc) return ''
    const aplica = ids.filter((id) => pc.ubicaciones.includes(id))
    if (!aplica.length) return ''
    let suma = 0
    let alguno = false
    aplica.forEach((id) => {
      const v = pc.conteos[String(id)]
      if (v !== undefined) {
        suma += v
        alguno = true
      }
    })
    return alguno ? f(suma) : '—'
  }

  const sinContar = (d?.filas || []).filter((x) => !x.contado).length
  const consumoTotal = (d?.filas || [])
    .filter((x) => x.contado)
    .reduce((a, x) => a + (n(x.consumo) || 0), 0)
  let seccionActual: string | null | undefined = undefined

  if (!fecha) {
    return (
      <div className="stkh">
        <style>{CSS}</style>
        <p className="stkh-msg">Cargando…</p>
      </div>
    )
  }

  const esHoy = fecha === hoyOperativo()

  return (
    <div className="stkh">
      <style>{CSS}</style>

      <div className="stkh-onscreen">
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
          <nav className="stkh-tabs">
            <Link href="/stock">Contar</Link>
            <Link href="/stock/hoja" data-on="1">
              Hoja
            </Link>
            <Link href="/stock/pedido">Pedido</Link>
            <Link href="/stock/ajustes">Ajustes</Link>
          </nav>
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

      <div className="stkh-scroll">
        {fallo ? (
          <p className="stkh-msg">
            No se pudo cargar la hoja.
            <br />
            {fallo}
          </p>
        ) : cargando ? (
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
          <>
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
                    filtro === 'todo' && !busca && etiqueta !== seccionActual
                      ? ((seccionActual = etiqueta), etiqueta)
                      : null
                  const etiquetaOrigen = x.origen_inicial === 'manual' ? 'Fijado' : 'Par'
                  return (
                    <Fragment key={x.linea_id}>
                      {cab && (
                        <tr className="stkh-sec">
                          <td colSpan={6}>{cab}</td>
                        </tr>
                      )}
                      <tr data-sin={x.contado ? '0' : '1'}>
                        <td>{x.producto}</td>
                        <td className="stkh-ini">
                          <div className="stkh-ini-v">
                            {f(x.inicial)}
                            <span
                              className="stkh-badge"
                              data-o={x.origen_inicial}
                              title={
                                x.origen_inicial === 'manual'
                                  ? `Fijado a mano${x.par !== x.inicial ? ` (el par es ${f(x.par)})` : ''}`
                                  : 'Usa el par configurado en Ajustes'
                              }
                            >
                              {etiquetaOrigen}
                            </span>
                          </div>
                          {esHoy && (
                            <button
                              className="stkh-reset"
                              disabled={tocando === x.linea_id}
                              onClick={() =>
                                x.origen_inicial === 'manual'
                                  ? tocarInicial(x.linea_id, 'quitar_override')
                                  : fijarInicial(x.linea_id, n(x.par) || 0)
                              }
                            >
                              {x.origen_inicial === 'manual' ? 'Quitar (usar par)' : 'Fijar inicial…'}
                            </button>
                          )}
                        </td>
                        <td>{n(x.entradas) ? f(x.entradas) : '—'}</td>
                        <td>{x.contado ? f(x.final) : '—'}</td>
                        <td className={x.contado ? 'stkh-cons' : ''}>{x.contado ? f(x.consumo) : '—'}</td>
                        <td className="stkh-nota">
                          <textarea
                            rows={1}
                            defaultValue={x.nota || ''}
                            placeholder="Comentario…"
                            aria-label={`Comentario de ${x.producto}`}
                            onBlur={(e) => {
                              if ((x.nota || '') === e.target.value.trim()) return
                              x.nota = e.target.value.trim() || null
                              guardarNota(x.linea_id, e.target.value)
                            }}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <p className="stkh-pie">
              Inicial = el par configurado en Ajustes, salvo que lo fijes tú a mano para hoy.
              Consumo = inicial + entradas − final.
            </p>
          </>
        )}
      </div>

      {guardado && <div className="stkh-guardado">Comentario guardado</div>}

      <div className="stkh-bar">
        <div className="stkh-barrow">
          <span>
            Consumo del día: <b>{Math.round(consumoTotal * 100) / 100}</b> envases
          </span>
          {sinContar > 0 ? (
            <span style={{ color: 'var(--warn)' }}>Faltan {sinContar}</span>
          ) : (
            <span style={{ color: 'var(--ok)' }}>Todo contado</span>
          )}
        </div>
        <div className="stkh-acc">
          <Link className="pri" href="/stock/pedido">
            Ir al pedido
          </Link>
          <button onClick={descargarCsv} disabled={!d?.jornada}>
            Descargar CSV
          </button>
          <label className="stkh-quien">
            Control:
            <input
              value={quien}
              onChange={(e) => cambiarQuien(e.target.value)}
              placeholder="Iniciales…"
            />
          </label>
          <button onClick={() => window.print()} disabled={!d?.jornada}>
            Imprimir
          </button>
        </div>
      </div>
      </div>

      <div className="stkh-print">
        {gruposImpresion.map((g) => {
          const productosGrupo = (d?.filas || []).filter((x) => {
            const pc = conteoPorLinea.get(x.linea_id)
            if (!pc) return false
            if (!g.ids.some((id) => pc.ubicaciones.includes(id))) return false
            if (g.categorias && !g.categorias.includes(x.cat_codigo)) return false
            return true
          })
          if (!productosGrupo.length) return null
          let sec: string | null | undefined = undefined
          return (
            <div className="stkh-p-pagina" key={g.titulo}>
              <div className="stkh-p-cab">
                <div>
                  <h1>Novotel &amp; Ibis Madrid City Las Ventas</h1>
                  <h2>{g.titulo}</h2>
                </div>
                <div className="stkh-p-cab-r">
                  <div>Fecha: <b>{fecha}</b></div>
                  <div>Control: <b>{quien || '__________'}</b></div>
                </div>
              </div>
              <table className="stkh-p-tabla-zona">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Par</th>
                    <th>Conteo</th>
                  </tr>
                </thead>
                <tbody>
                  {productosGrupo.map((x) => {
                    const etiqueta = [x.categoria, x.seccion].filter(Boolean).join(' · ')
                    const cab = etiqueta !== sec ? ((sec = etiqueta), etiqueta) : null
                    return (
                      <Fragment key={x.linea_id}>
                        {cab && (
                          <tr className="stkh-p-sec">
                            <td colSpan={3}>{cab}</td>
                          </tr>
                        )}
                        <tr>
                          <td>{x.producto}</td>
                          <td>{f(x.par)}</td>
                          <td>{celdaSumaZonas(x.linea_id, g.ids)}</td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              <div className="stkh-p-firma">
                <div>Control</div>
                <div>Firma</div>
              </div>
            </div>
          )
        })}

        <div className="stkh-p-pagina">
          <div className="stkh-p-cab">
            <div>
              <h1>Novotel &amp; Ibis Madrid City Las Ventas</h1>
              <h2>Resumen y cotejo TPV{d?.jornada?.perfil ? ` · par ${d.jornada.perfil}` : ''}</h2>
            </div>
            <div className="stkh-p-cab-r">
              <div>Fecha: <b>{fecha}</b></div>
              <div>Control: <b>{quien || '__________'}</b></div>
            </div>
          </div>
          <table className="stkh-p-tabla-resumen">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Fijo</th>
                <th>Inicial</th>
                <th>Entradas</th>
                <th>Final</th>
                <th>Consumo</th>
                <th>Ventas</th>
                <th>Descuadre</th>
                <th style={{ textAlign: 'left' }}>Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let sec: string | null | undefined = undefined
                return (d?.filas || []).map((x) => {
                  const etiqueta = [x.categoria, x.seccion].filter(Boolean).join(' · ')
                  const cab = etiqueta !== sec ? ((sec = etiqueta), etiqueta) : null
                  return (
                    <Fragment key={x.linea_id}>
                      {cab && (
                        <tr className="stkh-p-sec">
                          <td colSpan={9}>{cab}</td>
                        </tr>
                      )}
                      <tr>
                        <td>{x.producto}</td>
                        <td>{f(x.par)}</td>
                        <td>{f(x.inicial)}</td>
                        <td>{n(x.entradas) ? f(x.entradas) : '—'}</td>
                        <td>{x.contado ? f(x.final) : ''}</td>
                        <td>{x.contado ? f(x.consumo) : ''}</td>
                        <td></td>
                        <td></td>
                        <td style={{ textAlign: 'left' }}>{x.nota || ''}</td>
                      </tr>
                    </Fragment>
                  )
                })
              })()}
            </tbody>
          </table>

          <div className="stkh-p-extra">
            <h2 style={{ fontSize: 12, fontFamily: 'Arial,sans-serif', margin: '14px 0 6px' }}>
              Reposición extra del día
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td>&nbsp;</td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="stkh-p-firma">
            <div>Control</div>
            <div>Firma</div>
          </div>
        </div>
      </div>
    </div>
  )
}

