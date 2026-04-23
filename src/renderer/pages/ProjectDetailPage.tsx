import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type {
  Category,
  Project,
  ProjectStatus,
  ProjectSummary,
  Transaction,
} from '../lib/api'
import { colorHex, formatDate, formatDollars } from '../lib/format'
import ProjectSummaryStats from '../components/ProjectSummaryStats'
import SpendingPieChart, {
  type PieSlice,
} from '../components/SpendingPieChart'
import { statusLabel, statusPalette } from '../components/ProjectCard'
import ProjectModal, { type ProjectFormValues } from '../components/ProjectModal'
import Toast from '../components/Toast'

type ToastState = { message: string; type: 'success' | 'error' }

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [parent, setParent] = useState<Project | null>(null)
  const [children, setChildren] = useState<Project[]>([])
  const [childSummaries, setChildSummaries] = useState<Map<string, ProjectSummary>>(new Map())
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [showAddSubproject, setShowAddSubproject] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [all, s, txns, cats, kids] = await Promise.all([
        api.projects.getAll(),
        api.projects.getSummary(id),
        api.transactions.getAll({ projectId: id }),
        api.categories.getAll(),
        api.projects.getChildren(id),
      ])
      const p = all.find((x) => x.id === id) ?? null
      if (!p) throw new Error('Project not found')
      setProject(p)
      setSummary(s)
      setTransactions(txns)
      setCategories(cats)
      setChildren(kids)

      if (p.parentId) {
        setParent(all.find((x) => x.id === p.parentId) ?? null)
      } else {
        setParent(null)
      }

      if (kids.length > 0) {
        const entries = await Promise.all(
          kids.map(async (child) => {
            try {
              const cs = await api.projects.getSummary(child.id)
              return [child.id, cs] as const
            } catch {
              return [child.id, { totalExpenses: 0, totalIncome: 0, net: 0 }] as const
            }
          }),
        )
        setChildSummaries(new Map(entries))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const slices: PieSlice[] = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]))
    const byCat = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      const key = t.categoryId ?? '__uncategorized__'
      byCat.set(key, (byCat.get(key) ?? 0) + t.amount)
    }
    return Array.from(byCat.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([catId, amount]) => {
        const c = catId === '__uncategorized__' ? undefined : catById.get(catId)
        return {
          name: c?.name ?? 'Uncategorized',
          color: c?.color ?? 'gray',
          amountCents: amount,
        }
      })
  }, [transactions, categories])

  async function handleAddSubproject(values: ProjectFormValues) {
    if (!id) return
    await api.projects.create({
      name: values.name,
      type: values.type,
      status: values.status,
      startDate: values.startDate,
      targetPublishDate: values.targetPublishDate,
      budget: values.budgetCents,
      notes: values.notes,
      parentId: id,
    })
    setToast({ message: 'Subproject created', type: 'success' })
    setShowAddSubproject(false)
    await load()
  }

  if (!id) {
    return (
      <main className="flex-1 overflow-auto p-8">
        <p className="text-sm text-rose-600">No project id provided.</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex-1 overflow-auto bg-slate-50 p-8">
        <Link
          to="/projects"
          className="mb-3 inline-block text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Back to Projects
        </Link>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      </main>
    )
  }

  if (loading || !project) {
    return (
      <main className="flex-1 overflow-auto bg-slate-50 p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading project…
        </div>
      </main>
    )
  }

  const catById = new Map(categories.map((c) => [c.id, c]))
  const isSubproject = !!project.parentId

  return (
    <main className="flex-1 overflow-auto bg-slate-50 p-8">
      {isSubproject && parent ? (
        <Link
          to={`/projects/${parent.id}`}
          className="mb-3 inline-block text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Part of: {parent.name}
        </Link>
      ) : (
        <Link
          to="/projects"
          className="mb-3 inline-block text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Back to Projects
        </Link>
      )}

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {project.type && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {project.type}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPalette(project.status)}`}
            >
              {statusLabel(project.status)}
            </span>
            {project.startDate && (
              <span>Started {formatDate(project.startDate)}</span>
            )}
            {project.targetPublishDate && (
              <span>Target {formatDate(project.targetPublishDate)}</span>
            )}
          </div>
          {project.notes && (
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              {project.notes}
            </p>
          )}
        </div>
      </header>

      <section className="mb-6">
        <ProjectSummaryStats summary={summary} />
      </section>

      {!isSubproject && (
        <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Subprojects</h2>
            <button
              type="button"
              onClick={() => setShowAddSubproject(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              + Add Subproject
            </button>
          </div>
          {children.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No subprojects yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => {
                const cs = childSummaries.get(child.id) ?? null
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => navigate(`/projects/${child.id}`)}
                    className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {child.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusPalette(child.status as ProjectStatus | null)}`}
                      >
                        {statusLabel(child.status as ProjectStatus | null)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>
                        Spent{' '}
                        <span className="font-mono text-rose-600">
                          {formatDollars(cs?.totalExpenses ?? 0)}
                        </span>
                      </span>
                      <span>
                        Net{' '}
                        <span
                          className={`font-mono font-medium ${(cs?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                        >
                          {formatDollars(cs?.net ?? 0)}
                        </span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SpendingPieChart slices={slices} />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Project Transactions
            </h2>
          </div>
          {transactions.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-400">
              No transactions linked to this project yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Vendor / Source</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Business</th>
                    <th className="px-4 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const cat = t.categoryId ? catById.get(t.categoryId) : undefined
                    const isExpense = t.type === 'expense'
                    return (
                      <tr
                        key={t.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                          {formatDate(t.date)}
                        </td>
                        <td className="px-4 py-2 text-slate-900">
                          {t.vendor || t.description || (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums ${
                            isExpense ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {formatDollars(t.amount)}
                        </td>
                        <td className="px-4 py-2">
                          {cat ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: colorHex(cat.color) }}
                              />
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Uncategorized
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              isExpense
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isExpense ? 'Expense' : 'Income'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              t.businessType === 'business'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {t.businessType === 'business'
                              ? 'Business'
                              : 'Personal'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {t.notes || <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showAddSubproject && (
        <ProjectModal
          mode="create"
          initialParentId={id}
          onCancel={() => setShowAddSubproject(false)}
          onSubmit={handleAddSubproject}
        />
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
