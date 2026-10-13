// Previsión del tiempo para Las Ventas (Madrid) — Open-Meteo, gratuito y sin clave.
// Códigos WMO → icono y texto en español.

export interface TiempoDia {
  fecha: string
  codigo: number
  max: number | null
  min: number | null
  /** probabilidad máxima de lluvia del día, % */
  lluvia: number | null
  /** lluvia acumulada prevista, mm */
  mm: number | null
}

export const LAS_VENTAS = { lat: 40.4319, lon: -3.6635 }

const WMO: [number[], string, string][] = [
  [[0], '☀️', 'Despejado'],
  [[1], '🌤️', 'Casi despejado'],
  [[2], '⛅', 'Nubes y claros'],
  [[3], '☁️', 'Nublado'],
  [[45, 48], '🌫️', 'Niebla'],
  [[51, 53, 55, 56, 57], '🌦️', 'Llovizna'],
  [[61, 63, 66, 80, 81], '🌧️', 'Lluvia'],
  [[65, 67, 82], '🌧️', 'Lluvia fuerte'],
  [[71, 73, 75, 77, 85, 86], '🌨️', 'Nieve'],
  [[95, 96, 99], '⛈️', 'Tormenta'],
]

export function describirTiempo(codigo: number): { icono: string; texto: string } {
  const f = WMO.find(([cs]) => cs.includes(codigo))
  return f ? { icono: f[1], texto: f[2] } : { icono: '·', texto: '—' }
}

/** Texto sin emoji (para el PDF, que no admite emojis) */
export function textoCorto(t: TiempoDia): string {
  const d = describirTiempo(t.codigo).texto
  const temp = t.max != null && t.min != null ? ` ${Math.round(t.min)}/${Math.round(t.max)}º` : ''
  const ll = t.lluvia != null && t.lluvia >= 30 ? ` · lluvia ${t.lluvia}%` : ''
  return `${d}${temp}${ll}`
}

/** ¿Afecta a la terraza? lluvia probable o tormenta */
export function malaTerraza(t: TiempoDia): boolean {
  return (t.lluvia ?? 0) >= 50 || [65, 67, 82, 95, 96, 99].includes(t.codigo)
}
