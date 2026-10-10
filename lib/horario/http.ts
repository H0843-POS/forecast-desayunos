import { NextRequest, NextResponse } from 'next/server'
import { ErrorValidacion } from './validate'
import { SESSION_COOKIE, verifySessionToken } from './session'

// Envoltorio común para las rutas: errores de validación → 400,
// errores de BD → 500 con mensaje genérico (el detalle va al log de Vercel).

export async function leerJson(req: NextRequest): Promise<unknown> {
  const ct = req.headers.get('content-type') || ''
  if (!ct.includes('application/json')) throw new ErrorValidacion('Se esperaba JSON')
  try {
    return await req.json()
  } catch {
    throw new ErrorValidacion('JSON no válido')
  }
}

// Además del middleware, cada ruta vuelve a comprobar la sesión (defensa en
// profundidad: si algún día el middleware falla o se salta, la API sigue cerrada).
export function handler<A extends [NextRequest, ...unknown[]]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    if (!(await verifySessionToken(args[0].cookies.get(SESSION_COOKIE)?.value))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    try {
      return await fn(...args)
    } catch (e) {
      if (e instanceof ErrorValidacion) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      console.error('[horario]', e)
      return NextResponse.json({ error: 'Error interno al guardar o leer datos' }, { status: 500 })
    }
  }
}

export function dbCheck(error: { message: string; code?: string } | null) {
  if (!error) return
  if (error.code === '23505') throw new ErrorValidacion('Ya existe un registro con esos datos')
  if (error.code === '23503') throw new ErrorValidacion('Referencia no válida (empleado o turno inexistente)')
  if (error.code === '23514') throw new ErrorValidacion('Datos fuera de rango')
  throw new Error(error.message)
}

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data)
