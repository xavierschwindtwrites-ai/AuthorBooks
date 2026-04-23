import { Router, type Request, type Response } from 'express'
import { getApiKey } from '../server'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type ChatBody = { messages?: unknown; systemPrompt?: unknown }

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4-5'

export const chatRouter = Router()

chatRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as ChatBody

  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : []
  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : ''

  const apiKey = getApiKey().trim()
  if (!apiKey) {
    res.status(400).json({ error: 'No API key configured. Add your OpenRouter key in Settings.' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

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
        stream: true,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      res.write(`data: ${JSON.stringify({ error: `OpenRouter ${upstream.status}: ${text.slice(0, 120)}` })}\n\n`)
      res.end()
      return
    }

    const reader = upstream.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }

    res.end()
  } catch (e) {
    console.error('[chat] failed:', e)
    res.write(`data: ${JSON.stringify({ error: 'Request failed. Check your connection.' })}\n\n`)
    res.end()
  }
})
