import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../components/TransactionForm'
import Toast from '../components/Toast'

type ToastState = { message: string; type: 'success' | 'error' }

export default function NewTransactionPage() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleSaved(message: string) {
    setToast({ message, type: 'success' })
    window.setTimeout(() => navigate('/transactions'), 1200)
  }

  function handleError(message: string) {
    setToast({ message: `Save failed: ${message}`, type: 'error' })
  }

  return (
    <main className="flex-1 overflow-auto bg-slate-50 p-8">
      <header className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-slate-900">New Transaction</h1>
        <p className="text-sm text-slate-500">
          Log an expense or income entry.
        </p>
      </header>

      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <TransactionForm onSaved={handleSaved} onError={handleError} />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  )
}
