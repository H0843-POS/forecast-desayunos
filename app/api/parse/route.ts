import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parseRTFText } from '@/lib/parseRTF'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const novotelFile = formData.get('novotel') as File | null
  const ibisFile = formData.get('ibis') as File | null

  if (!novotelFile || !ibisFile) {
    return NextResponse.json({ error: 'Faltan archivos' }, { status: 400 })
  }

  async function extractText(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer())
    const tmpPath = join(tmpdir(), `forecast_${Date.now()}_${Math.random().toString(36).slice(2)}.rtf`)
    writeFileSync(tmpPath, buffer)
    try {
      const out = execSync(`pandoc "${tmpPath}" -t plain 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 15000,
      })
      return out
    } finally {
      try { unlinkSync(tmpPath) } catch {}
    }
  }

  try {
    const [novotelText, ibisText] = await Promise.all([
      extractText(novotelFile),
      extractText(ibisFile),
    ])

    const novotel = parseRTFText(novotelText)
    const ibis = parseRTFText(ibisText)

    return NextResponse.json({ novotel, ibis })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
