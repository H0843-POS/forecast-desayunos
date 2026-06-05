import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Topbar */}
      <div style={{
        background: '#1a1916',
        color: '#f5f4f0',
        padding: '0 2rem',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', opacity: 0.9 }}>
          NOVOTEL · IBIS
        </span>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: 13, opacity: 0.6 }}>Herramientas F&amp;B</span>
      </div>

      {/* Hero */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
      }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 12 }}>
          Madrid City Las Ventas
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 8, textAlign: 'center' }}>
          ¿Qué herramienta necesitas?
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 48, textAlign: 'center' }}>
          Selecciona una de las dos aplicaciones disponibles
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          width: '100%',
          maxWidth: 680,
        }}>
          {/* Forecast */}
          <Link href="/forecast" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#1a1916',
              color: '#f5f4f0',
              borderRadius: 12,
              padding: '2rem 1.75rem',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{
                width: 44, height: 44,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', opacity: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  App 01
                </div>
                <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 6 }}>Previsión de ocupación y desayunos contratados</div>
                <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
                  Consulta la ocupación prevista y los desayunos contratados. Sube los RTF de Novotel e Ibis y obtén la tabla combinada.
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 12, opacity: 0.45, fontFamily: 'var(--mono)' }}>
                forecast-desayunos.vercel.app/forecast →
              </div>
            </div>
          </Link>

          {/* Prefacturación */}
          <Link href="/prefacturacion" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '2rem 1.75rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#1a1916'
              e.currentTarget.style.boxShadow = '0 0 0 1px #1a1916'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            >
              <div style={{
                width: 44, height: 44,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                  <path d="M8 8h2M8 12h2M8 16h2M14 8h2M14 12h2M14 16h2"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  App 02
                </div>
                <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 6 }}>Prefacturación</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Cálculo de desayunos a facturar por hotel. Importes por código de paquete, ajuste y totales.
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                forecast-desayunos.vercel.app/prefacturacion →
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '1.5rem',
        textAlign: 'center',
        fontSize: 11,
        fontFamily: 'var(--mono)',
        color: 'var(--text-faint)',
        borderTop: '1px solid var(--border)',
      }}>
        Novotel + Ibis Styles Madrid City Las Ventas · F&amp;B Tools
      </div>
    </div>
  )
}
