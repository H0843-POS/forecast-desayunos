'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type Ubi = { id: number; codigo: string; nombre: string }
type Rango = { id: number; desde: string; hasta: string; prioridad: number }
type Perfil = {
  id: number
  codigo: string
  nombre: string
  hereda_de: number | null
  padre: string | null
  rangos: Rango[]
}
type Prod = {
  id: number
  nombre: string
  categoria: string
  cat_codigo: string
  seccion: string | null
  par: string
  propio: boolean
  zonas: number[]
  objetivos: Record<string, string>
  objetivos_propios: number[]
}
type Datos = {
  perfil_id: number
  perfiles: Perfil[]
  ubicaciones: Ubi[]
  productos: Prod[]
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const f = (v: any) => String(Math.round(Number(v) * 100) / 100).replace('.', ',')

const CSS = `
.stka{--bg:#12141a;--panel:#1b1f28;--panel2:#232834;--line:#2f3644;--txt:#eef1f6;--dim:#8b94a7;
  --acc:#4ea3ff;--ok:#3ddc97;--warn:#ffb454;
  background:var(--bg);color:var(--txt);height:100vh;height:100dvh;
  display:flex;flex-direction:column;overflow:hidden;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.stka *{box-sizing:border-box}
.stka-top{flex:0 0 auto;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 14px}
.stka-row1{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.stka-h1{font-size:16px;font-weight:650;margin:0}
.stka-sub{font-size:11.5px;color:var(--dim);margin:2px 0 0}
.stka-tabs{display:flex;gap:4px}
.stka-tabs a{font-size:12.5px;color:var(--dim);text-decoration:none;padding:6px 10px;border-radius:8px;
  border:1px solid var(--line);white-space:nowrap}
.stka-tabs a[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:650}
.stka-perf{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:8px}
.stka-perf::-webkit-scrollbar{display:none}
.stka-p{flex:0 0 auto;padding:7px 12px;border-radius:999px;border:1px solid var(--line);
  background:var(--panel);color:var(--dim);font-size:12.5px;white-space:nowrap;cursor:pointer}
.stka-p[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:650}
.stka-p.mas{border-style:dashed;color:var(--acc)}
.stka-busca{position:relative}
.stka-busca input{width:100%;height:36px;border-radius:9px;border:1px solid var(--line);
  background:var(--panel);color:var(--txt);padding:0 34px 0 12px;font-size:14.5px;font-family:inherit}
.stka-busca input:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stka-zfiltro{display:flex;gap:5px;flex-wrap:wrap;margin:8px 14px 0}
.stka-zfb{padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:none;
  color:#5d6577;font-size:11.5px;cursor:pointer;font-family:inherit}
.stka-zfb[data-on="1"]{background:var(--acc);border-color:var(--acc);color:#08111c;font-weight:600}
.stka-inact-tog{margin:0;background:none;border:0;color:var(--dim);font-size:11.5px;
  text-decoration:underline;cursor:pointer;font-family:inherit;padding:0}
.stka-altbar{margin:8px 14px 0;display:flex;gap:16px}
.stka-alta{margin:8px 14px 0;padding:10px;border:1px solid var(--line);border-radius:10px;
  display:flex;flex-direction:column;gap:7px;background:#161a22}
.stka-alta input,.stka-alta select{height:34px;border-radius:8px;border:1px solid var(--line);
  background:var(--bg);color:var(--txt);padding:0 9px;font-size:13px;font-family:inherit}
.stka-alta-err{margin:0;color:var(--warn);font-size:11.5px}
.stka-alta-btn{height:34px;border-radius:8px;border:1px solid var(--acc);background:var(--acc);
  color:#08111c;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.stka-alta-btn:disabled{opacity:.5}
.stka-inact{margin:8px 14px 0;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.stka-inact-vacio{margin:0;padding:10px 12px;font-size:12px;color:var(--dim)}
.stka-inact-f{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:8px 12px;border-bottom:1px solid #20252f;font-size:12.5px}
.stka-inact-f:last-child{border-bottom:0}
.stka-inact-f small{display:block;color:var(--dim);font-size:10.5px}
.stka-inact-f button{border:1px solid var(--line);border-radius:7px;background:none;color:var(--acc);
  font-size:11.5px;padding:4px 9px;cursor:pointer;font-family:inherit;white-space:nowrap}
.stka-x{position:absolute;right:3px;top:3px;width:30px;height:30px;border:0;background:none;
  color:var(--dim);font-size:17px;cursor:pointer}

.stka-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
.stka-info{margin:12px 14px;background:#1a1f2b;border:1px solid var(--line);border-radius:12px;
  padding:12px;font-size:12.5px;color:var(--dim);line-height:1.6}
.stka-info b{color:var(--txt)}
.stka-cal{margin:0 14px 12px;background:var(--panel);border:1px solid var(--line);border-radius:12px;
  padding:12px}
.stka-cal h3{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  color:var(--dim);margin:0 0 8px}
.stka-cal .r{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#c8d0dc;
  padding:5px 0;border-bottom:1px solid #242a36}
.stka-cal .r button{margin-left:auto;background:none;border:0;color:var(--dim);font-size:15px;
  cursor:pointer;padding:2px 6px}
.stka-cal .add{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
.stka-cal input[type=date]{flex:1 1 120px;min-width:0;height:34px;border-radius:8px;
  border:1px solid var(--line);background:#12151c;color:var(--txt);padding:0 8px;font-size:12.5px;
  font-family:inherit;color-scheme:dark}
.stka-cal .add button{flex:0 0 auto;height:34px;padding:0 14px;border-radius:8px;border:0;
  background:var(--acc);color:#08111c;font-size:12.5px;font-weight:650;cursor:pointer;font-family:inherit}

.stka-sec{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--dim);padding:18px 14px 6px;display:flex;align-items:center;gap:8px}
.stka-sec small{margin-left:auto;font-size:10px;font-weight:600;letter-spacing:0;text-transform:none;
  color:var(--acc);cursor:pointer;border:1px solid var(--line);border-radius:7px;padding:4px 8px}
.stka-l{padding:10px 14px;border-bottom:1px solid #20252f}
.stka-del{width:26px;height:26px;border-radius:8px;border:1px solid var(--line);background:none;
  color:#8a5252;font-size:15px;line-height:1;cursor:pointer;font-family:inherit;flex:0 0 auto}
.stka-del:hover{background:#3a1d1d;border-color:#7a3a3a;color:#e08080}
.stka-lr{display:flex;align-items:center;gap:10px}
.stka-nom{flex:1 1 auto;min-width:0;font-size:14.5px;line-height:1.3}
.stka-nom small{display:block;color:var(--dim);font-size:10.5px;margin-top:2px}
.stka-nom small.h{color:var(--warn)}
.stka-in{width:66px;height:38px;flex:0 0 auto;border-radius:9px;border:1px solid var(--line);
  background:#12151c;color:var(--txt);text-align:center;font-size:16px;font-weight:650;
  font-variant-numeric:tabular-nums}
.stka-in:focus{outline:2px solid var(--acc);outline-offset:-1px}
.stka-in[data-propio="1"]{border-color:var(--acc)}
.stka-res{width:32px;height:38px;flex:0 0 auto;border-radius:9px;border:1px solid var(--line);
  background:none;color:var(--dim);font-size:14px;cursor:pointer}
.stka-z{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.stka-zb{padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:none;
  color:#5d6577;font-size:11.5px;cursor:pointer;font-family:inherit}
.stka-zb[data-on="1"]{background:#1d3348;border-color:#37658f;color:#9ccbf5;
  font-weight:600}
.stka-zw{display:flex;align-items:center;gap:5px;padding:3px 4px 3px 10px;border-radius:999px;
  border:1px solid #37658f;background:#1d3348}
.stka-zw button{padding:0;border:0;background:none;color:#9ccbf5;font-size:11.5px;font-weight:600;
  cursor:pointer;font-family:inherit;white-space:nowrap}
.stka-zw input{width:38px;height:24px;border-radius:7px;border:1px solid #37658f;background:#12151c;
  color:var(--txt);text-align:center;font-size:11.5px;font-weight:650;font-family:inherit;
  font-variant-numeric:tabular-nums}
.stka-zw input[data-propio="0"]{color:var(--dim);font-style:italic}
.stka-aviso{margin:12px 14px;background:#152219;border:1px solid #2a4a3c;border-radius:12px;
  padding:12px;font-size:12.5px;color:#a9d8c2;line-height:1.6}
.stka-msg{padding:50px 24px;text-align:center;color:var(--dim);font-size:14px;line-height:1.6}
.stka-bar{flex:0 0 auto;background:var(--panel);border-top:1px solid var(--line);
  padding:10px 14px calc(10px + env(safe-area-inset-bottom));
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  font-size:12px;color:var(--dim)}
.stka-bar b{color:var(--txt)}
.stka-bar button{border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--txt);
  font-size:12.5px;font-weight:600;padding:9px 12px;cursor:pointer;font-family:inherit}
`

export default function AjustesPage() {
  const [d, setD] = useState<Datos | null>(null)
  const [perfil, setPerfil] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [zonaFiltro, setZonaFiltro] = useState<number | null>(null)
  const [verCal, setVerCal] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [inactivos, setInactivos] = useState<{ id: number; nombre: string; categoria: string }[]>([])
  const [verInactivos, setVerInactivos] = useState(false)
  const [categorias, setCategorias] = useState<{ codigo: string; nombre: string; subcategorias: string[] }[]>([])
  const [verAlta, setVerAlta] = useState(false)
  const [altaNombre, setAltaNombre] = useState('')
  const [altaCat, setAltaCat] = useState('')
  const [altaSub, setAltaSub] = useState('')
  const [altaError, setAltaError] = useState<string | null>(null)
  const [altaEnviando, setAltaEnviando] = useState(false)

  const cargar = async (p: number | null) => {
    setCargando(true)
    setFallo(null)
    try {
      const r = await fetch(p ? `/api/stock/ajustes?perfil=${p}` : '/api/stock/ajustes')
      const t = await r.text()
      let j: any
      try {
        j = JSON.parse(t)
      } catch {
        throw new Error(t.slice(0, 200) || 'respuesta vacía')
      }
      if (!r.ok) throw new Error(j.detalle || j.error)
      setD(j)
      setPerfil(j.perfil_id)
    } catch (e: any) {
      setFallo(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar(null)
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)

  const accion = async (body: any, recargar = true) => {
    const scrollPos = scrollRef.current?.scrollTop
    await fetch('/api/stock/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perfilId: perfil, ...body }),
    })
    if (recargar) {
      await cargar(perfil)
      requestAnimationFrame(() => {
        if (scrollRef.current && scrollPos !== undefined) scrollRef.current.scrollTop = scrollPos
      })
    }
  }

  const cargarInactivos = async () => {
    try {
      const r = await fetch('/api/stock/ajustes?inactivos=1')
      const j = await r.json()
      if (r.ok) setInactivos(j)
    } catch {
      // no crítico: la sección de reactivar simplemente queda vacía
    }
  }

  const cargarCategorias = async () => {
    if (categorias.length) return
    try {
      const r = await fetch('/api/stock/ajustes?categorias=1')
      const j = await r.json()
      if (r.ok) setCategorias(j)
    } catch {
      // no crítico
    }
  }

  const crearProducto = async () => {
    setAltaError(null)
    if (!altaNombre.trim()) {
      setAltaError('Falta el nombre')
      return
    }
    if (!altaCat) {
      setAltaError('Elige una categoría')
      return
    }
    setAltaEnviando(true)
    try {
      const r = await fetch('/api/stock/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfilId: perfil,
          accion: 'crear_producto',
          nombre: altaNombre.trim(),
          categoriaCodigo: altaCat,
          subcategoria: altaSub || null,
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || j?.error) throw new Error(j?.error || 'no se pudo crear')
      setAltaNombre('')
      setAltaSub('')
      setVerAlta(false)
      await cargar(perfil)
    } catch (e: any) {
      setAltaError(e.message)
    } finally {
      setAltaEnviando(false)
    }
  }

  const eliminarProducto = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar «${nombre}»?\n\nDeja de contarse y de aparecer en pedidos, pero su histórico no se borra — podrás reactivarlo cuando quieras.`))
      return
    await accion({ accion: 'eliminar_producto', productoId: id })
    if (verInactivos) await cargarInactivos()
  }

  const reactivarProducto = async (id: number) => {
    await fetch('/api/stock/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perfilId: perfil, accion: 'reactivar_producto', productoId: id }),
    })
    await cargarInactivos()
    await cargar(perfil)
  }

  const actual = useMemo(() => d?.perfiles.find((p) => p.id === perfil) || null, [d, perfil])

  const productos = useMemo(() => {
    if (!d) return []
    let lista = d.productos
    if (busca.trim()) {
      const q = sinTildes(busca.trim())
      lista = lista.filter((p) => sinTildes(p.nombre).includes(q))
    }
    if (zonaFiltro !== null) {
      lista = lista.filter((p) => p.zonas.includes(zonaFiltro))
    }
    return lista
  }, [d, busca, zonaFiltro])

  const propios = (d?.productos || []).filter((p) => p.propio).length

  if (fallo)
    return (
      <div className="stka">
        <style>{CSS}</style>
        <p className="stka-msg">No se pudieron cargar los ajustes.<br />{fallo}</p>
      </div>
    )

  let secActual: string | null | undefined = undefined

  return (
    <div className="stka">
      <style>{CSS}</style>

      <div className="stka-top">
        <div className="stka-row1">
          <div>
            <h1 className="stka-h1">Stock inicial</h1>
            <p className="stka-sub">
              {actual
                ? `${actual.nombre}${actual.padre ? ` · hereda de ${actual.padre}` : ''}`
                : 'cargando…'}
            </p>
          </div>
          <nav className="stka-tabs">
            <Link href="/stock">Contar</Link>
            <Link href="/stock/hoja">Hoja</Link>
            <Link href="/stock/ajustes" data-on="1">
              Ajustes
            </Link>
          </nav>
        </div>

        <div className="stka-perf">
          {(d?.perfiles || []).map((p) => (
            <button
              key={p.id}
              className="stka-p"
              data-on={p.id === perfil ? '1' : '0'}
              onClick={() => cargar(p.id)}
            >
              {p.nombre}
            </button>
          ))}
          <button
            className="stka-p mas"
            onClick={async () => {
              const nombre = prompt('Nombre del perfil nuevo (ej. Navidad, Alta ocupación)')
              if (!nombre?.trim()) return
              await accion({ accion: 'perfil', nombre: nombre.trim(), heredaDe: perfil }, false)
              await cargar(null)
            }}
          >
            + Nuevo
          </button>
        </div>

        <div className="stka-busca">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar producto…"
            autoComplete="off"
          />
          {busca && (
            <button className="stka-x" onClick={() => setBusca('')} aria-label="Limpiar">
              ×
            </button>
          )}
        </div>

        <div className="stka-zfiltro">
          <button
            className="stka-zfb"
            data-on={zonaFiltro === null ? '1' : '0'}
            onClick={() => setZonaFiltro(null)}
          >
            Todas las zonas
          </button>
          {(d?.ubicaciones || []).map((u) => (
            <button
              key={u.id}
              className="stka-zfb"
              data-on={zonaFiltro === u.id ? '1' : '0'}
              onClick={() => setZonaFiltro(u.id)}
            >
              {u.nombre}
            </button>
          ))}
        </div>

        <div className="stka-altbar">
          <button
            className="stka-inact-tog"
            onClick={() => {
              const v = !verAlta
              setVerAlta(v)
              setAltaError(null)
              if (v) cargarCategorias()
            }}
          >
            {verAlta ? 'Cancelar' : '+ Añadir producto'}
          </button>
          <button
            className="stka-inact-tog"
            onClick={() => {
              const v = !verInactivos
              setVerInactivos(v)
              if (v) cargarInactivos()
            }}
          >
            {verInactivos ? 'Ocultar eliminados' : 'Ver eliminados'}
          </button>
        </div>

        {verAlta && (
          <div className="stka-alta">
            <input
              value={altaNombre}
              onChange={(e) => setAltaNombre(e.target.value)}
              placeholder="Nombre del producto"
              autoComplete="off"
            />
            <select value={altaCat} onChange={(e) => { setAltaCat(e.target.value); setAltaSub('') }}>
              <option value="">Categoría…</option>
              {categorias.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {(categorias.find((c) => c.codigo === altaCat)?.subcategorias.length || 0) > 0 && (
              <select value={altaSub} onChange={(e) => setAltaSub(e.target.value)}>
                <option value="">Sin subcategoría</option>
                {categorias
                  .find((c) => c.codigo === altaCat)!
                  .subcategorias.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            )}
            {altaError && <p className="stka-alta-err">{altaError}</p>}
            <button className="stka-alta-btn" disabled={altaEnviando} onClick={crearProducto}>
              {altaEnviando ? 'Creando…' : 'Crear'}
            </button>
          </div>
        )}
        {verInactivos && (
          <div className="stka-inact">
            {inactivos.length === 0 && <p className="stka-inact-vacio">No hay productos eliminados.</p>}
            {inactivos.map((p) => (
              <div className="stka-inact-f" key={p.id}>
                <span>
                  {p.nombre} <small>{p.categoria}</small>
                </span>
                <button onClick={() => reactivarProducto(p.id)}>Reactivar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="stka-scroll" ref={scrollRef}>
        {cargando ? (
          <p className="stka-msg">Cargando…</p>
        ) : (
          <>
            {aviso && <div className="stka-aviso">{aviso}</div>}

            <div className="stka-info">
              El <b>stock inicial</b> es lo que debe haber al empezar el día. El pedido siempre devuelve a
              ese número. El número dentro de cada pastilla azul es el <b>objetivo de esa ubicación en
              concreto</b> (cuánto debería haber ahí exactamente) — es solo de referencia al contar, no
              cambia el pedido ni el stock inicial.
              {actual?.padre && (
                <>
                  {' '}
                  Los valores en azul son propios de <b>{actual.nombre}</b>; el resto los hereda de{' '}
                  <b>{actual.padre}</b>, así que cambiar el padre los cambia aquí también.
                </>
              )}
              <br />
              <button
                onClick={() => setVerCal(!verCal)}
                style={{
                  background: 'none',
                  border: 0,
                  color: 'var(--acc)',
                  fontSize: 12.5,
                  padding: '6px 0 0',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {verCal ? 'Ocultar' : 'Ver'} cuándo se aplica este perfil
              </button>
            </div>

            {verCal && actual && (
              <div className="stka-cal">
                <h3>Fechas en las que manda «{actual.nombre}»</h3>
                {actual.rangos.length === 0 && (
                  <div className="r" style={{ color: 'var(--dim)' }}>
                    Sin fechas. Solo se aplica si lo eliges a mano.
                  </div>
                )}
                {actual.rangos.map((r) => (
                  <div className="r" key={r.id}>
                    {r.desde} → {r.hasta}
                    <button
                      onClick={() => accion({ accion: 'cal_del', id: r.id })}
                      aria-label="Quitar rango"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="add">
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                  <button
                    disabled={!desde || !hasta}
                    onClick={async () => {
                      await accion({ accion: 'cal_add', desde, hasta, prioridad: 0 })
                      setDesde('')
                      setHasta('')
                    }}
                  >
                    Añadir
                  </button>
                </div>
              </div>
            )}

            {productos.map((p) => {
              const etiqueta = [p.categoria, p.seccion].filter(Boolean).join(' · ')
              const cab = !busca && etiqueta !== secActual ? ((secActual = etiqueta), etiqueta) : null
              return (
                <Fragment key={p.id}>
                  {cab && (
                    <div className="stka-sec">
                      <span>{cab}</span>
                      <small
                        onClick={async () => {
                          const u = prompt(
                            `Apagar el conteo de «${cab}» en qué zona?\n` +
                              (d?.ubicaciones || []).map((x, i) => `${i + 1}. ${x.nombre}`).join('\n')
                          )
                          const i = Number(u) - 1
                          const ubi = (d?.ubicaciones || [])[i]
                          if (!ubi) return
                          await accion({
                            accion: 'grupo',
                            categoria: p.cat_codigo,
                            seccion: p.seccion,
                            ubicacionId: ubi.id,
                            activa: false,
                          })
                        }}
                      >
                        apagar zona
                      </small>
                    </div>
                  )}
                  <div className="stka-l">
                    <div className="stka-lr">
                      <span className="stka-nom">
                        {p.nombre}
                        <small className={p.propio ? 'h' : ''}>
                          {p.propio ? 'valor propio de este perfil' : 'heredado'}
                        </small>
                      </span>
                      <input
                        className="stka-in"
                        data-propio={p.propio ? '1' : '0'}
                        inputMode="decimal"
                        defaultValue={f(p.par)}
                        aria-label={`Stock inicial de ${p.nombre}`}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => {
                          const v = e.target.value.replace(',', '.')
                          if (Number(v) === Number(p.par)) return
                          accion({ accion: 'par', productoId: p.id, unidades: v })
                        }}
                      />
                      {p.propio && actual?.padre && (
                        <button
                          className="stka-res"
                          title={`Volver a heredar de ${actual.padre}`}
                          aria-label="Volver a heredar"
                          onClick={() => accion({ accion: 'heredar', productoId: p.id })}
                        >
                          ↺
                        </button>
                      )}
                      <button
                        className="stka-del"
                        title="Eliminar producto"
                        aria-label={`Eliminar ${p.nombre}`}
                        onClick={() => eliminarProducto(p.id, p.nombre)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="stka-z">
                      {(d?.ubicaciones || []).map((u) => {
                        const on = p.zonas.includes(u.id)
                        if (!on) {
                          return (
                            <button
                              key={u.id}
                              className="stka-zb"
                              data-on="0"
                              onClick={() =>
                                accion({
                                  accion: 'zona',
                                  productoId: p.id,
                                  ubicacionId: u.id,
                                  activa: true,
                                })
                              }
                            >
                              {u.nombre}
                            </button>
                          )
                        }
                        const propioObjetivo = p.objetivos_propios?.includes(u.id)
                        return (
                          <span className="stka-zw" key={u.id}>
                            <button
                              onClick={() =>
                                accion({
                                  accion: 'zona',
                                  productoId: p.id,
                                  ubicacionId: u.id,
                                  activa: false,
                                })
                              }
                              title="Quitar de esta zona"
                            >
                              {u.nombre}
                            </button>
                            <input
                              data-propio={propioObjetivo ? '1' : '0'}
                              inputMode="decimal"
                              defaultValue={f(p.objetivos?.[String(u.id)] ?? 0)}
                              aria-label={`Objetivo de ${p.nombre} en ${u.nombre}`}
                              title={propioObjetivo ? 'Objetivo propio de este perfil' : 'Objetivo heredado (0 por defecto)'}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={(e) => {
                                const v = e.target.value.replace(',', '.')
                                if (Number(v) === Number(p.objetivos?.[String(u.id)] ?? 0)) return
                                accion({
                                  accion: 'objetivo_ubicacion',
                                  productoId: p.id,
                                  ubicacionId: u.id,
                                  unidades: v,
                                })
                              }}
                            />
                          </span>
                        )
                      })}
                    </div>
                    {(() => {
                      const sumaZonas = p.zonas.reduce(
                        (a, uid) => a + (Number(p.objetivos?.[String(uid)]) || 0),
                        0
                      )
                      if (sumaZonas === 0) return null
                      const diff = sumaZonas - Number(p.par)
                      const cuadra = Math.abs(diff) < 0.01
                      return (
                        <p
                          style={{
                            margin: '6px 0 0',
                            fontSize: 11.5,
                            color: cuadra ? 'var(--dim)' : 'var(--warn)',
                          }}
                        >
                          Suma de zonas: {f(sumaZonas)} · Par: {f(p.par)}
                          {!cuadra && (diff < 0 ? ` — faltan ${f(-diff)}` : ` — sobran ${f(diff)}`)}
                        </p>
                      )
                    })()}
                  </div>
                </Fragment>
              )
            })}
            {productos.length === 0 && <p className="stka-msg">Ningún producto coincide.</p>}
          </>
        )}
      </div>

      <div className="stka-bar">
        <span>
          <b>{productos.length}</b> productos · <b>{propios}</b> propios
        </span>
        <span style={{ display: 'flex', gap: 7 }}>
          {actual && actual.padre && (
            <button
              onClick={async () => {
                if (!confirm(`¿Copiar todos los valores de ${actual.padre} a ${actual.nombre}?`)) return
                const padre = d?.perfiles.find((x) => x.id === actual.hereda_de)
                if (padre) await accion({ accion: 'copiar', origen: padre.id, destino: actual.id })
              }}
            >
              Copiar del padre
            </button>
          )}
          <button
            disabled={aplicando}
            style={{ background: 'var(--acc)', borderColor: 'var(--acc)', color: '#08111c' }}
            onClick={async () => {
              if (
                !confirm(
                  `¿Aplicar los valores de «${actual?.nombre}» a la jornada de hoy?\n\n` +
                    'Actualiza el par de referencia de hoy (que es el stock inicial de cada línea, ' +
                    'salvo que la hayas fijado a mano) y el pedido sugerido, y da de alta los ' +
                    'productos nuevos.'
                )
              )
                return
              setAplicando(true)
              setAviso(null)
              try {
                const r = await fetch('/api/stock/ajustes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ accion: 'aplicar', perfilId: perfil, usarPerfil: true }),
                })
                const j = await r.json()
                const x = j?.data
                if (!r.ok || x?.error) throw new Error(x?.error || j?.error || 'no se pudo aplicar')
                setAviso(
                  `Jornada del ${x.fecha} actualizada con el perfil ${x.perfil}: ` +
                    `${x.par_actualizado} stock inicial cambiado, ${x.anadidos} productos añadidos, ` +
                    `${x.quitados} quitados. ${x.total} referencias en la hoja.` +
                    (x.contados_fuera_de_zona
                      ? ` Ojo: ${x.contados_fuera_de_zona} ya contados siguen en la hoja aunque su zona esté apagada.`
                      : '')
                )
              } catch (e: any) {
                setAviso('No se pudo aplicar: ' + e.message)
              } finally {
                setAplicando(false)
              }
            }}
          >
            {aplicando ? 'Aplicando…' : 'Aplicar a hoy'}
          </button>
        </span>
      </div>
    </div>
  )
}
