import { Router, type Request, type Response } from 'express'
import { getApiKey } from '../server'

type OcrBody = {
  base64Image?: unknown
  mimeType?: unknown
}

export type OcrResult = {
  vendor: string
  amount: number
  date: string
  description: string
  confidence: number
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4-5'

function fallback(): OcrResult {
  return { vendor: '', amount: 0, date: '', description: '', confidence: 0 }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(body)
  } catch {
    const match = body.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { return null }
    }
    return null
  }
}

function coerceResult(raw: unknown): OcrResult | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const vendor = typeof obj.vendor === 'string' ? obj.vendor.trim() : null
  const amount = typeof obj.amount === 'number' ? obj.amount : null
  const date = typeof obj.date === 'string' ? obj.date.trim() : null
  const description = typeof obj.description === 'string' ? obj.description.trim() : ''
  const confidence =
    typeof obj.confidence === 'number'
      ? Math.max(0, Math.min(1, obj.confidence))
      : null

  if (vendor === null || amount === null || date === null || confidence === null)
    return null

  return { vendor, amount, date, description, confidence }
}

export const ocrRouter = Router()

ocrRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as OcrBody
  const base64Image =
    typeof body.base64Image === 'string' ? body.base64Image : null
  const mimeType =
    typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg'

  if (!base64Image) {
    res.status(400).json({ error: 'base64Image is required' })
    return
  }

  const apiKey = getApiKey().trim()
  if (!apiKey) {
    res.json(fallback())
    return
  }

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://authorbooks.app',
        'X-Title': 'AuthorBooks',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64Image },
              },
              {
                type: 'text',
                text: `Extract receipt details from this image. Respond only with valid JSON, no markdown:
{
  "vendor": "merchant or store name",
  "amount": 12.34,
  "date": "YYYY-MM-DD",
  "description": "brief description of purchase",
  "confidence": 0.0
}
If a field cannot be determined use empty string or 0. Amount must be a number in dollars. Date must be YYYY-MM-DD.`,
              },
            ],
          },
        ],
      }),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      throw new Error(`OpenRouter ${upstream.status}: ${text.slice(0, 200)}`)
    }

    const json = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('No content in response')

    const parsed = extractJson(content)
    const result = coerceResult(parsed)
    res.json(result ?? fallback())
  } catch (e) {
    console.error('[ocr] failed:', e)
    res.json(fallback())
  }
})
