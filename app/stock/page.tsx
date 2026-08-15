'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type Ubicacion = { id: number; codigo: string; nombre: string; almacen: boolean }
type Mov = {
  id: number
  producto: string
  producto_id: number
  origen: string
  destino: string
  entrada: boolean
  unidades: string
  quien: string | null
  nota: string | null
  hora: string
}
type Producto = {
  linea_id: number
  producto_id: number
  nombre: string
  categoria: string
  cat_codigo: string
  seccion: string | null
  paso: string
  par: string
  nota: string | null
  movs: string
  ubicaciones: number[] | null
  conteos: Record<string, string>
  heredados: Record<string, string>
  objetivos: Record<string, string>
}
type Hoja = {
  jornada: { id: number; fecha: string; estado: string; perfil: string | null }
  ubicaciones: Ubicacion[]
  productos: Producto[]
}
type Estado = 'idle' | 'guardando' | 'guardado' | 'error'

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const CSS = `
.stkc{--bg:#12141a;--panel:#1b1f28;--panel2:#232834;--line:#2f3644;--txt:#eef1f6;--dim:#8b94a7;
  --acc:#4ea3ff;--ok:#3ddc97;--warn:#ffb454;--bad:#ff6b6b;
  background:var(--bg);color:var(--txt);min-height:100vh;padding-bottom:92px;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
.stkc *{box-sizing:border-box}
.stkc-top{position:sticky;top:0;z-index:20;background:rgba(18,20,26,.97);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line);padding:12px 16px}
.stkc-toprow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.stkc-zona{font-size:18px;font-weight:650;letter-spacing:-.01em;margin:0}
.stkc-sub{font-size:12px;color:var(--dim);margin:2px 0 0}
.stkc-link{font-size:13px;color:var(--acc);text-decoration:none;background:none;border:0;padding:6px;cursor:pointer}
.stkc-busca{position:relative;margin-top:10px}
.stkc-busca input{width:100%;height:38px;border-radius:9px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);padding:0 34px 0 12px;font-size:14.5px;font-family:inherit}
.stkc-busca input:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkc-x{position:absolute;right:4px;top:4px;width:30px;height:30px;border:0;background:none;
  color:var(--dim);font-size:17px;cursor:pointer}
.stkc-notabtn{background:none;border:0;color:var(--dim);font-size:11px;padding:6px 4px 0;
  cursor:pointer;font-family:inherit}
.stkc-notabtn[data-has="1"]{color:var(--warn)}
.stkc-nota{width:calc(100% - 32px);margin:6px 16px 10px;min-height:52px;border-radius:10px;
  border:1px solid var(--line);background:#12151c;color:var(--txt);padding:9px 10px;font-size:14px;
  font-family:inherit;resize:vertical}
.stkc-nota:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkc-mbtn{width:100%;text-align:left;background:var(--panel);border:1px solid var(--line);
  border-radius:12px;padding:12px 14px;color:var(--txt);font-size:14px;font-weight:600;
  cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:space-between}
.stkc-mbtn small{color:var(--dim);font-size:11.5px;font-weight:400}
.stkc-mv{margin:0 14px 12px;background:var(--panel);border:1px solid var(--line);border-radius:14px;
  padding:12px}
.stkc-mv h3{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:var(--dim);margin:0 0 10px}
.stkc-mv input,.stkc-mv select{width:100%;height:40px;border-radius:10px;border:1px solid var(--line);
  background:#12151c;color:var(--txt);padding:0 10px;font-size:14.5px;font-family:inherit;
  margin-bottom:8px}
.stkc-mv input:focus,.stkc-mv select:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkc-mrow{display:flex;gap:8px}
.stkc-mrow > *{flex:1 1 0;min-width:0}
.stkc-mcant{flex:0 0 78px!important;text-align:center;font-weight:650}
.stkc-mv .ok{width:100%;height:44px;border-radius:11px;border:0;background:var(--acc);color:#08111c;
  font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:2px}
.stkc-mv .ok:disabled{opacity:.4}
.stkc-msug{position:relative}
.stkc-msug .lista{position:absolute;top:44px;left:0;right:0;z-index:60;background:var(--panel2);
  border:1px solid var(--line);border-radius:10px;max-height:200px;overflow-y:auto;
  box-shadow:0 10px 30px rgba(0,0,0,.5)}
.stkc-msug .lista button{display:block;width:100%;text-align:left;background:none;border:0;
  border-bottom:1px solid #2b3140;color:var(--txt);font-size:14px;padding:10px 12px;cursor:pointer;
  font-family:inherit}
.stkc-ml{font-size:12.5px;color:#c8d0dc;padding:7px 0;border-bottom:1px solid #242a36;
  display:flex;align-items:center;gap:8px;line-height:1.4}
.stkc-ml b{color:var(--txt)}
.stkc-ml em{font-style:normal;color:var(--ok)}
.stkc-ml button{margin-left:auto;background:none;border:0;color:var(--dim);font-size:15px;
  cursor:pointer;padding:2px 6px;flex:0 0 auto}
.stkc-sec{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);
  padding:20px 16px 8px;position:sticky;top:124px;background:var(--bg);z-index:10}
.stkc-fila{display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid #20252f}
.stkc-fila[data-done="1"]{background:#161d1a}
.stkc-nom{flex:1 1 auto;min-width:0;font-size:15px;line-height:1.25}
.stkc-nom small{display:block;color:var(--dim);font-size:11px;margin-top:2px}
.stkc-ctrl{display:flex;align-items:center;gap:5px;flex:0 0 auto}
.stkc-btn{width:38px;height:42px;border-radius:9px;border:1px solid var(--line);background:#2b3140;
  color:var(--txt);font-size:20px;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent}
.stkc-btn:active{background:var(--acc);color:#08111c}
.stkc-in{width:66px;height:42px;border-radius:9px;border:1px solid var(--line);background:#12151c;
  color:var(--txt);text-align:center;font-size:17px;font-weight:650;font-variant-numeric:tabular-nums}
.stkc-in:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkc-in[data-heredado="1"]{color:#6b7280;border-color:#3a4152;background:#181c24;font-style:italic}
.stkc-dot{width:7px;height:7px;border-radius:50%;background:transparent;flex:0 0 auto}
.stkc-dot[data-s="guardando"]{background:var(--warn)}
.stkc-dot[data-s="guardado"]{background:var(--ok)}
.stkc-dot[data-s="error"]{background:var(--bad)}
.stkc-bar{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(27,31,40,.97);
  backdrop-filter:blur(8px);border-top:1px solid var(--line);
  padding:11px 16px calc(11px + env(safe-area-inset-bottom))}
.stkc-prog{height:4px;border-radius:99px;background:var(--panel2);overflow:hidden;margin-bottom:8px}
.stkc-prog i{display:block;height:100%;background:var(--ok);transition:width .25s}
.stkc-barrow{display:flex;align-items:center;justify-content:space-between;font-size:13px}
.stkc-msg{padding:60px 24px;text-align:center;color:var(--dim);font-size:14px;line-height:1.6}
.stkc-wrap{padding:20px 16px 0;max-width:520px;margin:0 auto}
.stkc-wrap h2{font-size:20px;margin:0 0 4px}
.stkc-wrap p{color:var(--dim);font-size:14px;margin:0 0 22px;line-height:1.5}
.stkc-zbtn{display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;
  background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:10px;
  color:var(--txt);font-size:16px;font-weight:600;cursor:pointer}
.stkc-zbtn b{display:block;font-size:12px;font-weight:500;color:var(--dim);margin-top:3px}
.stkc-zbtn[data-full="1"]{border-color:#2a4a3c}
.stkc-pill{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums;white-space:nowrap}
.stkc-pill[data-full="1"]{color:var(--ok)}
.stkc-gate input{width:100%;height:48px;border-radius:12px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);padding:0 14px;font-size:16px;font-family:inherit}
.stkc-gate button{width:100%;height:48px;margin-top:12px;border-radius:12px;border:0;background:var(--acc);
  color:#08111c;font-size:15px;font-weight:650;cursor:pointer}
.stkc-gate button:disabled{opacity:.4}
@media (prefers-reduced-motion:reduce){.stkc *{transition:none!important}}
`

export default function ConteoPage() {
  const [hoja, setHoja] = useState<Hoja | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [quien, setQuien] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')
  const [zona, setZona] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [nota, setNota] = useState<number | null>(null)
  const [movs, setMovs] = useState<Mov[]>([])
  const [verMov, setVerMov] = useState(false)
  const [mProd, setMProd] = useState('')
  const [mProdId, setMProdId] = useState<number | null>(null)
  const [mOrigen, setMOrigen] = useState<number | null>(null)
  const [mDestino, setMDestino] = useState<number | null>(null)
  const [mCant, setMCant] = useState('1')
  const [mSug, setMSug] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [estados, setEstados] = useState<Record<number, Estado>>({})
  const timers = useRef<Record<string, any>>({})

  useEffect(() => setQuien(localStorage.getItem('stk_quien')), [])

  useEffect(() => {
    fetch('/api/stock/hoja')
      .then(async (r) => {
        const t = await r.text()
        let j: any
        try {
          j = JSON.parse(t)
        } catch {
          throw new Error(t.slice(0, 200) || 'respuesta vacía del servidor')
        }
        if (!r.ok) throw new Error(j.detalle || j.error || 'no se pudo cargar')
        return j as Hoja
      })
      .then((h) => {
        setHoja(h)
        const v: Record<string, string> = {}
        h.productos?.forEach((p) =>
          Object.entries(p.conteos || {}).forEach(([ub, n]) => {
            v[`${p.linea_id}:${ub}`] = String(Number(n))
          })
        )
        setValores(v)
      })
      .catch((e) => setFallo(e.message))
  }, [])

  const guardar = useCallback(
    (lineaId: number, ubicacionId: number, valor: string) => {
      const key = `${lineaId}:${ubicacionId}`
      clearTimeout(timers.current[key])
      timers.current[key] = setTimeout(async () => {
        const unidades = valor === '' ? 0 : Number(valor.replace(',', '.'))
        if (!Number.isFinite(unidades) || unidades < 0) {
          setEstados((s) => ({ ...s, [lineaId]: 'error' }))
          return
        }
        setEstados((s) => ({ ...s, [lineaId]: 'guardando' }))
        try {
          const r = await fetch('/api/stock/conteo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineaId, ubicacionId, unidades, quien }),
          })
          if (!r.ok) throw new Error()
          setEstados((s) => ({ ...s, [lineaId]: 'guardado' }))
        } catch {
          setEstados((s) => ({ ...s, [lineaId]: 'error' }))
        }
      }, 550)
    },
    [quien]
  )

  const guardarNota = useCallback(async (lineaId: number, texto: string) => {
    setEstados((s) => ({ ...s, [lineaId]: 'guardando' }))
    try {
      const r = await fetch('/api/stock/conteo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineaId, nota: texto }),
      })
      if (!r.ok) throw new Error()
      setEstados((s) => ({ ...s, [lineaId]: 'guardado' }))
    } catch {
      setEstados((s) => ({ ...s, [lineaId]: 'error' }))
    }
  }, [])

  const cargarMovs = useCallback(async () => {
    try {
      const r = await fetch('/api/stock/movimientos')
      if (r.ok) setMovs(await r.json())
    } catch {
      /* sin movimientos */
    }
  }, [])

  useEffect(() => {
    cargarMovs()
  }, [cargarMovs])

  const cambiar = (lineaId: number, ubicacionId: number, valor: string) => {
    setValores((v) => ({ ...v, [`${lineaId}:${ubicacionId}`]: valor }))
    guardar(lineaId, ubicacionId, valor)
  }

  const paso = (lineaId: number, ubicacionId: number, delta: number, step: number, base?: string) => {
    const key = `${lineaId}:${ubicacionId}`
    const actual = Number((valores[key] ?? base ?? '0').replace(',', '.')) || 0
    cambiar(lineaId, ubicacionId, String(Math.max(0, Math.round((actual + delta * step) * 100) / 100)))
  }

  // referencias que viven en cada zona, en orden de categoría y sección
  const porZona = useMemo(() => {
    const m = new Map<number, Producto[]>()
    hoja?.productos?.forEach((p) =>
      (p.ubicaciones || []).forEach((u) => {
        if (!m.has(u)) m.set(u, [])
        m.get(u)!.push(p)
      })
    )
    return m
  }, [hoja])

  const hechas = useCallback(
    (uid: number) =>
      (porZona.get(uid) || []).filter(
        (p) => valores[`${p.linea_id}:${uid}`] !== undefined || p.heredados?.[String(uid)] !== undefined
      ).length,
    [porZona, valores]
  )

  if (!quien) {
    return (
      <div className="stkc">
        <style>{CSS}</style>
        <div className="stkc-wrap stkc-gate" style={{ paddingTop: 70 }}>
          <h2>Conteo de stock</h2>
          <p>¿Quién hace el control esta noche? Queda anotado en cada conteo.</p>
          <input value={borrador} onChange={(e) => setBorrador(e.target.value)} placeholder="Nombre y apellido" />
          <button
            disabled={borrador.trim().length < 3}
            onClick={() => {
              localStorage.setItem('stk_quien', borrador.trim())
              setQuien(borrador.trim())
            }}
          >
            Empezar
          </button>
        </div>
      </div>
    )
  }

  if (fallo)
    return (
      <div className="stkc">
        <style>{CSS}</style>
        <p className="stkc-msg">No se pudo cargar la hoja.<br />{fallo}</p>
      </div>
    )

  if (!hoja)
    return (
      <div className="stkc">
        <style>{CSS}</style>
        <p className="stkc-msg">Cargando la hoja de hoy…</p>
      </div>
    )

  // ---------- elegir zona ----------
  if (zona === null) {
    return (
      <div className="stkc">
        <style>{CSS}</style>
        <div className="stkc-wrap" style={{ paddingTop: 28 }}>
          <h2>¿Dónde estás contando?</h2>
          <p>
            Jornada {hoja.jornada.fecha}
            {hoja.jornada.perfil ? ` · par ${hoja.jornada.perfil}` : ''} · {quien}
          </p>
          {hoja.ubicaciones.map((u) => {
            const total = (porZona.get(u.id) || []).length
            const h = hechas(u.id)
            if (!total) return null
            return (
              <button key={u.id} className="stkc-zbtn" data-full={h === total ? '1' : '0'} onClick={() => setZona(u.id)}>
                <span>
                  {u.nombre}
                  <b>{total} referencias</b>
                </span>
                <span className="stkc-pill" data-full={h === total ? '1' : '0'}>
                  {h === total ? 'completa' : `${h}/${total}`}
                </span>
              </button>
            )
          })}
          <button className="stkc-mbtn" style={{ marginTop: 14 }} onClick={() => setVerMov(!verMov)}>
            <span>
              Reposición y traspasos
              <br />
              <small>lo que baja del almacén o se mueve entre zonas</small>
            </span>
            <span style={{ color: 'var(--acc)' }}>{movs.length || ''} {verMov ? '▲' : '▼'}</span>
          </button>

          {verMov && (
            <div className="stkc-mv" style={{ margin: '10px 0 0' }}>
              <h3>Registrar movimiento</h3>
              <div className="stkc-msug">
                <input
                  value={mProd}
                  placeholder="Producto…"
                  autoComplete="off"
                  onChange={(e) => {
                    setMProd(e.target.value)
                    setMProdId(null)
                    setMSug(true)
                  }}
                />
                {mSug && mProd.trim().length >= 2 && !mProdId && (
                  <div className="lista">
                    {(hoja?.productos || [])
                      .filter((x) => sinTildes(x.nombre).includes(sinTildes(mProd.trim())))
                      .slice(0, 8)
                      .map((x) => (
                        <button
                          key={x.linea_id}
                          onClick={() => {
                            setMProd(x.nombre)
                            setMProdId(x.producto_id)
                            setMSug(false)
                          }}
                        >
                          {x.nombre}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="stkc-mrow">
                <select
                  value={mOrigen ?? ''}
                  onChange={(e) => setMOrigen(Number(e.target.value) || null)}
                  aria-label="Origen"
                >
                  <option value="">Desde…</option>
                  {(hoja?.ubicaciones || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={mDestino ?? ''}
                  onChange={(e) => setMDestino(Number(e.target.value) || null)}
                  aria-label="Destino"
                >
                  <option value="">Hasta…</option>
                  {(hoja?.ubicaciones || [])
                    .filter((u) => !u.almacen)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                </select>
                <input
                  className="stkc-mcant"
                  inputMode="decimal"
                  value={mCant}
                  onChange={(e) => setMCant(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Cantidad"
                />
              </div>
              <button
                className="ok"
                disabled={!mProdId || !mOrigen || !mDestino || mOrigen === mDestino}
                onClick={async () => {
                  await fetch('/api/stock/movimientos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      productoId: mProdId,
                      origenId: mOrigen,
                      destinoId: mDestino,
                      unidades: mCant,
                      quien,
                    }),
                  })
                  setMProd('')
                  setMProdId(null)
                  setMCant('1')
                  await cargarMovs()
                }}
              >
                Registrar
              </button>

              {movs.map((m) => (
                <div className="stkc-ml" key={m.id}>
                  <span>
                    {m.hora} · <b>{m.unidades}</b> {m.producto}
                    <br />
                    {m.origen} → {m.destino} {m.entrada && <em>entrada</em>}
                  </span>
                  <button
                    aria-label="Borrar movimiento"
                    onClick={async () => {
                      await fetch('/api/stock/movimientos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accion: 'borrar', id: m.id }),
                      })
                      await cargarMovs()
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {movs.length === 0 && (
                <div className="stkc-ml" style={{ color: 'var(--dim)', borderBottom: 0 }}>
                  Nada registrado hoy.
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 22, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Link className="stkc-link" href="/stock/hoja">
              Ver la hoja del día
            </Link>
            <Link className="stkc-link" href="/stock/pedido">
              Ir al pedido
            </Link>
            <Link className="stkc-link" href="/stock/ajustes">
              Ajustes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ---------- contar una zona ----------
  const ub = hoja.ubicaciones.find((u) => u.id === zona)!
  const todas = porZona.get(zona) || []
  const filas = busca.trim()
    ? todas.filter((p) => sinTildes(p.nombre).includes(sinTildes(busca.trim())))
    : todas
  const total = todas.length
  const h = hechas(zona)
  let seccionActual: string | null | undefined = undefined

  return (
    <div className="stkc">
      <style>{CSS}</style>

      <div className="stkc-top">
        <div className="stkc-toprow">
          <div>
            <h1 className="stkc-zona">{ub.nombre}</h1>
            <p className="stkc-sub">
              {hoja.jornada.fecha} · {quien}
            </p>
          </div>
          <button className="stkc-link" onClick={() => setZona(null)}>
            Cambiar zona
          </button>
        </div>
        <div className="stkc-busca">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar producto en esta zona…"
            autoComplete="off"
          />
          {busca && (
            <button className="stkc-x" onClick={() => setBusca('')} aria-label="Limpiar">
              ×
            </button>
          )}
        </div>
      </div>

      {filas.map((p) => {
        const etiqueta = [p.categoria, p.seccion].filter(Boolean).join(' · ')
        const cabecera =
          !busca && etiqueta !== seccionActual ? ((seccionActual = etiqueta), etiqueta) : null
        const key = `${p.linea_id}:${zona}`
        const step = Number(p.paso) || 1
        const heredado = p.heredados?.[String(zona)]
        const objetivo = p.objetivos?.[String(zona)]
        const esReal = valores[key] !== undefined
        const puesto = esReal || heredado !== undefined
        return (
          <div key={p.linea_id}>
            {cabecera && <div className="stkc-sec">{cabecera}</div>}
            <div className="stkc-fila" data-done={puesto ? '1' : '0'}>
              <span className="stkc-nom">
                {p.nombre}
                {step < 1 && <small>fracciones: 0,5 · 0,25 · 0,1</small>}
                {!esReal && heredado !== undefined && (
                  <small style={{ color: 'var(--dim)' }}>heredado de otro día — toca para confirmar</small>
                )}
                {objetivo !== undefined && Number(objetivo) > 0 && (
                  <small style={{ color: 'var(--dim)' }}>debería haber aquí: {objetivo.replace('.', ',')}</small>
                )}
              </span>
              <span className="stkc-ctrl">
                <button
                  className="stkc-btn"
                  aria-label="Restar"
                  onClick={() => paso(p.linea_id, zona, -1, step, heredado)}
                >
                  −
                </button>
                <input
                  className="stkc-in"
                  data-heredado={!esReal && heredado !== undefined ? '1' : '0'}
                  inputMode="decimal"
                  placeholder="0"
                  value={valores[key] ?? heredado ?? ''}
                  onChange={(e) => cambiar(p.linea_id, zona, e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  className="stkc-btn"
                  aria-label="Sumar"
                  onClick={() => paso(p.linea_id, zona, 1, step, heredado)}
                >
                  +
                </button>
                <i className="stkc-dot" data-s={estados[p.linea_id] || 'idle'} />
              </span>
            </div>
            <div style={{ padding: '0 16px' }}>
              <button
                className="stkc-notabtn"
                data-has={p.nota ? '1' : '0'}
                onClick={() => setNota(nota === p.linea_id ? null : p.linea_id)}
              >
                {p.nota ? `Comentario: ${p.nota.slice(0, 44)}${p.nota.length > 44 ? '…' : ''}` : '+ comentario'}
              </button>
            </div>
            {nota === p.linea_id && (
              <textarea
                className="stkc-nota"
                defaultValue={p.nota || ''}
                autoFocus
                placeholder="Rotura, invitación, botella prestada, descuadre…"
                onBlur={(e) => {
                  p.nota = e.target.value.trim() || null
                  guardarNota(p.linea_id, e.target.value)
                  setNota(null)
                }}
              />
            )}
          </div>
        )
      })}

      {busca && filas.length === 0 && (
        <p className="stkc-msg">Ningún producto de esta zona coincide con «{busca}».</p>
      )}

      <div className="stkc-bar">
        <div className="stkc-prog">
          <i style={{ width: `${total ? (h / total) * 100 : 0}%` }} />
        </div>
        <div className="stkc-barrow">
          <span>
            {h} de {total} contadas
          </span>
          {h === total ? (
            <button className="stkc-link" onClick={() => setZona(null)}>
              Zona completa · siguiente →
            </button>
          ) : (
            <span style={{ color: 'var(--dim)' }}>Faltan {total - h}</span>
          )}
        </div>
      </div>
    </div>
  )
}
