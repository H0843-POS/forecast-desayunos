import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Forecast Desayunos — Novotel + Ibis',
  description: 'Herramienta de forecast de desayunos contratados',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{children}</body>
    </html>
  )
}

