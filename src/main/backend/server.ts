import express, { type Express, type Request, type Response } from 'express'
import type { Server } from 'node:http'
import { categorizeRouter, clearCache } from './routes/categorize'
import { ocrRouter } from './routes/ocr'

const MODEL = 'anthropic/claude-haiku-4-5'
const PORT = 3001

let server: Server | null = null
let apiKeyRef: { value: string } = { value: '' }

export function getApiKey(): string {
  return apiKeyRef.value
}

export function startBackend(apiKey: string): Promise<void> {
  if (server) {
    apiKeyRef.value = apiKey
    clearCache()
    return Promise.resolve()
  }
  apiKeyRef.value = apiKey

  const app: Express = express()

  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin
    if (typeof origin === 'string' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    next()
  })

  app.use(express.json({ limit: '64kb' }))

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', model: MODEL })
  })

  app.use('/api/categorize', categorizeRouter)
  app.use('/api/ocr', express.json({ limit: '10mb' }), ocrRouter)

  return new Promise((resolve, reject) => {
    const s = app.listen(PORT, '127.0.0.1', () => {
      console.log(`[backend] listening on http://127.0.0.1:${PORT}`)
      server = s
      resolve()
    })
    s.on('error', (err: NodeJS.ErrnoException) => {
      console.error('[backend] server error:', err)
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${PORT} is already in use. AI features will be unavailable.`))
      } else {
        reject(err)
      }
    })
  })
}

export function stopBackend(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve()
      return
    }
    const s = server
    server = null
    s.close(() => resolve())
  })
}

export async function restartBackend(apiKey: string): Promise<void> {
  apiKeyRef.value = apiKey
  clearCache()
  if (!server) {
    await startBackend(apiKey)
  }
}

export const BACKEND_MODEL = MODEL
export const BACKEND_PORT = PORT
