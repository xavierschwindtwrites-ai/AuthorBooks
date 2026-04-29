import { Router, type Request, type Response } from 'express'
import { getApiKey } from '../server'

type BankStatementBody = {
  base64Image?: unknown
  mimeType?: unknown
}

export type ExtractedTransaction = {
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
}

export type BankStatementResult = {
  transactions: ExtractedTransaction[]
  accountBalance?: number
  confidence: number
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4-5'

function fallback(): BankStatementResult {
  return { transactions: [], confidence: 0 }
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

function coerceTransaction(raw: unknown): ExtractedTransaction | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const date = typeof obj.date === 'string' ? obj.date.trim() : null
  const description = typeof obj.description === 'string' ? obj.description.trim() : null
  const amount = typeof obj.amount === 'number' && obj.amount > 0 ? obj.amount : null
  const type =
    obj.type === 'debit' || obj.type === 'credit'
      ? (obj.type as 'debit' | 'credit')
      : null
  if (!date || !description || amount === null || type === null) return null
  return { date, description, amount, type }
}

function coerceResult(raw: unknown): BankStatementResult | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const rawTxns = Array.isArray(obj.transactions) ? obj.transactions : []
  const transactions = rawTxns
    .map(coerceTransaction)
    .filter((t): t is ExtractedTransaction => t !== null)

  const accountBalance =
    typeof obj.accountBalance === 'number' && obj.accountBalance >= 0
      ? obj.accountBalance
      : undefined

  const confidence =
    typeof obj.confidence === 'number'
      ? Math.max(0, Math.min(1, obj.confidence))
      : transactions.length > 0 ? 0.8 : 0

  return { transactions, accountBalance, confidence }
}

export const bankStatementRouter = Router()

bankStatementRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as BankStatementBody
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
        max_tokens: 2048,
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
                text: `Extract all transactions and the account balance from this bank or credit card statement screenshot.

Respond only with valid JSON in exactly this shape:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "merchant or transaction description",
      "amount": 12.34,
      "type": "debit"
    }
  ],
  "accountBalance": 1234.56,
  "confidence": 0.9
}

Rules:
- Include every transaction visible in the image.
- "type" must be "debit" for money leaving the account (purchases, withdrawals, payments) or "credit" for money entering (deposits, refunds, transfers in).
- "amount" must always be a positive number in dollars with up to 2 decimal places.
- "date" must be YYYY-MM-DD. If only month/day is shown and the year is unclear, use the current year.
- "accountBalance" is the final or current balance shown; omit the field if no balance is visible.
- "confidence" is 0.0–1.0 reflecting how clearly the statement was readable.
- If no transactions are visible, return an empty transactions array.`,
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
    console.error('[bank-statement] failed:', e)
    res.json(fallback())
  }
})
