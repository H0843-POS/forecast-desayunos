'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/horario/client'
import { addDays, fmtH, iso, type Empleado, type Turno } from '@/lib/horario/core'
import { useDatos } from '../_lib/useDatos'

interface Libres {
  libres_por_semana: number
  empleados: { empleado_id: string; nombre: string; activo: boolean; pendientes: { semana: number; lunes: string; faltan: number }[]; total: number }[]
}

interface Bolsa {
  anio: number
  empleados: { empleado_id: string; nombre: string; activo: boolean; inicial: number; trabajados: { fecha: string; nombre: string }[]; devueltos: string[]; saldo: number }[]
}

const hoy = iso(new Date())

export default function Plantilla() {
  const { datos, error, setError, guardando, guardarRecurso } = useDatos(hoy, hoy, hoy, addDays(hoy, 1))
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [bolsa, setBolsa] = useState<Bolsa | null>(null)
  const [libres, setLibres] = useState<Libres | null>(null)

  const cargarBolsa = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([api.get<Bolsa>(`/api/horario/bolsa?anio=${anio}`), api.get<Libres>(`/api/horario/libres?anio=${anio}`)])
      setBolsa(b); setLibres(l)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }, [anio, setError])
  useEffect(() => { cargarBolsa() }, [cargarBolsa])

  async function guardarEmp(e: Partial<Empleado>) {
    await guardarRecurso('empleados', e).then(cargarBolsa).catch(() => {})
  }

  return (
    <div className="hr-page">
      <div className="hr-bar"><h1>Plantilla y turnos</h1>{guardando && <span className="hr-pill">Guardando…</span>}</div>
      {error && <div className="hr-error">{error} <button className="hr-link" onClick={() => setError('')}>cerrar</button></div>}
      {datos && (
        <div className="hr-cols">
          <div className="hr-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Empleados</h2>
            <p className="hr-muted" style={{ marginBottom: 8 }}>
              «Extra» es para extras habituales con nombre (Dani, Nacho…): salen en el horario pero sin control de contrato.
              Los ETT sin nombre se apuntan como extras en la hoja semanal. El orden decide la fila en el horario.
            </p>
            <table className="hr-tabla">
              <thead><tr><th>Orden</th><th>Nombre</th><th>Tipo</th><th>Horas/semana</th><th>Festivos debidos al empezar el año</th><th>Notas</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {datos.empleados.map(e => <FilaEmpleado key={e.id + String(e.activo)} e={e} onSave={guardarEmp} />)}
                <FilaEmpleado key={`nuevo-${datos.empleados.length}`} onSave={guardarEmp} />
              </tbody>
            </table>
          </div>

          <div className="hr-card">
            <h2>Turnos</h2>
            <p className="hr-muted" style={{ marginBottom: 8 }}>
              El color sale de la hora de entrada: antes de las 12 rosa, de 12 a 15 blanco, desde las 15 verde.
              Para una excepción de un día no hace falta crear turno: usa «Otro horario» en la celda.
            </p>
            <table className="hr-tabla">
              <thead><tr><th>Código</th><th>Entrada</th><th>Salida</th><th>Orden</th><th>Activo</th><th /></tr></thead>
              <tbody>
                {datos.turnos.map(t => <FilaTurno key={t.codigo + t.inicio + t.fin + t.activo} t={t} onSave={b => guardarRecurso('turnos', b).catch(() => {})} />)}
                <FilaTurno key={`nuevo-${datos.turnos.length}`} onSave={b => guardarRecurso('turnos', b).catch(() => {})} />
              </tbody>
            </table>
          </div>

          <div className="hr-card">
            <h2>Libres que se deben · {anio}</h2>
            <p className="hr-muted" style={{ marginBottom: 8 }}>
              Cada semana completa le corresponden {libres?.libres_por_semana ?? 2} libres (L + nº de semana). Si quitáis uno, aparece aquí;
              para devolverlo, escribe ese código (p. ej. L40) el día que se lo deis.
            </p>
            {libres && libres.empleados.every(x => x.total === 0)
              ? <p className="hr-muted">No se debe ningún libre.</p>
              : (
                <table className="hr-tabla">
                  <thead><tr><th>Empleado</th><th>Se le deben</th><th>Total</th></tr></thead>
                  <tbody>
                    {libres?.empleados.filter(x => x.total > 0).map(x => (
                      <tr key={x.empleado_id}>
                        <td>{x.nombre}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{x.pendientes.map(p => `L${p.semana}${p.faltan > 1 ? ` ×${p.faltan}` : ''}`).join(', ')}</td>
                        <td><span className="hr-pill warn">{x.total}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>

          <div className="hr-card">
            <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Bolsa de festivos
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="hr-btn sm" onClick={() => setAnio(a => a - 1)}>←</button>
                <span className="hr-pill">{anio}</span>
                <button className="hr-btn sm" onClick={() => setAnio(a => a + 1)}>→</button>
              </span>
            </h2>
            <p className="hr-muted" style={{ marginBottom: 8 }}>Saldo = debidos al empezar + festivos trabajados − días B disfrutados.</p>
            <table className="hr-tabla">
              <thead><tr><th>Empleado</th><th>Inicial</th><th>Trabajados</th><th>B</th><th>Se le deben</th></tr></thead>
              <tbody>
                {bolsa?.empleados.filter(b => b.activo || b.trabajados.length || b.devueltos.length).map(b => (
                  <tr key={b.empleado_id}>
                    <td>{b.nombre}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{fmtH(b.inicial)}</td>
                    <td title={b.trabajados.map(t => `${t.fecha} ${t.nombre}`).join('\n')} style={{ fontFamily: 'var(--mono)' }}>{b.trabajados.length}</td>
                    <td title={b.devueltos.join('\n')} style={{ fontFamily: 'var(--mono)' }}>{b.devueltos.length}</td>
                    <td><span className={`hr-pill ${b.saldo > 0 ? 'warn' : b.saldo < 0 ? 'mal' : 'ok'}`}>{fmtH(b.saldo)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function FilaEmpleado({ e, onSave }: { e?: Empleado; onSave: (e: Partial<Empleado>) => Promise<void> }) {
  const [nombre, setNombre] = useState(e?.nombre ?? '')
  const [tipo, setTipo] = useState<Empleado['tipo']>(e?.tipo ?? 'plantilla')
  const [horas, setHoras] = useState(e?.horas_contrato != null ? String(e.horas_contrato) : '')
  const [orden, setOrden] = useState(String(e?.orden ?? ''))
  const [saldo, setSaldo] = useState(String(e?.saldo_festivos_inicial ?? '0'))
  const [notas, setNotas] = useState(e?.notas ?? '')
  const nuevo = !e
  const cambiado = nuevo
    ? !!nombre.trim()
    : nombre !== e.nombre || tipo !== e.tipo || horas !== (e.horas_contrato != null ? String(e.horas_contrato) : '') || orden !== String(e.orden) || saldo !== String(e.saldo_festivos_inicial) || notas !== (e.notas ?? '')

  function guardar(activo = e?.activo ?? true) {
    onSave({
      ...(e ? { id: e.id } : {}),
      nombre: nombre.trim(), tipo,
      horas_contrato: tipo === 'plantilla' && horas !== '' ? Number(horas.replace(',', '.')) : null,
      orden: orden === '' ? 0 : Number(orden),
      saldo_festivos_inicial: saldo === '' ? 0 : Number(saldo.replace(',', '.')),
      notas: notas.trim() || null,
      activo,
    })
    if (nuevo) { setNombre(''); setHoras(''); setOrden(''); setSaldo('0'); setNotas('') }
  }

  return (
    <tr style={e && !e.activo ? { opacity: 0.5 } : undefined}>
      <td><input className="hr-input" style={{ width: 56 }} inputMode="numeric" value={orden} onChange={x => setOrden(x.target.value)} placeholder="0" /></td>
      <td><input className="hr-input" style={{ width: 160 }} maxLength={60} value={nombre} onChange={x => setNombre(x.target.value)} placeholder={nuevo ? 'Nuevo empleado…' : ''} /></td>
      <td>
        <select className="hr-select" value={tipo} onChange={x => setTipo(x.target.value as Empleado['tipo'])}>
          <option value="plantilla">Plantilla</option>
          <option value="extra">Extra</option>
        </select>
      </td>
      <td>
        {tipo === 'plantilla'
          ? <select className="hr-select" value={horas} onChange={x => setHoras(x.target.value)}>
              <option value="">—</option>
              {['40', '35', '30', '25', '20', '16'].map(h => <option key={h} value={h}>{h} h</option>)}
              {horas && !['40', '35', '30', '25', '20', '16'].includes(horas) && <option value={horas}>{horas} h</option>}
            </select>
          : <span className="hr-muted">—</span>}
      </td>
      <td><input className="hr-input" style={{ width: 64 }} inputMode="decimal" value={saldo} onChange={x => setSaldo(x.target.value)} disabled={tipo !== 'plantilla'} /></td>
      <td><input className="hr-input" style={{ width: 200 }} maxLength={500} value={notas} onChange={x => setNotas(x.target.value)} placeholder="Le debemos…" title={notas} /></td>
      <td>{e ? (e.activo ? <span className="hr-pill ok">Activo</span> : <span className="hr-pill">De baja</span>) : ''}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="hr-btn sm pri" disabled={!cambiado || !nombre.trim()} onClick={() => guardar()}>{nuevo ? 'Añadir' : 'Guardar'}</button>
        {e && (
          <button className="hr-btn sm" style={{ marginLeft: 4 }}
            onClick={() => { if (e.activo ? confirm(`¿Dar de baja a ${e.nombre}? Su histórico se conserva.`) : true) guardar(!e.activo) }}>
            {e.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
        )}
      </td>
    </tr>
  )
}

function FilaTurno({ t, onSave }: { t?: Turno; onSave: (b: unknown) => void }) {
  const [codigo, setCodigo] = useState(t?.codigo ?? '')
  const [inicio, setInicio] = useState(t?.inicio ?? '')
  const [fin, setFin] = useState(t?.fin ?? '')
  const [orden, setOrden] = useState(String(t?.orden ?? ''))
  const [activo, setActivo] = useState(t?.activo ?? true)
  const nuevo = !t
  const cambiado = nuevo ? !!(codigo && inicio && fin) : inicio !== t.inicio || fin !== t.fin || orden !== String(t.orden) || activo !== t.activo
  return (
    <tr>
      <td>{nuevo
        ? <input className="hr-input" style={{ width: 64, fontFamily: 'var(--mono)' }} maxLength={5} value={codigo} onChange={x => setCodigo(x.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="Nuevo" />
        : <b style={{ fontFamily: 'var(--mono)' }}>{t.codigo}</b>}</td>
      <td><input className="hr-input" type="time" value={inicio} onChange={x => setInicio(x.target.value)} /></td>
      <td><input className="hr-input" type="time" value={fin} onChange={x => setFin(x.target.value)} /></td>
      <td><input className="hr-input" style={{ width: 48 }} inputMode="numeric" value={orden} onChange={x => setOrden(x.target.value)} /></td>
      <td><input type="checkbox" checked={activo} onChange={x => setActivo(x.target.checked)} /></td>
      <td>
        <button className="hr-btn sm pri" disabled={!cambiado} onClick={() => {
          onSave({ codigo, inicio, fin, orden: orden === '' ? 0 : Number(orden), activo })
          if (nuevo) { setCodigo(''); setInicio(''); setFin(''); setOrden('') }
        }}>{nuevo ? 'Añadir' : 'Guardar'}</button>
      </td>
    </tr>
  )
}
