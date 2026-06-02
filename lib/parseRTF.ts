export interface DayData {
  fecha: string
  iso: string
  dia: string
  rooms: number
  adults: number
  children: number
  bkf: number
}

export interface ForecastData {
  hotel: string
  days: DayData[]
}

const DIAS: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb'
}

function dayName(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return DIAS[d.getDay()]
}

export function parseRTFBuffer(buf: Buffer): ForecastData {
  let text = buf.toString('latin1')
  text = text.replace(/\\u(\d+)G/g, (_, code) => String.fromCharCode(parseInt(code)))
  text = text.replace(/\\[a-zA-Z]+[-]?\d*[ ]?/g, ' ')
  text = text.replace(/[{}]/g, ' ')
  text = text.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n')
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== '*' && l !== ';')

  const hotel = lines.find(l => l.includes('Novotel') || l.includes('Ibis')) || 'Hotel'

  const dateRe = /^(\d{2})\.(\d{2})\.(\d{2})$/
  const dates: { iso: string; label: string }[] = []
  const seen = new Set<string>()
  for (const l of lines) {
    if (dateRe.test(l)) {
      const [, d, m, y] = l.match(dateRe)!
      const iso = `20${y}-${m}-${d}`
      if (!seen.has(iso)) { seen.add(iso); dates.push({ iso, label: `${d}/${m}` }) }
    }
  }
  const dataDates = dates.slice(1, 16)

  function collectAfter(keyword: string, count: number): number[] {
    const idx = lines.findIndex(l => l === keyword)
    if (idx === -1) return new Array(count).fill(0)
    const nums: number[] = []
    for (let i = idx + 1; i < lines.length && nums.length < count; i++) {
      if (/^\d+$/.test(lines[i])) nums.push(parseInt(lines[i]))
    }
    return nums
  }

  const bkf = collectAfter('BKF', 15)
  const rooms = collectAfter('Occ.', 15)

  const adultsIdx = lines.findIndex(l => l === 'Adults')
  const adults: number[] = []
  const children: number[] = []
  for (let i = adultsIdx + 1; i < lines.length && children.length < 15; i++) {
    if (/^\d+$/.test(lines[i])) {
      const n = parseInt(lines[i])
      if (adults.length < 15) adults.push(n)
      else children.push(n)
    }
  }

  const days: DayData[] = dataDates.map((dt, i) => ({
    fecha: dt.label, iso: dt.iso, dia: dayName(dt.iso),
    rooms: rooms[i] ?? 0, adults: adults[i] ?? 0,
    children: children[i] ?? 0, bkf: bkf[i] ?? 0,
  }))

  return { hotel, days }
}

export function parseRTFText(text: string): ForecastData {
  return parseRTFBuffer(Buffer.from(text, 'latin1'))
}

export function shiftDayForward(day: DayData): DayData {
  const d = new Date(day.iso + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const iso = `${d.getFullYear()}-${mm}-${dd}`
  return { ...day, fecha: `${dd}/${mm}`, iso, dia: DIAS[d.getDay()] }
}
