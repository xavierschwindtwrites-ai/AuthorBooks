import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDollars } from '../lib/format'
import { useApiKey } from '../lib/useApiKey'

type ExtractedTransaction = {
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
}

type BankStatementResult = {
  transactions: ExtractedTransaction[]
  accountBalance?: number
  confidence: number
}

type ReviewRow = {
  id: string
  selected: boolean
  date: string
  description: string
  amountStr: string
  transactionType: 'expense' | 'income'
}

type Phase = 'idle' | 'processing' | 'reviewing'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data URL prefix (e.g. "data:image/png;base64,")
      const base64 = result.split(',')[1]
      if (base64) resolve(base64)
      else reject(new Error('Could not read file'))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

let rowCounter = 0
function nextId() {
  return String(++rowCounter)
}

export default function BankStatementImporter({ onImported }: { onImported: () => void }) {
  const { hasKey, loading: keyLoading } = useApiKey()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [accountBalance, setAccountBalance] = useState<number | undefined>()
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)')
      return
    }
    setError(null)
    setPhase('processing')

    try {
      const base64Image = await fileToBase64(file)
      const res = await fetch('http://localhost:3001/api/bank-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image, mimeType: file.type }),
      })

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`)
      }

      const data = (await res.json()) as BankStatementResult

      if (!data.transactions || data.transactions.length === 0) {
        setError('No transactions found in this image. Try a clearer screenshot.')
        setPhase('idle')
        return
      }

      const reviewRows: ReviewRow[] = data.transactions.map((t) => ({
        id: nextId(),
        selected: true,
        date: t.date,
        description: t.description,
        amountStr: t.amount.toFixed(2),
        transactionType: t.type === 'credit' ? 'income' : 'expense',
      }))

      setRows(reviewRows)
      setAccountBalance(data.accountBalance)
      setPhase('reviewing')
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('fetch')
          ? 'Could not reach the AI backend. Make sure your OpenRouter API key is configured in Settings.'
          : (e instanceof Error ? e.message : 'Failed to process image'),
      )
      setPhase('idle')
    }
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void processFile(file)
      e.target.value = ''
    },
    [processFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void processFile(file)
    },
    [processFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const toggleRow = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)),
    )
  }

  const updateRow = (id: string, field: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...field } : r)))
  }

  const toggleAll = () => {
    const allSelected = rows.every((r) => r.selected)
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })))
  }

  const selectedRows = rows.filter((r) => r.selected)

  const handleImport = async () => {
    if (selectedRows.length === 0) return
    setImporting(true)
    setError(null)

    try {
      for (const row of selectedRows) {
        const amountDollars = parseFloat(row.amountStr)
        if (isNaN(amountDollars) || amountDollars <= 0) continue
        await api.transactions.create({
          date: row.date,
          amount: Math.round(amountDollars * 100),
          type: row.transactionType,
          vendor: row.description,
          businessType: 'personal',
          taxDeductible: false,
        })
      }
      setImportedCount(selectedRows.length)
      onImported()
      setTimeout(() => {
        setPhase('idle')
        setRows([])
        setAccountBalance(undefined)
        setImportedCount(null)
      }, 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleCancel = () => {
    setPhase('idle')
    setRows([])
    setAccountBalance(undefined)
    setError(null)
  }

  // No API key state
  if (!keyLoading && !hasKey) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <span className="font-medium text-slate-700">Import Bank Statement</span>
        {' — '}
        <Link to="/settings" className="text-indigo-600 hover:underline">
          Set up AI features in Settings
        </Link>{' '}
        to enable screenshot import.
      </div>
    )
  }

  return (
    <>
      {/* Upload card — shown in idle and processing */}
      {phase !== 'reviewing' && (
        <div
          className={`relative rounded-lg border-2 border-dashed px-5 py-4 transition-colors ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex items-center gap-3">
            {phase === 'processing' ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 shrink-0" />
            ) : (
              <svg
                className="h-5 w-5 shrink-0 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">
                {phase === 'processing' ? 'Reading statement…' : 'Import Bank Statement'}
              </p>
              {phase === 'idle' && (
                <p className="text-xs text-slate-400">
                  Drop a screenshot here or{' '}
                  <button
                    type="button"
                    className="text-indigo-600 hover:underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse
                  </button>
                  . Transactions will be extracted automatically.
                </p>
              )}
            </div>
          </div>
          {error && (
            <p className="mt-2 text-xs text-rose-600">{error}</p>
          )}
        </div>
      )}

      {/* Review modal */}
      {phase === 'reviewing' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            {/* Header */}
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Review Extracted Transactions
              </h2>
              <div className="mt-0.5 flex items-center gap-4 text-sm text-slate-500">
                <span>{rows.length} transaction{rows.length !== 1 ? 's' : ''} found</span>
                {accountBalance !== undefined && (
                  <span className="font-medium text-slate-700">
                    Account balance: {formatDollars(Math.round(accountBalance * 100))}
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="max-h-[55vh] overflow-auto px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th className="pb-2 pr-3 text-left">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((r) => r.selected)}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="pb-2 pr-3 text-left font-medium">Date</th>
                    <th className="pb-2 pr-3 text-left font-medium">Description</th>
                    <th className="pb-2 pr-3 text-right font-medium">Amount ($)</th>
                    <th className="pb-2 text-left font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => (
                    <tr key={row.id} className={row.selected ? '' : 'opacity-40'}>
                      <td className="py-1.5 pr-3">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(row.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, { date: e.target.value })}
                          className="w-32 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(row.id, { description: e.target.value })}
                          className="w-full min-w-[180px] rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.amountStr}
                          onChange={(e) => updateRow(row.id, { amountStr: e.target.value })}
                          className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-right text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="py-1.5">
                        <select
                          value={row.transactionType}
                          onChange={(e) =>
                            updateRow(row.id, {
                              transactionType: e.target.value as 'expense' | 'income',
                            })
                          }
                          className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              <div className="text-sm text-slate-500">
                {selectedRows.length} of {rows.length} selected
              </div>
              <div className="flex items-center gap-3">
                {error && (
                  <span className="text-xs text-rose-600">{error}</span>
                )}
                {importedCount !== null && (
                  <span className="text-xs font-medium text-emerald-600">
                    {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported!
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={importing}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={importing || selectedRows.length === 0}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {importing
                    ? 'Importing…'
                    : `Import Selected (${selectedRows.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
