import { Router, type Request, type Response } from 'express'
import { getApiKey } from '../server'

type CategorizeBody = {
  vendor?: unknown
  description?: unknown
  amount?: unknown
  categories?: unknown
}

type CategorizeResult = {
  suggestedCategory: string
  taxDeductible: boolean
  businessType: 'business' | 'personal'
  confidence: number
  reasoning: string
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4-5'
const CACHE_TTL_MS = 30 * 60 * 1000

type CacheEntry = { result: CategorizeResult; timestamp: number }
const cache = new Map<string, CacheEntry>()

export function clearCache(): void {
  cache.clear()
}

function fallback(categories: string[]): CategorizeResult {
  return {
    suggestedCategory: categories[0] ?? 'Other',
    taxDeductible: true,
    businessType: 'business',
    confidence: 0.5,
    reasoning: 'Could not determine — please categorize manually',
  }
}

function cacheKey(vendor: string, description: string): string {
  return `${vendor.toLowerCase().trim()}|${description.toLowerCase().trim()}`
}

function coerceResult(raw: unknown, categories: string[]): CategorizeResult | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const suggestedCategory =
    typeof obj.suggestedCategory === 'string' ? obj.suggestedCategory : null
  const taxDeductible =
    typeof obj.taxDeductible === 'boolean' ? obj.taxDeductible : null
  const businessType =
    obj.businessType === 'business' || obj.businessType === 'personal'
      ? obj.businessType
      : null
  const confidenceRaw =
    typeof obj.confidence === 'number' ? obj.confidence : null
  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : ''
  if (
    suggestedCategory === null ||
    taxDeductible === null ||
    businessType === null ||
    confidenceRaw === null
  ) {
    return null
  }
  const matched = categories.find(
    (c) => c.toLowerCase() === suggestedCategory.toLowerCase(),
  )
  const finalCategory = matched ?? categories[0] ?? suggestedCategory
  const confidence = Math.max(0, Math.min(1, confidenceRaw))
  return {
    suggestedCategory: finalCategory,
    taxDeductible,
    businessType,
    confidence,
    reasoning,
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  // Strip markdown code fences if the model wrapped output
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(body)
  } catch {
    // Try to extract the first {...} block
    const match = body.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('No content in OpenRouter response')
  }
  return content
}

export const categorizeRouter = Router()

categorizeRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as CategorizeBody
  const vendor = typeof body.vendor === 'string' ? body.vendor : ''
  const description =
    typeof body.description === 'string' ? body.description : ''
  const amount = typeof body.amount === 'number' ? body.amount : 0
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c): c is string => typeof c === 'string')
    : []

  if (!vendor.trim() || categories.length === 0) {
    res.status(400).json({ error: 'vendor and categories are required' })
    return
  }

  const key = cacheKey(vendor, description)
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    res.json(cached.result)
    return
  }

  const apiKey = getApiKey().trim()
  if (!apiKey) {
    res.json(fallback(categories))
    return
  }

  const systemPrompt = `You are a financial categorization assistant for a self-employed author and creative entrepreneur. The user treats nearly all spending as business expenses. Available categories: ${categories.join(', ')}. Respond only with valid JSON, no markdown.`

  const userPrompt = `Categorize this:
Vendor: ${vendor}
Amount: $${(amount / 100).toFixed(2)}

JSON response:
{
  "suggestedCategory": "<one of the available categories>",
  "taxDeductible": true/false,
  "businessType": "business" or "personal",
  "confidence": 0.0-1.0,
  "reasoning": "<one sentence>"
}`

  try {
    const content = await callOpenRouter(apiKey, systemPrompt, userPrompt)
    const parsed = extractJson(content)
    const result = coerceResult(parsed, categories)
    if (!result) {
      res.json(fallback(categories))
      return
    }
    cache.set(key, { result, timestamp: now })
    // Evict old entries opportunistically
    if (cache.size > 500) {
      for (const [k, v] of cache) {
        if (now - v.timestamp >= CACHE_TTL_MS) cache.delete(k)
      }
    }
    res.json(result)
  } catch (e) {
    console.error('[categorize] failed:', e)
    res.json(fallback(categories))
  }
})
