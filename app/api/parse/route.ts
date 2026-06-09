import { NextRequest, NextResponse } from 'next/server'
import { parseRTFBuffer, parseHTMLBuffer } from '@/lib/parseRTF'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const novotelFile = formData.get('novotel') as File | null
  const ibisFile = formData.get('ibis') as File | null

  if (!novotelFile || !ibisFile) {
    return NextResponse.json({ error: 'Faltan archivos' }, { status: 400 })
  }

  function parseBuffer(buf: Buffer, filename: string) {
    const ext = filename.toLowerCase().split('.').pop()
    if (ext === 'html' || ext === 'htm') return parseHTMLBuffer(buf)
    return parseRTFBuffer(buf)
  }

  try {
    const [novotelBuf, ibisBuf] = await Promise.all([
      novotelFile.arrayBuffer(),
      ibisFile.arrayBuffer(),
    ])

    const novotel = parseBuffer(Buffer.from(novotelBuf), novotelFile.name)
    const ibis = parseBuffer(Buffer.from(ibisBuf), ibisFile.name)

    return NextResponse.json({ novotel, ibis })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
