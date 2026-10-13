// Actualización diaria: partidos (football-data) + grandes conciertos (Ticketmaster).
// Si una fuente falla, la otra se guarda igual.
import { db } from './db'
import { sincronizarPartidos } from './partidos'
import { sincronizarTicketmaster } from './ticketmaster'

export async function sincronizarTodo() {
  const seguro = async <T extends { ok: boolean; mensaje: string; borrados: number }>(f: () => Promise<T>, nombre: string) => {
    try { return await f() } catch (e) {
      console.error(`[sync ${nombre}]`, e)
      return { ok: false, importados: 0, borrados: 0, mensaje: "error al actualizar" } as unknown as T
    }
  }
  const [p, t] = await Promise.all([seguro(sincronizarPartidos, 'Partidos'), seguro(sincronizarTicketmaster, 'Conciertos')])
  const mensaje = `Partidos: ${p.mensaje} · Conciertos: ${t.mensaje}`
  await db().from('hr_config').upsert({ clave: 'partidos_sync', valor: { at: new Date().toISOString(), mensaje } })
  return { ok: p.ok || t.ok, mensaje, borrados: p.borrados + t.borrados, partidos: p, conciertos: t }
}
