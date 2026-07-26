'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type Linea = {
  id: number
  producto_id: number
  producto: string
  categoria: string
  cat_codigo: string
  extra: boolean
  unidad: string | null
  unidades: string
  recibido: string | null
  estado: string
  origen: string
  nota: string | null
}
type Cat = { id: number; nombre: string; categoria: string; extra: boolean; unidad: string | null }
type Pend = { fecha: string; producto: string; pedido: string; recibido: string; linea_id: number }
type Datos = {
  pedido: {
    id: number
    fecha: string
    estado: string
    enviado_at: string | null
    enviado_por: string | null
    enviado_a: string | null
  } | null
  lineas: Linea[]
  catalogo: Cat[]
  pendientes: Pend[]
  config: Record<string, string>
}

const n = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v))
const f = (v: any) => {
  const x = n(v)
  return x === null ? '' : String(Math.round(x * 100) / 100).replace('.', ',')
}
const hoyOperativo = () => {
  const d = new Date()
  d.setHours(d.getHours() - 4)
  return d.toISOString().slice(0, 10)
}
const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const CSS = `
.stkp{--bg:#12141a;--panel:#1b1f28;--panel2:#232834;--line:#2f3644;--txt:#eef1f6;--dim:#8b94a7;
  --acc:#4ea3ff;--ok:#3ddc97;--warn:#ffb454;--bad:#ff6b6b;--topH:0px;
  background:var(--bg);color:var(--txt);min-height:100vh;padding-bottom:104px;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.stkp *{box-sizing:border-box}
.stkp-top{position:sticky;top:0;z-index:40;background:rgba(18,20,26,.98);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line);padding:10px 14px}
.stkp-row1{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.stkp-h1{font-size:16px;font-weight:650;margin:0}
.stkp-sub{font-size:11.5px;color:var(--dim);margin:2px 0 0}
.stkp-tabs{display:flex;gap:4px;flex:0 0 auto}
.stkp-tabs a{font-size:12.5px;color:var(--dim);text-decoration:none;padding:6px 10px;border-radius:8px;
  border:1px solid var(--line);white-space:nowrap}
.stkp-tabs a[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:650}
.stkp-nav{display:flex;align-items:center;gap:6px}
.stkp-nav button{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);font-size:15px;cursor:pointer;flex:0 0 auto}
.stkp-nav input[type=date]{flex:1 1 auto;min-width:0;height:34px;border-radius:8px;
  border:1px solid var(--line);background:var(--panel);color:var(--txt);padding:0 8px;font-size:13px;
  font-family:inherit;color-scheme:dark}
.stkp-hoy{padding:0 11px!important;width:auto!important;font-size:12.5px!important;font-weight:600}
.stkp-chip{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.05em;
  text-transform:uppercase;padding:3px 8px;border-radius:999px;border:1px solid var(--line);
  color:var(--dim)}
.stkp-chip[data-e="enviado"]{border-color:var(--ok);color:var(--ok)}

.stkp-add{margin:14px 14px 4px;background:var(--panel);border:1px solid var(--line);
  border-radius:14px;padding:12px}
.stkp-add h2{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:var(--dim);margin:0 0 10px}
.stkp-af{position:relative}
.stkp-af input{width:100%;height:42px;border-radius:10px;border:1px solid var(--line);
  background:#12151c;color:var(--txt);padding:0 12px;font-size:15px;font-family:inherit}
.stkp-af input:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkp-sug{position:absolute;top:46px;left:0;right:0;z-index:50;background:var(--panel2);
  border:1px solid var(--line);border-radius:10px;max-height:230px;overflow-y:auto;
  box-shadow:0 10px 30px rgba(0,0,0,.5)}
.stkp-sug button{display:block;width:100%;text-align:left;background:none;border:0;
  border-bottom:1px solid #2b3140;color:var(--txt);font-size:14px;padding:10px 12px;cursor:pointer;
  font-family:inherit}
.stkp-sug button:hover{background:#2b3140}
.stkp-sug small{display:block;color:var(--dim);font-size:11px;margin-top:2px}
.stkp-sug .nuevo{color:var(--acc);font-weight:650}
.stkp-arow{display:flex;gap:8px;margin-top:8px}
.stkp-arow input{height:42px;border-radius:10px;border:1px solid var(--line);background:#12151c;
  color:var(--txt);font-size:15px;font-family:inherit;padding:0 10px;min-width:0}
.stkp-cant{width:76px;text-align:center;font-weight:650;font-variant-numeric:tabular-nums}
.stkp-uni{flex:1 1 auto}
.stkp-arow button{flex:0 0 auto;height:42px;padding:0 18px;border-radius:10px;border:0;
  background:var(--acc);color:#08111c;font-size:14px;font-weight:650;cursor:pointer;font-family:inherit}
.stkp-arow button:disabled{opacity:.4}

.stkp-sec{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--dim);padding:20px 14px 8px}
.stkp-l{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #20252f}
.stkp-l[data-e="subido"]{background:#161d1a}
.stkp-l[data-e="no_subido"]{background:#1e1618}
.stkp-nom{flex:1 1 auto;min-width:0;font-size:14.5px;line-height:1.3}
.stkp-nom small{display:block;color:var(--dim);font-size:11px;margin-top:2px}
.stkp-nom em{font-style:normal;color:var(--acc)}
.stkp-cnt{flex:0 0 auto;display:flex;align-items:center;gap:5px}
.stkp-in{width:56px;height:36px;border-radius:8px;border:1px solid var(--line);background:#12151c;
  color:var(--txt);text-align:center;font-size:15px;font-weight:650;font-variant-numeric:tabular-nums}
.stkp-in:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkp-in.rec{border-color:#3a4657;background:#161b24}
.stkp-sel{height:36px;border-radius:8px;border:1px solid var(--line);background:#12151c;
  color:var(--txt);font-size:11.5px;padding:0 3px;font-family:inherit;max-width:96px}
.stkp-del{width:32px;height:36px;border-radius:8px;border:1px solid var(--line);background:none;
  color:var(--dim);font-size:16px;cursor:pointer}
.stkp-lab{font-size:9.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;
  display:block;text-align:center;margin-bottom:2px}
.stkp-cabs{display:flex;gap:10px;padding:0 14px 6px;justify-content:flex-end}

.stkp-pend{margin:14px;background:#1e1a15;border:1px solid #4a3a20;border-radius:12px;padding:12px}
.stkp-pend h2{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--warn);margin:0 0 8px}
.stkp-pend div{font-size:12.5px;color:#d8cbb4;line-height:1.7}
.stkp-env{margin:14px;background:var(--panel);border:1px solid var(--line);
  border-radius:14px;padding:14px}
.stkp-env h2{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:var(--dim);margin:0 0 10px}
.stkp-env label{display:block;font-size:11px;color:var(--dim);margin:0 0 4px}
.stkp-env input{width:100%;height:40px;border-radius:10px;border:1px solid var(--line);
  background:#12151c;color:var(--txt);padding:0 12px;font-size:15px;font-family:inherit;
  margin-bottom:10px}
.stkp-env input:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stkp-env .enviar{width:100%;height:46px;border-radius:11px;border:0;background:var(--ok);
  color:#05231a;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
.stkp-env .enviar:disabled{opacity:.4}
.stkp-ok{margin:14px;background:#152219;border:1px solid #2a4a3c;border-radius:12px;padding:12px;
  font-size:12.5px;color:#a9d8c2;line-height:1.6}
.stkp-err{margin:14px;background:#241618;border:1px solid #5a2a2f;border-radius:12px;padding:12px;
  font-size:12.5px;color:#f0b4b8;line-height:1.6}
.stkp-msg{padding:50px 24px;text-align:center;color:var(--dim);font-size:14px;line-height:1.6}
.stkp-bar{position:fixed;left:0;right:0;bottom:0;z-index:45;background:rgba(27,31,40,.98);
  backdrop-filter:blur(8px);border-top:1px solid var(--line);
  padding:10px 14px calc(10px + env(safe-area-inset-bottom))}
.stkp-barrow{display:flex;gap:8px;align-items:center;justify-content:space-between;
  font-size:12px;color:var(--dim)}
.stkp-barrow b{color:var(--txt)}
.stkp-acc{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
.stkp-acc button,.stkp-acc a{border:1px solid var(--line);border-radius:9px;background:var(--panel);
  color:var(--txt);font-size:12.5px;font-weight:600;padding:9px 12px;cursor:pointer;
  text-decoration:none;font-family:inherit}
.stkp-acc .pri{background:var(--acc);border-color:var(--acc);color:#08111c}
.stkp-acc button:disabled{opacity:.4}
`

export default function PedidoPage() {
  // Igual que en la hoja: la fecha se fija ya en el navegador.
  const [fecha, setFecha] = useState<string | null>(null)
  const [d, setD] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [cant, setCant] = useState('1')
  const [unidad, setUnidad] = useState('')
  const [sel, setSel] = useState<Cat | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [para, setPara] = useState('')
  const [copia, setCopia] = useState('')
  const [remite, setRemite] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [envio, setEnvio] = useState<{ ok: boolean; msg: string } | null>(null)
  const cajaRef = useRef<HTMLInputElement>(null)

  const esHoy = fecha === hoyOperativo()

  const cargar = async (fch: string | null) => {
    if (!fch) return
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
      setPara((v) => v || j?.config?.email_economato || '')
      setCopia((v) => v || j?.config?.email_copia || '')
      setRemite((v) => v || j?.config?.email_from || '')
    } catch (e: any) {
      setFallo(e.message)
    } finally {
      setCargando(false)
    }
  }

  const guardarConfig = (clave: string, valor: string) =>
    fetch('/api/stock/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, valor }),
    })

  const enviar = async () => {
    if (!d?.pedido) return
    setEnviando(true)
    setEnvio(null)
    try {
      const r = await fetch('/api/stock/pedido/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: d.pedido.id,
          quien: localStorage.getItem('stk_quien'),
          para,
          copia,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.detalle || j.error || 'no se pudo enviar')
      setEnvio({ ok: true, msg: `Enviado a ${j.para}${j.copia ? ' con copia a ' + j.copia : ''}` })
      await cargar(fecha)
    } catch (e: any) {
      setEnvio({ ok: false, msg: e.message })
    } finally {
      setEnviando(false)
    }
  }

  useEffect(() => {
    setFecha(hoyOperativo())
  }, [])

  useEffect(() => {
    if (fecha) cargar(fecha)
  }, [fecha])

  const accion = async (body: any, recargar = true) => {
    const r = await fetch('/api/stock/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (recargar) await cargar(fecha)
    return r.ok
  }

  const mover = (dias: number) => {
    if (!fecha) return
    const x = new Date(fecha + 'T12:00:00')
    x.setDate(x.getDate() + dias)
    setFecha(x.toISOString().slice(0, 10))
  }

  const sugerencias = useMemo(() => {
    if (!d || texto.trim().length < 2) return []
    const q = sinTildes(texto.trim())
    const yaPuestos = new Set(d.lineas.map((l) => l.producto_id))
    return d.catalogo
      .filter((c) => sinTildes(c.nombre).includes(q) && !yaPuestos.has(c.id))
      .slice(0, 8)
  }, [d, texto])

  const existeExacto = useMemo(() => {
    if (!d || !texto.trim()) return false
    const q = sinTildes(texto.trim())
    return d.catalogo.some((c) => sinTildes(c.nombre) === q)
  }, [d, texto])

  const anadir = async () => {
    const u = Number(cant.replace(',', '.'))
    if (!u || u <= 0 || !texto.trim() || !d?.pedido) return
    setOcupado(true)
    await accion({
      accion: 'linea',
      pedidoId: d.pedido.id,
      productoId: sel?.id ?? null,
      nombre: sel ? null : texto.trim(),
      unidades: u,
      unidad: unidad.trim() || null,
    })
    setTexto('')
    setCant('1')
    setUnidad('')
    setSel(null)
    setAbierto(false)
    setOcupado(false)
    cajaRef.current?.focus()
  }

  const textoPedido = useMemo(() => {
    if (!d) return ''
    const l = [`Pedido a economato — ${fecha}`, '']
    let cat = ''
    d.lineas.forEach((x) => {
      if (x.categoria !== cat) {
        cat = x.categoria
        l.push(`— ${cat.toUpperCase()} —`)
      }
      l.push(`${f(x.unidades)}${x.unidad ? ' ' + x.unidad : ''} · ${x.producto}`)
    })
    if (!d.lineas.length) l.push('(sin líneas)')
    return l.join('\n')
  }, [d, fecha])

  if (!fecha) {
    return (
      <div className="stkp">
        <style>{CSS}</style>
        <p className="stkp-msg">Cargando…</p>
      </div>
    )
  }

  const enviado = d?.pedido?.estado === 'enviado'
  const sinRecibir = (d?.lineas || []).filter((x) => x.estado === 'pendiente').length
  let secActual: string | null | undefined = undefined

  return (
    <div className="stkp">
      <style>{CSS}</style>

      <div className="stkp-top">
        <div className="stkp-row1">
          <div>
            <h1 className="stkp-h1">Pedido a economato</h1>
            <p className="stkp-sub">
              {d?.pedido ? (
                <>
                  {d.lineas.length} líneas ·{' '}
                  <span className="stkp-chip" data-e={d.pedido.estado}>
                    {d.pedido.estado === 'enviado' ? 'Enviado' : 'Borrador'}
                  </span>
                </>
              ) : (
                'sin pedido para esta fecha'
              )}
            </p>
          </div>
          <nav className="stkp-tabs">
            <Link href="/stock">Contar</Link>
            <Link href="/stock/hoja">Hoja</Link>
            <Link href="/stock/pedido" data-on="1">
              Pedido
            </Link>
          </nav>
        </div>

        <div className="stkp-nav">
          <button onClick={() => mover(-1)} aria-label="Dia anterior">
            &#8249;
          </button>
          <input type="date" value={fecha} max={hoyOperativo()} onChange={(e) => setFecha(e.target.value)} />
          <button onClick={() => mover(1)} disabled={esHoy} aria-label="Dia siguiente">
            &#8250;
          </button>
          {!esHoy && (
            <button className="stkp-hoy" onClick={() => setFecha(hoyOperativo())}>
              Hoy
            </button>
          )}
        </div>
      </div>

      {fallo ? (
        <p className="stkp-msg">
          No se pudo cargar el pedido.
          <br />
          {fallo}
        </p>
      ) : cargando ? (
        <p className="stkp-msg">Cargando…</p>
      ) : !d?.pedido ? (
        <p className="stkp-msg">
          No hay pedido del {fecha}.
          <br />
          Ese día no se creó ninguno.
        </p>
      ) : (
        <>
          {d.pendientes.length > 0 && (
            <div className="stkp-pend">
              <h2>Pendiente de subir de días anteriores</h2>
              {d.pendientes.map((p) => (
                <div key={p.linea_id}>
                  {p.fecha} · {p.producto} — pedidas {f(p.pedido)}, subidas {f(p.recibido) || '0'}
                </div>
              ))}
            </div>
          )}

          <div className="stkp-add">
            <h2>Añadir artículo</h2>
            <div className="stkp-af">
              <input
                ref={cajaRef}
                value={texto}
                placeholder="Escribe: pajitas, patatas de bolsa, Coca Cola…"
                autoComplete="off"
                onChange={(e) => {
                  setTexto(e.target.value)
                  setSel(null)
                  setAbierto(true)
                }}
                onFocus={() => setAbierto(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') anadir()
                  if (e.key === 'Escape') setAbierto(false)
                }}
              />
              {abierto && texto.trim().length >= 2 && (
                <div className="stkp-sug">
                  {sugerencias.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSel(c)
                        setTexto(c.nombre)
                        setUnidad(c.unidad || '')
                        setAbierto(false)
                      }}
                    >
                      {c.nombre}
                      <small>{c.categoria}</small>
                    </button>
                  ))}
                  {!existeExacto && (
                    <button
                      onClick={() => {
                        setSel(null)
                        setAbierto(false)
                      }}
                    >
                      <span className="nuevo">Crear «{texto.trim()}»</span>
                      <small>artículo nuevo, se guarda para la próxima vez</small>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="stkp-arow">
              <input
                className="stkp-cant"
                inputMode="decimal"
                value={cant}
                onChange={(e) => setCant(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Cantidad"
              />
              <input
                className="stkp-uni"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="caja, bolsa, unidad…"
                aria-label="Unidad de compra"
              />
              <button onClick={anadir} disabled={ocupado || !texto.trim()}>
                Añadir
              </button>
            </div>
          </div>

          {d.lineas.length === 0 ? (
            <p className="stkp-msg">
              El pedido está vacío.
              <br />
              Usa «Traer de la hoja» abajo para volcar lo consumido, o añade artículos a mano.
            </p>
          ) : (
            <>
              <div className="stkp-cabs">
                <span className="stkp-lab" style={{ width: 56 }}>
                  Pedido
                </span>
                <span className="stkp-lab" style={{ width: 56 }}>
                  Subido
                </span>
                <span className="stkp-lab" style={{ width: 96 }}>
                  Estado
                </span>
                <span style={{ width: 32 }} />
              </div>
              {d.lineas.map((x) => {
                const cab = x.categoria !== secActual ? ((secActual = x.categoria), x.categoria) : null
                return (
                  <div key={x.id}>
                    {cab && <div className="stkp-sec">{cab}</div>}
                    <div className="stkp-l" data-e={x.estado}>
                      <span className="stkp-nom">
                        {x.producto}
                        <small>
                          {x.unidad ? `${x.unidad} · ` : ''}
                          {x.origen === 'auto' ? 'desde la hoja' : <em>manual</em>}
                        </small>
                      </span>
                      <span className="stkp-cnt">
                        <input
                          className="stkp-in"
                          inputMode="decimal"
                          defaultValue={f(x.unidades)}
                          aria-label={`Pedido de ${x.producto}`}
                          onBlur={(e) =>
                            accion({
                              accion: 'linea',
                              pedidoId: d.pedido!.id,
                              productoId: x.producto_id,
                              unidades: e.target.value,
                            })
                          }
                        />
                        <input
                          className="stkp-in rec"
                          inputMode="decimal"
                          defaultValue={f(x.recibido)}
                          placeholder="—"
                          aria-label={`Subido de ${x.producto}`}
                          onBlur={(e) => {
                            const rec = n(e.target.value)
                            const ped = Number(x.unidades)
                            const est =
                              rec === null ? null : rec <= 0 ? 'no_subido' : rec >= ped ? 'subido' : 'parcial'
                            accion({ accion: 'recibir', lineaId: x.id, recibido: e.target.value, estado: est })
                          }}
                        />
                        <select
                          className="stkp-sel"
                          value={x.estado}
                          onChange={(e) => accion({ accion: 'recibir', lineaId: x.id, estado: e.target.value })}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="subido">Subido</option>
                          <option value="parcial">A medias</option>
                          <option value="no_subido">No subido</option>
                        </select>
                        <button
                          className="stkp-del"
                          aria-label={`Quitar ${x.producto}`}
                          onClick={() => accion({ accion: 'borrar', lineaId: x.id })}
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {d?.pedido && (
        <>
          {envio && (
            <div className={envio.ok ? 'stkp-ok' : 'stkp-err'}>
              {envio.ok ? '✓ ' : '✕ '}
              {envio.msg}
            </div>
          )}

          {enviado ? (
            <div className="stkp-ok">
              Pedido enviado{d.pedido.enviado_por ? ` por ${d.pedido.enviado_por}` : ''}
              {d.pedido.enviado_a ? ` a ${d.pedido.enviado_a}` : ''}.
              <br />
              Sigue anotando abajo lo que el economato vaya subiendo.
            </div>
          ) : (
            <div className="stkp-env">
              <h2>Enviar al economato</h2>
              <label htmlFor="e_para">Destinatario</label>
              <input
                id="e_para"
                type="email"
                inputMode="email"
                value={para}
                onChange={(e) => setPara(e.target.value)}
                onBlur={(e) => guardarConfig('email_economato', e.target.value)}
                placeholder="economato@hotel.com"
              />
              <label htmlFor="e_copia">Copia (opcional)</label>
              <input
                id="e_copia"
                type="email"
                inputMode="email"
                value={copia}
                onChange={(e) => setCopia(e.target.value)}
                onBlur={(e) => guardarConfig('email_copia', e.target.value)}
                placeholder="tu@hotel.com"
              />
              <label htmlFor="e_from">Remitente (dominio verificado en Resend)</label>
              <input
                id="e_from"
                value={remite}
                onChange={(e) => setRemite(e.target.value)}
                onBlur={(e) => guardarConfig('email_from', e.target.value)}
                placeholder="Stock Las Ventas <stock@tudominio.com>"
              />
              <button
                className="enviar"
                disabled={enviando || !d.lineas.length || !para.trim()}
                onClick={enviar}
              >
                {enviando ? 'Enviando…' : `Enviar pedido (${d.lineas.length} líneas)`}
              </button>
            </div>
          )}
        </>
      )}

      <div className="stkp-bar">
        <div className="stkp-barrow">
          <span>
            <b>{d?.lineas.length || 0}</b> líneas · <b>{sinRecibir}</b> sin subir
          </span>
          {enviado && d?.pedido?.enviado_por && <span>Enviado por {d.pedido.enviado_por}</span>}
        </div>
        <div className="stkp-acc">
          <button
            className="pri"
            disabled={ocupado || !d?.pedido}
            onClick={async () => {
              setOcupado(true)
              await accion({ accion: 'rellenar', pedidoId: d!.pedido!.id })
              setOcupado(false)
            }}
          >
            Traer de la hoja
          </button>
          <button
            disabled={!d?.lineas.length}
            onClick={async () => {
              await navigator.clipboard.writeText(textoPedido)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 2000)
            }}
          >
            {copiado ? 'Copiado ✓' : 'Copiar'}
          </button>
          <a
            href={`mailto:?subject=${encodeURIComponent('Pedido economato ' + fecha)}&body=${encodeURIComponent(textoPedido)}`}
          >
            Abrir en mi correo
          </a>
        </div>
      </div>
    </div>
  )
}
