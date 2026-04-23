import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

type Role = 'user' | 'assistant'
type Message = { id: string; role: Role; content: string }

function uid() {
  return Math.random().toString(36).slice(2)
}

function Spinner() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-950 font-serif text-xs font-bold text-white">
          AB
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'rounded-tr-sm bg-indigo-600 text-white'
            : 'rounded-tl-sm bg-white text-slate-800 shadow-sm border border-slate-100'
        }`}
      >
        {msg.content}
      </div>
      {isUser && (
        <div className="ml-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
          You
        </div>
      )}
    </div>
  )
}

const SUGGESTIONS = [
  'Where am I spending the most money?',
  'Am I on track with my savings goals?',
  'What were my biggest expenses this month?',
  'How do my expenses compare to last month?',
  'Which subscriptions could I consider cutting?',
  'What is my net income so far this year?',
]

export default function ChatPage() {
  const [contextReady, setContextReady] = useState(false)
  const [contextError, setContextError] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    api.chat.getContext()
      .then((ctx) => {
        setSystemPrompt(ctx)
        setContextReady(true)
      })
      .catch((e: unknown) => {
        setContextError(e instanceof Error ? e.message : 'Failed to load financial context')
      })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming || !contextReady) return

    const userMsg: Message = { id: uid(), role: 'user', content: trimmed }
    const assistantId = uid()

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          systemPrompt,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: trimmed },
          ],
        }),
      })

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => 'Request failed')
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${err}` } : m)
        )
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>
              error?: string
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${parsed.error}` } : m)
              )
              break
            }
            const token = parsed.choices?.[0]?.delta?.content
            if (token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m
                )
              )
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Could not reach the AI backend. Make sure your OpenRouter key is set in Settings.' }
              : m
          )
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const showSuggestions = contextReady && messages.length === 0

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Financial Assistant</h1>
            <p className="text-sm text-slate-500">
              {contextReady
                ? 'Your full financial picture is loaded — ask anything.'
                : contextError
                ? 'Could not load financial data.'
                : 'Loading your financial data…'}
            </p>
          </div>
          {contextReady && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Context loaded
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {contextError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {contextError}
          </div>
        )}

        {!contextReady && !contextError && (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-400">
            <div className="mb-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
            Loading your financial context…
          </div>
        )}

        {showSuggestions && (
          <div className="flex flex-col items-center py-10">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950 font-serif text-2xl font-bold text-white">
              AB
            </div>
            <h2 className="mb-1 text-base font-semibold text-slate-800">Your financial advisor</h2>
            <p className="mb-6 text-sm text-slate-500 text-center max-w-sm">
              Ask anything about your income, expenses, goals, or subscriptions. I have your full financial picture.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-lg sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 hover:shadow"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-950 font-serif text-xs font-bold text-white">
              AB
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
              <Spinner />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-8 py-4">
        <div className="flex items-end gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contextReady ? 'Ask about your finances…' : 'Loading…'}
            disabled={!contextReady || streaming}
            className="flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none disabled:opacity-50"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600 transition hover:bg-slate-300"
              title="Stop"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5Z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={!input.trim() || !contextReady}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send (Enter)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-400">Enter to send · Shift+Enter for new line</p>
      </div>
    </main>
  )
}
