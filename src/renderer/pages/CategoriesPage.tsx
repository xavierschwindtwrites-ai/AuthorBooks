import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Category, Transaction } from '../lib/api'
import { colorHex } from '../lib/format'
import CategoryModal, {
  bizTypeFromCategory,
  toStoredBusinessType,
  type CategoryBizType,
  type CategoryFormValues,
} from '../components/CategoryModal'
import Toast from '../components/Toast'

type ToastState = { message: string; type: 'success' | 'error' }
type ReassignState = { category: Category; count: number }

function bizTypeLabel(b: CategoryBizType): string {
  if (b === 'business') return 'Business'
  if (b === 'personal') return 'Personal'
  return 'Mixed'
}

function bizTypeClasses(b: CategoryBizType): string {
  if (b === 'business') return 'bg-blue-100 text-blue-700'
  if (b === 'personal') return 'bg-orange-100 text-orange-700'
  return 'bg-slate-200 text-slate-700'
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [reassign, setReassign] = useState<ReassignState | null>(null)
  const [reassignTargetId, setReassignTargetId] = useState<string>('')
  const [reassignWorking, setReassignWorking] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [cats, txns] = await Promise.all([
        api.categories.getAll(),
        api.transactions.getAll(),
      ])
      setCategories(cats)
      setTransactions(txns)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const countByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (!t.categoryId) continue
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + 1)
    }
    return map
  }, [transactions])

  function openCreate() {
    setEditing(null)
    setModalMode('create')
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditing(null)
  }

  async function handleSubmit(values: CategoryFormValues) {
    if (modalMode === 'create') {
      await api.categories.create({
        name: values.name,
        color: values.color,
        defaultBusinessType: toStoredBusinessType(values.defaultBusinessType),
        defaultTaxDeductible: values.defaultTaxDeductible,
        isCustom: true,
      })
      setToast({ message: 'Category created', type: 'success' })
    } else if (modalMode === 'edit' && editing) {
      await api.categories.update(editing.id, {
        name: values.name,
        color: values.color,
        defaultBusinessType: toStoredBusinessType(values.defaultBusinessType),
        defaultTaxDeductible: values.defaultTaxDeductible,
      })
      setToast({ message: 'Category updated', type: 'success' })
    }
    closeModal()
    await refetch()
  }

  async function handleDeleteClick(cat: Category) {
    if (!cat.isCustom) return
    const count = countByCategory.get(cat.id) ?? 0
    if (count === 0) {
      try {
        await api.categories.delete(cat.id)
        setToast({ message: 'Category deleted', type: 'success' })
        await refetch()
      } catch (e: unknown) {
        setToast({
          message: `Delete failed: ${e instanceof Error ? e.message : String(e)}`,
          type: 'error',
        })
      }
      return
    }
    const firstOther = categories.find((c) => c.id !== cat.id)
    setReassign({ category: cat, count })
    setReassignTargetId(firstOther?.id ?? '')
  }

  async function confirmReassignAndDelete() {
    if (!reassign || !reassignTargetId) return
    setReassignWorking(true)
    try {
      const affected = transactions.filter(
        (t) => t.categoryId === reassign.category.id,
      )
      for (const t of affected) {
        await api.transactions.update(t.id, { categoryId: reassignTargetId })
      }
      await api.categories.delete(reassign.category.id)
      setToast({
        message: `Reassigned ${affected.length} transaction${affected.length === 1 ? '' : 's'} and deleted category`,
        type: 'success',
      })
      setReassign(null)
      setReassignTargetId('')
      await refetch()
    } catch (e: unknown) {
      setToast({
        message: `Delete failed: ${e instanceof Error ? e.message : String(e)}`,
        type: 'error',
      })
    } finally {
      setReassignWorking(false)
    }
  }

  const existingNames = useMemo(() => {
    if (modalMode === 'edit' && editing) {
      return categories.filter((c) => c.id !== editing.id).map((c) => c.name)
    }
    return categories.map((c) => c.name)
  }, [categories, modalMode, editing])

  const reassignOptions = useMemo(
    () => (reassign ? categories.filter((c) => c.id !== reassign.category.id) : []),
    [categories, reassign],
  )

  return (
    <main className="flex-1 overflow-auto bg-slate-50 p-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            Organize your transactions with custom categories.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          + New Category
        </button>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load categories: {loadError}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
          <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading categories…
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          No categories yet. Create your first one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Default Type</th>
                <th className="px-4 py-2 font-medium">Tax</th>
                <th className="px-4 py-2 text-right font-medium">Transactions</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const biz = bizTypeFromCategory(cat)
                const count = countByCategory.get(cat.id) ?? 0
                const canDelete = cat.isCustom
                return (
                  <tr
                    key={cat.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-6 w-6 shrink-0 rounded-md ring-1 ring-slate-200"
                          style={{ backgroundColor: colorHex(cat.color) }}
                        />
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {cat.name}
                          </span>
                          {!cat.isCustom && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                              Built-in
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${bizTypeClasses(biz)}`}
                      >
                        {bizTypeLabel(biz)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {cat.defaultTaxDeductible ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <span aria-hidden>✓</span> Deductible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <span aria-hidden>—</span> Not deductible
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label="Edit"
                        title="Edit"
                        onClick={() => openEdit(cat)}
                        className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        title={
                          canDelete
                            ? 'Delete'
                            : 'Built-in categories cannot be deleted'
                        }
                        disabled={!canDelete}
                        onClick={() => handleDeleteClick(cat)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
                          canDelete
                            ? 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                            : 'cursor-not-allowed text-slate-300'
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 0 0 6 3.75V4H3.5a.75.75 0 0 0 0 1.5h.553l.717 11.186A2.75 2.75 0 0 0 7.516 19h4.968a2.75 2.75 0 0 0 2.746-2.314L15.947 5.5h.553a.75.75 0 0 0 0-1.5H14v-.25A2.75 2.75 0 0 0 11.25 1h-2.5ZM7.5 4v-.25c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25V4h-5ZM8.05 8a.75.75 0 0 1 .787.71l.35 6.5a.75.75 0 1 1-1.498.08l-.35-6.5A.75.75 0 0 1 8.05 8Zm4.688.71a.75.75 0 1 0-1.497-.08l-.35 6.5a.75.75 0 0 0 1.498.08l.35-6.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalMode && (
        <CategoryModal
          mode={modalMode}
          initial={editing ?? undefined}
          existingNames={existingNames}
          onCancel={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {reassign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !reassignWorking) {
              setReassign(null)
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Delete Category
              </h2>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-slate-700">
                This category is used by{' '}
                <strong>
                  {reassign.count} transaction{reassign.count === 1 ? '' : 's'}
                </strong>
                .
              </p>
              <div>
                <label
                  htmlFor="reassign-target"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Reassign them to
                </label>
                <select
                  id="reassign-target"
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {reassignOptions.length === 0 ? (
                    <option value="">No other categories available</option>
                  ) : (
                    reassignOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setReassign(null)}
                disabled={reassignWorking}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReassignAndDelete}
                disabled={reassignWorking || !reassignTargetId}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
              >
                {reassignWorking ? 'Reassigning…' : 'Reassign & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
