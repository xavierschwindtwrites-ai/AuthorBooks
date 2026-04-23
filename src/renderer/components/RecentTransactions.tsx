import type { Category, Transaction } from '../lib/api'
import { colorHex, formatDate, formatDollars } from '../lib/format'

type Props = {
  transactions: Transaction[]
  categories: Category[]
}

export default function RecentTransactions({ transactions, categories }: Props) {
  const catById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Recent Transactions</h2>
      </div>
      {transactions.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-slate-400">
          No transactions logged yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium">Vendor</th>
              <th className="px-5 py-2 text-right font-medium">Amount</th>
              <th className="px-5 py-2 font-medium">Category</th>
              <th className="px-5 py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const cat = t.categoryId ? catById.get(t.categoryId) : undefined
              const isBusiness = t.businessType === 'business'
              return (
                <tr
                  key={t.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-5 py-2 whitespace-nowrap text-slate-600">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-5 py-2 text-slate-900">
                    {t.vendor || t.description || (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td
                    className={`px-5 py-2 text-right font-mono tabular-nums ${
                      t.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'
                    }`}
                  >
                    {t.type === 'expense' ? '' : '+'}
                    {formatDollars(t.amount)}
                  </td>
                  <td className="px-5 py-2">
                    {cat ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: colorHex(cat.color) }}
                        />
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-5 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isBusiness
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {isBusiness ? 'Business' : 'Personal'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
