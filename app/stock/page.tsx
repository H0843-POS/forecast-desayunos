'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Ubicacion = { id: number; codigo: string; nombre: string }
type Producto = {
  linea_id: number
  producto_id: number
  nombre: string
  seccion: string | null
  par: string
  nota: string | null
  ubicaciones: number[]
  conteos: Record<string, string>
}
type Categoria = {
  codigo: string
  nombre: string
  orden: number
  paso: string
  productos: Producto[]
}
type Hoja = {
  jornada: { id: number; fecha: string; estado: string; perfil: string | null }
  ubicaciones: Ubicacion[]
  categorias: Categoria[]
}

type Estado = 'idle' | 'guardando' | 'guardado' | 'error'

const CSS = `
.stkc{--bg:#12141a;--panel:#1b1f28;--panel2:#232834;--line:#2f3644;--txt:#eef1f6;--dim:#8b94a7;--acc:#4ea3ff;--ok:#3ddc97;--warn:#ffb454;--bad:#ff6b6b;
  background:var(--bg);color:var(--txt);min-height:100vh;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  padding-bottom:96px;-webkit-text-size-adjust:100%}
.stkc *{box-sizing:border-box}
.stkc-top{position:sticky;top:0;z-index:20;background:rgba(18,20,26,.97);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.stkc-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 16px 10px}
.stkc-h1{font-size:17px;font-weight:650;letter-spacing:-.01em;margin:0}
.stkc-sub{font-size:12px;color:var(--dim);margin:2px 0 0}
.stkc-quien{font-size:12px;color:var(--acc);background:none;border:0;padding:4px;cursor:pointer}
.stkc-tabs{display:flex;gap:8px;overflow-x:auto;padding:0 16px 12px;scrollbar-width:none}
.stkc-tabs::-webkit-scrollbar{display:none}
.stkc-tab{flex:0 0 auto;padding:9px 14px;border-radius:999px;border:1px solid var(--line);
  background:var(--panel);color:var(--dim);font-size:13px;font-weight:550;white-space:nowrap;cursor:pointer}
.stkc-tab[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c}
.stkc-tab small{opacity:.75;margin-left:6px;font-size:11px}
.stkc-sec{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--dim);padding:22px 16px 8px}
.stkc-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;
  margin:0 12px 10px;padding:12px 12px 10px}
.stkc-card[data-done="1"]{border-color:#2a4a3c}
.stkc-name{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.stkc-name b{font-size:15px;font-weight:600;line-height:1.25}
.stkc-par{font-size:11px;color:var(--dim);white-space:nowrap}
.stkc-par i{font-style:normal;color:var(--txt);font-weight:600}
.stkc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}
.stkc-ub{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:7px 8px 8px}
.stkc-ub label{display:block;font-size:10px;color:var(--dim);text-transform:uppercase;
  letter-spacing:.05em;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stkc-row{display:flex;align-items:center;gap:4px}
.stkc-btn{width:30px;height:34px;flex:0 0 auto;border-radius:8px;border:1px solid var(--line);
  background:#2b3140;color:var(--txt);font-size:17px;line-height:1;cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.stkc-btn:active{background:var(--acc);color:#08111c}
.stkc-in{width:100%;min-width:0;height:34px;border-radius:8px;border:1px solid var(--line);
  background:#12151c;color:var(--txt);text-align:center;font-size:16px;font-weight:600;
  font-variant-numeric:tabular-nums;padding:0 2px}
.stkc-in:focus{outline:2px solid var(--acc);outline-offset:-1px;border-color:var(--acc)}
.stkc-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px}
.stkc-tot{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}
.stkc-tot b{color:var(--txt);font-size:14px}
.stkc-tot[data-diff="1"] b{color:var(--warn)}
.stkc-notabtn{background:none;border:0;color:var(--dim);font-size:12px;padding:4px;cursor:pointer}
.stkc-notabtn[data-has="1"]{color:var(--warn)}
.stkc-nota{width:100%;margin-top:8px;min-height:56px;border-radius:10px;border:1px solid var(--line);
  background:#12151c;color:var(--txt);padding:9px 10px;font-size:14px;font-family:inherit;resize:vertical}
.stkc-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:transparent}
.stkc-dot[data-s="guardando"]{background:var(--warn)}
.stkc-dot[data-s="guardado"]{background:var(--ok)}
.stkc-dot[data-s="error"]{background:var(--bad)}
.stkc-bar{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(27,31,40,.97);
  backdrop-filter:blur(8px);border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom))}
.stkc-prog{height:4px;border-radius:99px;background:var(--panel2);overflow:hidden;margin-bottom:8px}
.stkc-prog i{display:block;height:100%;background:var(--ok);transition:width .25s}
.stkc-barrow{display:flex;align-items:center;justify-content:space-between;font-size:13px}
.stkc-msg{padding:60px 24px;text-align:center;color:var(--dim);font-size:14px}
.stkc-gate{padding:80px 24px;max-width:420px;margin:0 auto}
.stkc-gate h2{font-size:20px;margin:0 0 6px}
.stkc-gate p{color:var(--dim);font-size:14px;margin:0 0 20px;line-height:1.5}
.stkc-gate input{width:100%;height:48px;border-radius:12px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);padding:0 14px;font-size:16px;font-family:inherit}
.stkc-gate button{width:100%;height:48px;margin-top:12px;border-radius:12px;border:0;
  background:var(--acc);color:#08111c;font-size:15px;font-weight:650;cursor:pointer}
.stkc-gate button:disabled{opacity:.4}
@media (prefers-reduced-motion:reduce){.stkc *{transition:none!important}}
`

export default function ConteoPage() {
  const [hoja, setHoja] = useState<Hoja | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [quien, setQuien] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [estados, setEstados] = useState<Record<number, Estado>>({})
  const [notaAbierta, setNotaAbierta] = useState<number | null>(null)
  const timers = useRef<Record<string, any>>({})

  useEffect(() => {
    setQuien(localStorage.getItem('stk_quien'))
  }, [])

  useEffect(() => {
    fetch('/api/stock/hoja')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'No se pudo cargar la hoja')
        return j as Hoja
      })
      .then((h) => {
        setHoja(h)
        setCat((c) => c ?? h.categorias?.[0]?.codigo ?? null)
        const v: Record<string, string> = {}
        h.categorias?.forEach((c) =>
          c.productos?.forEach((p) =>
            Object.entries(p.conteos || {}).forEach(([ub, n]) => {
              v[`${p.linea_id}:${ub}`] = String(Number(n))
            })
          )
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

  const guardarNota = useCallback(async (lineaId: number, nota: string) => {
    setEstados((s) => ({ ...s, [lineaId]: 'guardando' }))
    try {
      const r = await fetch('/api/stock/conteo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineaId, nota }),
      })
      if (!r.ok) throw new Error()
      setEstados((s) => ({ ...s, [lineaId]: 'guardado' }))
    } catch {
      setEstados((s) => ({ ...s, [lineaId]: 'error' }))
    }
  }, [])

  const cambiar = (lineaId: number, ubicacionId: number, valor: string) => {
    setValores((v) => ({ ...v, [`${lineaId}:${ubicacionId}`]: valor }))
    guardar(lineaId, ubicacionId, valor)
  }

  const paso = (lineaId: number, ubicacionId: number, delta: number, step: number) => {
    const key = `${lineaId}:${ubicacionId}`
    const actual = Number((valores[key] || '0').replace(',', '.')) || 0
    const siguiente = Math.max(0, Math.round((actual + delta * step) * 100) / 100)
    cambiar(lineaId, ubicacionId, String(siguiente))
  }

  const categoria = useMemo(
    () => hoja?.categorias?.find((c) => c.codigo === cat) || null,
    [hoja, cat]
  )

  const contados = useCallback(
    (c: Categoria) =>
      c.productos.filter((p) =>
        p.ubicaciones?.some((u) => valores[`${p.linea_id}:${u}`] !== undefined)
      ).length,
    [valores]
  )

  // --- quién cuenta ---
  if (!quien) {
    return (
      <div className="stkc">
        <style>{CSS}</style>
        <div className="stkc-gate">
          <h2>Conteo de stock</h2>
          <p>Antes de empezar, ¿quién hace el control esta noche? Queda anotado en cada conteo.</p>
          <input
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            placeholder="Nombre y apellido"
            autoComplete="name"
          />
          <button
            disabled={borrador.trim().length < 3}
            onClick={() => {
              const n = borrador.trim()
              localStorage.setItem('stk_quien', n)
              setQuien(n)
            }}
          >
            Empezar
          </button>
        </div>
      </div>
    )
  }

  if (fallo) {
    return (
      <div className="stkc">
        <style>{CSS}</style>
        <p className="stkc-msg">
          No se pudo cargar la hoja: {fallo}
          <br />
          Recarga la página para reintentar.
        </p>
      </div>
    )
  }

  if (!hoja || !categoria) {
    return (
      <div className="stkc">
        <style>{CSS}</style>
        <p className="stkc-msg">Cargando la hoja de hoy…</p>
      </div>
    )
  }

  const step = Number(categoria.paso) || 1
  const hechos = contados(categoria)
  const total = categoria.productos.length
  const ubis = new Map(hoja.ubicaciones.map((u) => [u.id, u]))
  let seccionActual: string | null | undefined = undefined

  return (
    <div className="stkc">
      <style>{CSS}</style>

      <div className="stkc-top">
        <div className="stkc-head">
          <div>
            <h1 className="stkc-h1">Conteo de stock</h1>
            <p className="stkc-sub">
              Jornada {hoja.jornada.fecha}
              {hoja.jornada.perfil ? ` · par ${hoja.jornada.perfil}` : ''}
            </p>
          </div>
          <button
            className="stkc-quien"
            onClick={() => {
              localStorage.removeItem('stk_quien')
              setQuien(null)
            }}
          >
            {quien}
          </button>
        </div>
        <div className="stkc-tabs">
          {hoja.categorias.map((c) => (
            <button
              key={c.codigo}
              className="stkc-tab"
              data-on={c.codigo === cat ? '1' : '0'}
              onClick={() => setCat(c.codigo)}
            >
              {c.nombre}
              <small>
                {contados(c)}/{c.productos.length}
              </small>
            </button>
          ))}
        </div>
      </div>

      {categoria.productos.map((p) => {
        const cabecera = p.seccion !== seccionActual ? ((seccionActual = p.seccion), p.seccion) : null
        const suma = (p.ubicaciones || []).reduce(
          (a, u) => a + (Number((valores[`${p.linea_id}:${u}`] || '0').replace(',', '.')) || 0),
          0
        )
        const tocado = (p.ubicaciones || []).some((u) => valores[`${p.linea_id}:${u}`] !== undefined)
        const par = Number(p.par)

        return (
          <div key={p.linea_id}>
            {cabecera && <div className="stkc-sec">{cabecera}</div>}
            <div className="stkc-card" data-done={tocado ? '1' : '0'}>
              <div className="stkc-name">
                <b>{p.nombre}</b>
                <span className="stkc-par">
                  par <i>{par}</i>
                </span>
              </div>

              <div className="stkc-grid">
                {(p.ubicaciones || []).map((uid) => {
                  const u = ubis.get(uid)
                  if (!u) return null
                  const key = `${p.linea_id}:${uid}`
                  return (
                    <div className="stkc-ub" key={uid}>
                      <label htmlFor={`i${key}`}>{u.nombre}</label>
                      <div className="stkc-row">
                        <button
                          className="stkc-btn"
                          aria-label={`Quitar ${step} en ${u.nombre}`}
                          onClick={() => paso(p.linea_id, uid, -1, step)}
                        >
                          −
                        </button>
                        <input
                          id={`i${key}`}
                          className="stkc-in"
                          inputMode="decimal"
                          value={valores[key] ?? ''}
                          placeholder="0"
                          onChange={(e) => cambiar(p.linea_id, uid, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <button
                          className="stkc-btn"
                          aria-label={`Añadir ${step} en ${u.nombre}`}
                          onClick={() => paso(p.linea_id, uid, 1, step)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="stkc-foot">
                <span className="stkc-tot" data-diff={tocado && suma !== par ? '1' : '0'}>
                  total <b>{Math.round(suma * 100) / 100}</b> de {par}
                  {tocado && suma !== par ? ` · consumo ${Math.round((par - suma) * 100) / 100}` : ''}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="stkc-notabtn"
                    data-has={p.nota ? '1' : '0'}
                    onClick={() => setNotaAbierta(notaAbierta === p.linea_id ? null : p.linea_id)}
                  >
                    {p.nota ? 'Nota ●' : 'Nota'}
                  </button>
                  <i className="stkc-dot" data-s={estados[p.linea_id] || 'idle'} />
                </span>
              </div>

              {notaAbierta === p.linea_id && (
                <textarea
                  className="stkc-nota"
                  defaultValue={p.nota || ''}
                  placeholder="Rotura, invitación, botella prestada al Ibis…"
                  onBlur={(e) => {
                    p.nota = e.target.value
                    guardarNota(p.linea_id, e.target.value)
                  }}
                />
              )}
            </div>
          </div>
        )
      })}

      <div className="stkc-bar">
        <div className="stkc-prog">
          <i style={{ width: `${total ? (hechos / total) * 100 : 0}%` }} />
        </div>
        <div className="stkc-barrow">
          <span>
            {categoria.nombre}: {hechos} de {total}
          </span>
          <span style={{ color: hechos === total ? 'var(--ok)' : 'var(--dim)' }}>
            {hechos === total ? 'Categoría completa' : `Faltan ${total - hechos}`}
          </span>
        </div>
      </div>
    </div>
  )
}
