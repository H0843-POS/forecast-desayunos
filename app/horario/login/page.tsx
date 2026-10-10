'use client'
import Link from 'next/link'
import { useState } from 'react'
import '../horario.css'

export default function LoginHorario() {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/horario-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo entrar')
      window.location.href = '/horario'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar')
      setPw('')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div className="hr-top">
        <Link href="/" className="hr-brand">NOVOTEL · IBIS</Link>
        <div className="hr-sep" />
        <span style={{ fontSize: 13, opacity: 0.6 }}>Horario restaurante</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <form onSubmit={entrar} className="hr-card" style={{ width: '100%', maxWidth: 340, display: 'grid', gap: 14, padding: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Acceso restringido</div>
            <div className="hr-muted">El horario contiene datos del personal.</div>
          </div>
          {error && <div className="hr-error" style={{ margin: 0 }}>{error}</div>}
          <label className="hr-lab">
            Contraseña
            <input
              className="hr-input"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              style={{ fontSize: 15, padding: '8px 10px' }}
            />
          </label>
          <button className="hr-btn pri" disabled={!pw || cargando} style={{ padding: '9px 12px' }}>
            {cargando ? 'Comprobando…' : 'Entrar'}
          </button>
          <Link href="/" className="hr-muted" style={{ textAlign: 'center' }}>← Volver al inicio</Link>
        </form>
      </div>
    </div>
  )
}
