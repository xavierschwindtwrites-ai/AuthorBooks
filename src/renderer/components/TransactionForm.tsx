import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { BusinessType, Category, Project } from '../lib/api'
import { useApiKey } from '../lib/useApiKey'

type TxType = 'expense' | 'income'

type Props = {
  onSaved: (message: string) => void
  onError: (message: string) => void
}

const INCOME_CATEGORIES = [
  'Royalties',
  'Advance',
  'Freelance',
  'Contract',
  'Other',
] as const

type OcrResult = {
  vendor: string
  amount: number
  date: string
  description: string
  confidence: number
}

function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dollarsToCents(input: string): number {
  const trimmed = input.trim().replace(/[$,]/g, '')
  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const fieldLabel = 'block text-xs font-medium uppercase tracking-wide text-slate-500'
const fieldInput =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50'
const errorText = 'mt-1 text-xs text-rose-600'

type Suggestion = {
  suggestedCategory: string
  taxDeductible: boolean
  businessType: 'business' | 'personal'
  confidence: number
  reasoning: string
}

export default function TransactionForm({ onSaved, onError }: Props) {
  const { hasKey: hasApiKey } = useApiKey()
  const [type, setType] = useState<TxType>('expense')
  const [date, setDate] = useState<string>(todayYMD())
  const [amount, setAmount] = useState<string>('')
  const [vendorOrSource, setVendorOrSource] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [incomeCategory, setIncomeCategory] =
    useState<(typeof INCOME_CATEGORIES)[number]>('Royalties')
  const [businessType, setBusinessType] = useState<BusinessType>('business')
  const [taxDeductible, setTaxDeductible] = useState<boolean>(true)
  const [projectId, setProjectId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [categories, setCategories] = useState<Category[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<boolean>(false)

  const [aiLoading, setAiLoading] = useState<boolean>(false)
  const [aiSuggestion, setAiSuggestion] = useState<Suggestion | null>(null)
  const aiDebounceRef = useRef<number | null>(null)
  const aiRequestIdRef = useRef<number>(0)
  const lastAiVendorRef = useRef<string>('')

  // Receipt state
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrSuggestion, setOcrSuggestion] = useState<OcrResult | null>(null)
  const receiptPreviewUrl = useRef<string | null>(null)

  useEffect(() => {
    Promise.all([api.categories.getAll(), api.projects.getAll()])
      .then(([cats, projs]) => {
        setCategories(cats)
        setProjects(projs)
      })
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : String(e)),
      )
  }, [])

  // Revoke object URL when file changes
  useEffect(() => {
    return () => {
      if (receiptPreviewUrl.current) {
        URL.revokeObjectURL(receiptPreviewUrl.current)
        receiptPreviewUrl.current = null
      }
    }
  }, [receiptFile])

  const requestSuggestion = (vendorValue: string) => {
    const trimmed = vendorValue.trim()
    if (type !== 'expense' || !trimmed || !hasApiKey) return
    if (trimmed === lastAiVendorRef.current && aiSuggestion) return
    if (categories.length === 0) return

    const reqId = ++aiRequestIdRef.current
    lastAiVendorRef.current = trimmed
    setAiLoading(true)

    const payload = {
      vendor: trimmed,
      description: notes,
      amount: dollarsToCents(amount),
      categories: categories.map((c) => c.name),
    }

    fetch('http://localhost:3001/api/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as Suggestion
      })
      .then((result) => {
        if (reqId !== aiRequestIdRef.current) return
        setAiSuggestion(result)
        const match = categories.find(
          (c) => c.name.toLowerCase() === result.suggestedCategory.toLowerCase(),
        )
        if (match) setCategoryId(match.id)
        setBusinessType(result.businessType)
        if (result.businessType === 'business') {
          setTaxDeductible(result.taxDeductible)
        }
      })
      .catch(() => {
        if (reqId === aiRequestIdRef.current) setAiSuggestion(null)
      })
      .finally(() => {
        if (reqId === aiRequestIdRef.current) setAiLoading(false)
      })
  }

  const scheduleSuggestion = (vendorValue: string) => {
    if (aiDebounceRef.current !== null) window.clearTimeout(aiDebounceRef.current)
    aiDebounceRef.current = window.setTimeout(() => requestSuggestion(vendorValue), 600)
  }

  useEffect(() => {
    return () => {
      if (aiDebounceRef.current !== null) window.clearTimeout(aiDebounceRef.current)
    }
  }, [])

  async function handleReceiptFile(file: File) {
    // Revoke old URL
    if (receiptPreviewUrl.current) {
      URL.revokeObjectURL(receiptPreviewUrl.current)
      receiptPreviewUrl.current = null
    }
    setReceiptFile(file)
    setOcrSuggestion(null)

    let base64: string
    try {
      base64 = await readFileAsBase64(file)
    } catch {
      return
    }

    // Save to disk (always, regardless of API key)
    const timestamp = Date.now()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `receipt_${timestamp}_${safeFilename}`
    try {
      const saved = await api.receipts.save({ base64, filename })
      setReceiptPath(saved.path)
    } catch {
      // File save failed — continue without path
    }

    // OCR only if API key is available
    if (!hasApiKey || !file.type.startsWith('image/')) return

    setOcrLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64, mimeType: file.type }),
      })
      if (!res.ok) return
      const result = (await res.json()) as OcrResult
      if (result.confidence > 0.6) setOcrSuggestion(result)
    } catch {
      // Silently ignore
    } finally {
      setOcrLoading(false)
    }
  }

  function acceptOcrSuggestion() {
    if (!ocrSuggestion) return
    if (ocrSuggestion.vendor) setVendorOrSource(ocrSuggestion.vendor)
    if (ocrSuggestion.amount) setAmount(ocrSuggestion.amount.toFixed(2))
    if (ocrSuggestion.date) setDate(ocrSuggestion.date)
    setOcrSuggestion(null)
  }

  function removeReceipt() {
    if (receiptPreviewUrl.current) {
      URL.revokeObjectURL(receiptPreviewUrl.current)
      receiptPreviewUrl.current = null
    }
    setReceiptFile(null)
    setReceiptPath(null)
    setOcrSuggestion(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function getPreviewUrl(): string {
    if (!receiptFile || !receiptFile.type.startsWith('image/')) return ''
    if (!receiptPreviewUrl.current) {
      receiptPreviewUrl.current = URL.createObjectURL(receiptFile)
    }
    return receiptPreviewUrl.current
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!amount.trim()) {
      e.amount = 'Amount is required'
    } else if (dollarsToCents(amount) <= 0) {
      e.amount = 'Amount must be greater than 0'
    }
    if (!vendorOrSource.trim()) {
      e.vendor = type === 'expense' ? 'Vendor is required' : 'Source is required'
    }
    if (type === 'expense' && !categoryId) e.category = 'Category is required'
    if (type === 'income' && !incomeCategory) e.category = 'Category is required'
    return e
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    try {
      if (type === 'expense') {
        await api.transactions.create({
          date,
          amount: dollarsToCents(amount),
          type: 'expense',
          vendor: vendorOrSource.trim(),
          categoryId: categoryId || null,
          projectId: projectId || null,
          notes: notes.trim() || null,
          businessType,
          taxDeductible: businessType === 'business' ? taxDeductible : false,
          receiptPath: receiptPath,
        })
        onSaved('Expense saved!')
      } else {
        await api.income.create({
          date,
          amount: dollarsToCents(amount),
          source: vendorOrSource.trim(),
          description: incomeCategory,
          projectId: projectId || null,
          notes: notes.trim() || null,
        })
        onSaved('Income saved!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      onError(msg)
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Failed to load form data: {loadError}
      </div>
    )
  }

  const isExpense = type === 'expense'
  const vendorLabel = isExpense ? 'Vendor' : 'Source'
  const vendorPlaceholder = isExpense ? 'Starbucks, Amazon…' : 'Amazon KDP, Client X…'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <span className={fieldLabel}>Type</span>
        <div className="mt-1.5 inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                type === t
                  ? t === 'expense'
                    ? 'bg-slate-900 text-white'
                    : 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={fieldLabel} htmlFor="tx-date">
            Date
          </label>
          <input
            id="tx-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldInput}
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="tx-amount">
            Amount
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              $
            </span>
            <input
              id="tx-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount}
              className={`block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                errors.amount ? 'border-rose-300' : ''
              }`}
            />
          </div>
          {errors.amount && <div className={errorText}>{errors.amount}</div>}
        </div>
      </div>

      <div>
        <label className={fieldLabel} htmlFor="tx-vendor">
          {vendorLabel}
        </label>
        <input
          id="tx-vendor"
          type="text"
          placeholder={vendorPlaceholder}
          value={vendorOrSource}
          onChange={(e) => {
            const v = e.target.value
            setVendorOrSource(v)
            if (isExpense && hasApiKey && v.trim()) scheduleSuggestion(v)
          }}
          onBlur={(e) => {
            if (isExpense && hasApiKey && e.target.value.trim()) {
              if (aiDebounceRef.current !== null) {
                window.clearTimeout(aiDebounceRef.current)
                aiDebounceRef.current = null
              }
              requestSuggestion(e.target.value)
            }
          }}
          aria-invalid={!!errors.vendor}
          className={`${fieldInput} ${errors.vendor ? 'border-rose-300' : ''}`}
        />
        {errors.vendor && <div className={errorText}>{errors.vendor}</div>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className={fieldLabel} htmlFor="tx-category">
            Category
          </label>
          {isExpense && aiLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" data-ai-spinner>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Analyzing…
            </span>
          )}
        </div>
        {isExpense ? (
          <select
            id="tx-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-invalid={!!errors.category}
            className={`${fieldInput} ${errors.category ? 'border-rose-300' : ''}`}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <select
            id="tx-category"
            value={incomeCategory}
            onChange={(e) =>
              setIncomeCategory(e.target.value as (typeof INCOME_CATEGORIES)[number])
            }
            aria-invalid={!!errors.category}
            className={`${fieldInput} ${errors.category ? 'border-rose-300' : ''}`}
          >
            {INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {errors.category && <div className={errorText}>{errors.category}</div>}
        {isExpense && aiSuggestion && (
          <div
            className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
            data-ai-suggestion
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-slate-900">
                  ✨ AI suggested: {aiSuggestion.suggestedCategory}
                </span>{' '}
                <span className="text-slate-500">
                  ({Math.round(aiSuggestion.confidence * 100)}% confident)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAiSuggestion(null)}
                  className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-slate-800"
                  data-ai-accept
                >
                  Accept ✓
                </button>
                <button
                  type="button"
                  onClick={() => { setAiSuggestion(null); setCategoryId('') }}
                  className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  data-ai-dismiss
                >
                  Dismiss ✗
                </button>
              </div>
            </div>
            {aiSuggestion.reasoning && (
              <div className="mt-1 italic text-slate-500">{aiSuggestion.reasoning}</div>
            )}
          </div>
        )}
      </div>

      {isExpense && (
        <div>
          <span className={fieldLabel}>Business / Personal</span>
          <div className="mt-1.5 inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
            {(['business', 'personal'] as const).map((bt) => {
              const active = businessType === bt
              const activeCls =
                bt === 'business' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
              return (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setBusinessType(bt)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                    active ? activeCls : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {bt === 'business' ? 'Business' : 'Personal'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isExpense && businessType === 'business' && (
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={taxDeductible}
              onChange={(e) => setTaxDeductible(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            Tax deductible
          </label>
        </div>
      )}

      <div>
        <label className={fieldLabel} htmlFor="tx-project">
          Project <span className="text-slate-400">(optional)</span>
        </label>
        <select
          id="tx-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={fieldInput}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={fieldLabel} htmlFor="tx-notes">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="tx-notes"
          rows={3}
          placeholder="Add notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={fieldInput}
        />
      </div>

      {/* Receipt attachment */}
      <div>
        <span className={fieldLabel}>Receipt <span className="text-slate-400">(optional)</span></span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleReceiptFile(file)
          }}
        />

        {!receiptFile ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
            </svg>
            Attach Receipt
          </button>
        ) : (
          <div className="mt-1.5 space-y-2">
            {/* Preview + controls */}
            <div className="flex items-start gap-3">
              {receiptFile.type.startsWith('image/') ? (
                <img
                  src={getPreviewUrl()}
                  alt="Receipt preview"
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-2xl">
                  📄
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">{receiptFile.name}</p>
                <p className="text-xs text-slate-400">
                  {(receiptFile.size / 1024).toFixed(0)} KB
                </p>
                {ocrLoading && (
                  <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    Scanning receipt…
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={removeReceipt}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Remove receipt"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {/* OCR suggestion banner */}
            {ocrSuggestion && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-emerald-800">
                    Receipt scanned ✓ —{' '}
                    {ocrSuggestion.vendor && `${ocrSuggestion.vendor} `}
                    {ocrSuggestion.amount > 0 && `$${ocrSuggestion.amount.toFixed(2)}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={acceptOcrSuggestion}
                      className="rounded-md bg-emerald-700 px-2.5 py-0.5 text-xs font-medium text-white transition hover:bg-emerald-600"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setOcrSuggestion(null)}
                      className="rounded-md border border-emerald-300 bg-white px-2.5 py-0.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={submitting}
          className={`rounded-lg px-5 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-60 ${
            isExpense ? 'bg-slate-900 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {submitting ? 'Saving…' : isExpense ? 'Save Expense' : 'Save Income'}
        </button>
      </div>
    </form>
  )
}
