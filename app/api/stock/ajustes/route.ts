import { NextResponse } from 'next/server'
import { supabaseStock } from '@/lib/supabaseStock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const num = (v: any) =>
  v === undefined || v === null || v === '' ? null : Number(String(v).replace(',', '.'))

// GET  /api/stock/ajustes[?perfil=ID]            -> ajustes normales
// GET  /api/stock/ajustes?inactivos=1             -> productos eliminados (para reactivar)
// GET  /api/stock/ajustes?categorias=1            -> categorias/subcategorias (para el alta)
// POST acciones: par | heredar | objetivo_ubicacion | objetivo_ubicacion_heredar | zona | grupo
//                | perfil | copiar | cal_add | cal_del | eliminar_producto | reactivar_producto
//                | crear_producto
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    if (url.searchParams.get('inactivos')) {
      const { data, error } = await supabaseStock.rpc('stk_productos_inactivos')
      if (error) {
        return NextResponse.json(
          { error: 'Error de base de datos', detalle: error.message },
          { status: 500 }
        )
      }
      return NextResponse.json(data)
    }
    if (url.searchParams.get('categorias')) {
      const { data, error } = await supabaseStock.rpc('stk_categorias_listado')
      if (error) {
        return NextResponse.json(
          { error: 'Error de base de datos', detalle: error.message },
          { status: 500 }
        )
      }
      return NextResponse.json(data)
    }
    const perfil = url.searchParams.get('perfil')
    const { data, error } = await supabaseStock.rpc('stk_ajustes', {
      p_perfil: perfil ? Number(perfil) : null,
    })
    if (error) {
      return NextResponse.json(
        { error: 'Error de base de datos', detalle: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Fallo inesperado', detalle: String(e?.message || e) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  let b: any
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no valido' }, { status: 400 })
  }

  const rpc = async (fn: string, args: any) => {
    const { data, error } = await supabaseStock.rpc(fn, args)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  const perfil = Number(b?.perfilId)

  switch (b?.accion) {
    case 'par': {
      const u = num(b.unidades)
      if (u === null || u < 0 || !Number.isFinite(u)) {
        return NextResponse.json({ error: 'Cantidad no valida' }, { status: 400 })
      }
      return rpc('stk_par_set', {
        p_perfil: perfil,
        p_producto: Number(b.productoId),
        p_unidades: u,
      })
    }

    case 'heredar':
      return rpc('stk_par_heredar', { p_perfil: perfil, p_producto: Number(b.productoId) })

    case 'objetivo_ubicacion': {
      const u = num(b.unidades)
      if (u === null || u < 0 || !Number.isFinite(u)) {
        return NextResponse.json({ error: 'Cantidad no valida' }, { status: 400 })
      }
      return rpc('stk_par_ubicacion_set', {
        p_perfil: perfil,
        p_producto: Number(b.productoId),
        p_ubicacion: Number(b.ubicacionId),
        p_unidades: u,
      })
    }

    case 'objetivo_ubicacion_heredar':
      return rpc('stk_par_ubicacion_heredar', {
        p_perfil: perfil,
        p_producto: Number(b.productoId),
        p_ubicacion: Number(b.ubicacionId),
      })

    case 'zona':
      return rpc('stk_zona_set', {
        p_perfil: perfil,
        p_producto: Number(b.productoId),
        p_ubicacion: Number(b.ubicacionId),
        p_activa: !!b.activa,
      })

    case 'grupo':
      return rpc('stk_zona_grupo_id', {
        p_perfil: perfil,
        p_categoria: String(b.categoria),
        p_seccion: b.seccion ? String(b.seccion) : null,
        p_ubicacion: Number(b.ubicacionId),
        p_activa: !!b.activa,
      })

    case 'perfil':
      return rpc('stk_perfil_crear', {
        p_nombre: String(b.nombre || '').slice(0, 60),
        p_hereda_de: b.heredaDe ? Number(b.heredaDe) : null,
      })

    case 'copiar':
      return rpc('stk_perfil_copiar_par', {
        p_origen: Number(b.origen),
        p_destino: Number(b.destino),
      })

    case 'cal_add':
      return rpc('stk_calendario_add', {
        p_perfil: perfil,
        p_desde: String(b.desde),
        p_hasta: String(b.hasta),
        p_prioridad: Number(b.prioridad) || 0,
      })

    case 'aplicar':
      return rpc('stk_jornada_resincronizar', {
        p_fecha: b.fecha ? String(b.fecha) : null,
        p_perfil: b.usarPerfil ? perfil : null,
      })

    case 'cal_del':
      return rpc('stk_calendario_del', { p_id: Number(b.id) })

    case 'eliminar_producto': {
      const pid = Number(b.productoId)
      if (!Number.isFinite(pid)) {
        return NextResponse.json({ error: 'Producto no valido' }, { status: 400 })
      }
      return rpc('stk_producto_desactivar', { p_producto_id: pid })
    }

    case 'reactivar_producto': {
      const pid = Number(b.productoId)
      if (!Number.isFinite(pid)) {
        return NextResponse.json({ error: 'Producto no valido' }, { status: 400 })
      }
      return rpc('stk_producto_reactivar', { p_producto_id: pid })
    }

    case 'crear_producto': {
      const nombre = String(b.nombre || '').trim().slice(0, 120)
      const cat = String(b.categoriaCodigo || '').trim()
      if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
      if (!cat) return NextResponse.json({ error: 'Falta la categoria' }, { status: 400 })
      return rpc('stk_producto_crear', {
        p_nombre: nombre,
        p_categoria_codigo: cat,
        p_subcategoria_nombre: b.subcategoria ? String(b.subcategoria).trim().slice(0, 80) : null,
      })
    }

    default:
      return NextResponse.json({ error: 'Accion desconocida' }, { status: 400 })
  }
}
