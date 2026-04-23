import { Link, useParams } from 'react-router-dom'

export default function EditTransactionPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <main className="flex-1 overflow-auto bg-slate-50 p-8">
      <header className="mb-6">
        <Link
          to="/transactions"
          className="mb-3 inline-block text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Back to Transactions
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Edit Transaction</h1>
      </header>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">Edit coming soon.</p>
        <p className="mt-2 font-mono text-xs text-slate-400">ID: {id}</p>
      </div>
    </main>
  )
}
