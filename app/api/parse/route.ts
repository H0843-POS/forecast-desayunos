import { NextRequest, NextResponse } from 'next/server'
import { parseRTFBuffer } from '@/lib/parseRTF'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const novotelFile = formData.get('novotel') as File | null
  const ibisFile = formData.get('ibis') as File | null

  if (!novotelFile || !ibisFile) {
    return NextResponse.json({ error: 'Faltan archivos' }, { status: 400 })
  }

  try {
    const [novotelBuf, ibisBuf] = await Promise.all([
      novotelFile.arrayBuffer(),
      ibisFile.arrayBuffer(),
    ])

    const novotel = parseRTFBuffer(Buffer.from(novotelBuf))
    const ibis = parseRTFBuffer(Buffer.from(ibisBuf))

    return NextResponse.json({ novotel, ibis })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
