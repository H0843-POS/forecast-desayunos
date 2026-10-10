// Sesión del módulo Horario: cookie firmada con HMAC-SHA256.
// Usa solo Web Crypto, así funciona igual en el middleware (edge) y en las
// rutas API (node). La clave incluye la contraseña: si cambias
// HORARIO_PASSWORD en Vercel, todas las sesiones abiertas caducan.

export const SESSION_COOKIE = 'hr_session'
export const SESSION_HOURS = 12

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function sessionConfigOk(): boolean {
  const pw = process.env.HORARIO_PASSWORD
  const secret = process.env.HORARIO_SESSION_SECRET
  return !!pw && pw.length >= 8 && !!secret && secret.length >= 32
}

async function hmacKey(): Promise<CryptoKey> {
  const material = `${process.env.HORARIO_SESSION_SECRET}|${process.env.HORARIO_PASSWORD}`
  return crypto.subtle.importKey(
    'raw',
    enc.encode(material),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey()
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
}

// Comparación en tiempo constante de dos strings hex de igual longitud
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000
  const payload = `hr|${exp}`
  return `${exp}.${await sign(payload)}`
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !sessionConfigOk()) return false
  const m = /^(\d{13})\.([0-9a-f]{64})$/.exec(token)
  if (!m) return false
  const exp = Number(m[1])
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = await sign(`hr|${exp}`)
  return safeEqual(expected, m[2])
}

export async function passwordMatches(input: string): Promise<boolean> {
  const real = process.env.HORARIO_PASSWORD
  if (!real || typeof input !== 'string' || input.length > 200) return false
  // Hash de ambos para comparar longitudes iguales en tiempo constante
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(input)),
    crypto.subtle.digest('SHA-256', enc.encode(real)),
  ])
  return safeEqual(toHex(a), toHex(b))
}
