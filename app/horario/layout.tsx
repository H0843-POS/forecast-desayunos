'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import './horario.css'

const NAV = [
  { href: '/horario', label: 'Mensual' },
  { href: '/horario/semana', label: 'Semana · extras y ajustes' },
  { href: '/horario/plantilla', label: 'Plantilla' },
  { href: '/horario/calendario', label: 'Festivos, ciudad y reglas' },
]

export default function HorarioLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  if (path === '/horario/login') return <>{children}</>

  async function salir() {
    await fetch('/api/horario-auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="hr-top">
        <Link href="/" className="hr-brand">NOVOTEL · IBIS</Link>
        <div className="hr-sep" />
        <span style={{ fontSize: 13, opacity: 0.6 }}>Horario restaurante</span>
        <div className="hr-sep" />
        <nav className="hr-nav">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={path === n.href ? 'on' : ''}>{n.label}</Link>
          ))}
        </nav>
        <div className="hr-sp" />
        <button className="hr-btn-ghost" onClick={salir}>Cerrar sesión</button>
      </div>
      {children}
    </div>
  )
}
