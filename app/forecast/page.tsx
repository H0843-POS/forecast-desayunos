'use client'
import { useEffect } from 'react'
import Link from 'next/link'

// Esta página es un placeholder — aquí irá la app de forecast existente
// Por ahora muestra la misma interfaz que tenías antes
export default function ForecastPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: '#1a1916', color: '#f5f4f0', padding: '0 2rem', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 12, fontFamily: 'var(--mono)' }}>← Inicio</Link>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, opacity: 0.9 }}>NOVOTEL · IBIS</span>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: 13, opacity: 0.6 }}>Previsión de ocupación y desayunos contratados</span>
      </div>
      <div style={{ maxWidth: 700, margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 12 }}>App 01</p>
        <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 16 }}>Previsión de ocupación y desayunos contratados</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.7 }}>
          Aquí irá integrada la app de forecast de ocupación y desayunos contratados.<br/>
          Por ahora puedes seguir usando la versión anterior.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          Pendiente de migrar el código del forecast original a esta estructura.
        </p>
      </div>
    </div>
  )
}
