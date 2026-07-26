import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const esc = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

// POST /api/stock/pedido/email   { pedidoId, quien?, para?, copia? }
// Envia el pedido con Resend y SOLO si el envio sale bien lo marca como enviado.
export async function POST(req: Request) {
  let b: any
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }

  const pedidoId = Number(b?.pedidoId)
  if (!Number.isFinite(pedidoId)) {
    return NextResponse.json({ error: 'Falta pedidoId' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Falta RESEND_API_KEY en las variables de entorno' },
      { status: 500 }
    )
  }

  // El contenido se arma en el servidor desde la base de datos: se envia lo
  // que hay guardado, no lo que el navegador diga tener.
  const { data: doc, error: e1 } = await supabaseStock.rpc('stk_pedido_texto', {
    p_pedido_id: pedidoId,
  })
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (!doc) return NextResponse.json({ error: 'El pedido no existe' }, { status: 404 })
  if (!doc.lineas) {
    return NextResponse.json({ error: 'El pedido no tiene lineas' }, { status: 400 })
  }

  const { data: cfg } = await supabaseStock.rpc('stk_config_get')

  const para = String(b?.para || cfg?.email_economato || '').trim()
  const copia = String(b?.copia ?? cfg?.email_copia ?? '').trim()
  const from = String(cfg?.email_from || process.env.PEDIDO_FROM || '').trim()

  if (!emailValido(para)) {
    return NextResponse.json(
      { error: 'Falta el email del economato o no es valido' },
      { status: 400 }
    )
  }
  if (!from) {
    return NextResponse.json(
      { error: 'Falta el remitente. Configuralo en la pantalla de pedido o en PEDIDO_FROM' },
      { status: 500 }
    )
  }

  // --- cuerpo ---
  const filas: any[] = doc.filas || []
  let cat = ''
  const tr = filas
    .map((r) => {
      const cabecera =
        r.categoria !== cat
          ? ((cat = r.categoria),
            `<tr><td colspan="2" style="padding:14px 10px 4px;font:600 11px/1.4 system-ui,sans-serif;
             letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${esc(r.categoria)}</td></tr>`)
          : ''
      const cant = `${String(r.unidades).replace(/\.?0+$/, '')}${r.unidad ? ' ' + esc(r.unidad) : ''}`
      return (
        cabecera +
        `<tr>
           <td style="padding:7px 10px;border-bottom:1px solid #eceef1;font:600 15px/1.3 system-ui,sans-serif;
             color:#111827;white-space:nowrap;width:1%">${esc(cant)}</td>
           <td style="padding:7px 10px;border-bottom:1px solid #eceef1;font:400 15px/1.3 system-ui,sans-serif;
             color:#111827">${esc(r.producto)}</td>
         </tr>`
      )
    })
    .join('')

  const html = `<div style="background:#f6f7f9;padding:24px 12px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb">
      <div style="font:650 17px/1.3 system-ui,sans-serif;color:#111827">Pedido a economato</div>
      <div style="font:400 13px/1.5 system-ui,sans-serif;color:#6b7280;margin-top:3px">
        Novotel &amp; Ibis Las Ventas · ${esc(doc.fecha)}${b?.quien ? ' · ' + esc(b.quien) : ''}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">${tr}</table>
    <div style="padding:14px 20px;border-top:1px solid #e5e7eb;font:400 12px/1.5 system-ui,sans-serif;color:#6b7280">
      ${doc.lineas} ${doc.lineas === 1 ? 'linea' : 'lineas'}. Enviado desde el control de stock de restauracion.
    </div>
  </div>
</div>`

  const texto = `Pedido a economato — ${doc.fecha}${b?.quien ? ` (${b.quien})` : ''}\n${doc.texto}`

  // --- envio ---
  let idEmail: string | null = null
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [para],
        ...(emailValido(copia) ? { cc: [copia] } : {}),
        subject: `Pedido economato — ${doc.fecha}`,
        html,
        text: texto,
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      return NextResponse.json(
        { error: 'Resend rechazo el envio', detalle: j?.message || `HTTP ${r.status}` },
        { status: 502 }
      )
    }
    idEmail = j?.id ?? null
  } catch (e: any) {
    return NextResponse.json(
      { error: 'No se pudo contactar con Resend', detalle: String(e?.message || e) },
      { status: 502 }
    )
  }

  // Solo se marca como enviado si el correo salio de verdad
  const { error: e2 } = await supabaseStock.rpc('stk_pedido_enviar', {
    p_pedido_id: pedidoId,
    p_quien: b?.quien ? String(b.quien).slice(0, 80) : null,
    p_a: [para, emailValido(copia) ? copia : null].filter(Boolean).join(', '),
    p_texto: texto,
    p_email_id: idEmail,
  })
  if (e2) {
    return NextResponse.json(
      { ok: true, aviso: 'El email salio, pero no se pudo marcar como enviado', detalle: e2.message },
      { status: 200 }
    )
  }

  return NextResponse.json({ ok: true, id: idEmail, para, copia: copia || null })
}
