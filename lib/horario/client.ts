'use client'
// Llamadas del navegador a la API del Horario.

export class ApiError extends Error {
  constructor(msg: string, public status: number) { super(msg) }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (res.status === 401) {
    window.location.href = '/horario/login'
    throw new ApiError('Sesión caducada', 401)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.error || `Error ${res.status}`, res.status)
  return data as T
}

export const api = {
  get: <T>(url: string) => req<T>('GET', url),
  post: <T>(url: string, body: unknown) => req<T>('POST', url, body),
  del: <T>(url: string) => req<T>('DELETE', url),
}
