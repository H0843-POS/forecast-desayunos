'use client'

/** De qué forecast sale la ocupación y cuántos días quedan sin dato */
export function OcupacionInfo({ fechas, ocupacion }: { fechas: string[]; ocupacion: Record<string, { cargado?: string; fuente: string }> }) {
  const cargas = fechas.map(f => ocupacion[f]?.cargado).filter(Boolean) as string[]
  const ultima = cargas.sort().pop()
  const sin = fechas.filter(f => !ocupacion[f]).length
  return (
    <span className={`hr-pill ${sin ? 'warn' : ''}`} title="La ocupación se coge sola del último forecast subido en «Previsión de ocupación». Para actualizarla, sube los RTF de nuevo allí.">
      Ocupación: {ultima ? `forecast del ${new Date(ultima).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'sin forecast'}
      {sin ? ` · ${sin} días sin dato` : ''} · <a href="/forecast" style={{ color: 'inherit' }}>subir nuevo</a>
    </span>
  )
}
