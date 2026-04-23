import { useCallback, useEffect, useMemo, useState } from 'react'
import GoalCard from '../components/GoalCard'
import GoalModal, {
  goalTypeLabel,
  goalTypePalette,
  type GoalFormValues,
} from '../components/GoalModal'
import StatCard from '../components/StatCard'
import Toast from '../components/Toast'
import { api } from '../lib/api'
import type { Income, SavingsGoal, SavingsProgress } from '../lib/api'
import { formatDollars } from '../lib/format'

type GoalRow = {
  goal: SavingsGoal
  progress: SavingsProgress
}

type ToastState = { message: string; type: 'success' | 'error' } | null

export default function GoalsPage() {
  const [rows, setRows] = useState<GoalRow[]>([])
  const [incomeYTDCents, setIncomeYTDCents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const now = new Date()
      const yearStart = `${now.getFullYear()}-01-01`
      const [goals, incomes] = await Promise.all([
        api.savingsGoals.getAll(),
        api.income.getAll(yearStart),
      ])
      const progresses = await Promise.all(
        goals.map((g) => api.savingsGoals.getProgress(g.id)),
      )
      const nextRows: GoalRow[] = goals.map((g, i) => ({
        goal: g,
        progress: progresses[i],
      }))
      const ytd = incomes.reduce(
        (sum: number, inc: Income) => sum + inc.amount,
        0,
      )
      setRows(nextRows)
      setIncomeYTDCents(ytd)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void reload().finally(() => setLoading(false))
  }, [reload])

  const overview = useMemo(() => {
    let totalSaved = 0
    let totalTarget = 0
    let onTrack = 0
    for (const { goal, progress } of rows) {
      const current =
        goal.type === 'income_target' ? incomeYTDCents : progress.current
      totalSaved += current
      totalTarget += progress.target
      const eff =
        goal.type === 'income_target'
          ? progress.target > 0 && incomeYTDCents >= 0
          : progress.onTrack
      if (eff) onTrack += 1
    }
    const overallPct =
      totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0
    return { totalSaved, totalTarget, overallPct, onTrack, count: rows.length }
  }, [rows, incomeYTDCents])

  async function handleCreate(values: GoalFormValues) {
    await api.savingsGoals.create({
      name: values.name,
      type: values.type,
      targetAmount: values.targetAmountCents,
      currentAmount: values.currentAmountCents,
      deadline: values.deadline,
      priority: values.priority,
      notes: values.notes,
    })
    setModalMode(null)
    setToast({ message: 'Goal created', type: 'success' })
    await reload()
  }

  async function handleUpdate(values: GoalFormValues) {
    if (!editing) return
    await api.savingsGoals.update(editing.id, {
      name: values.name,
      type: values.type,
      targetAmount: values.targetAmountCents,
      currentAmount: values.currentAmountCents,
      deadline: values.deadline,
      priority: values.priority,
      notes: values.notes,
    })
    setModalMode(null)
    setEditing(null)
    setToast({ message: 'Goal updated', type: 'success' })
    await reload()
  }

  async function handleDelete(id: string, name: string) {
    try {
      await api.savingsGoals.delete(id)
      setToast({ message: `Deleted ${name}`, type: 'success' })
      await reload()
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
      })
    }
  }

  async function handleAddFunds(
    goal: SavingsGoal,
    amountCents: number,
  ): Promise<void> {
    await api.savingsGoals.update(goal.id, {
      currentAmount: goal.currentAmount + amountCents,
    })
    setToast({
      message: `Added ${formatDollars(amountCents)} to ${goal.name}`,
      type: 'success',
    })
    await reload()
  }

  return (
    <main className="flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Savings Goals</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reserve funds for taxes, emergencies, and projects — what's yours
            after the set-asides.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Loading goals…
          </div>
        ) : (
          <>
            <section className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Saved"
                  amountCents={overview.totalSaved}
                  accent="positive"
                />
                <StatCard
                  label="Total Targeted"
                  amountCents={overview.totalTarget}
                />
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Overall Progress
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {overview.overallPct.toFixed(0)}%
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${overview.overallPct}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Goals On Track
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {overview.onTrack}
                    <span className="ml-1 text-base font-normal text-slate-400">
                      / {overview.count}
                    </span>
                  </div>
                </div>
              </div>

              {rows.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-3">
                    <h2 className="text-sm font-semibold text-slate-700">
                      All Goals Progress
                    </h2>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {rows.map(({ goal, progress }) => {
                      const palette = goalTypePalette(goal.type)
                      const isIncome = goal.type === 'income_target'
                      const current = isIncome ? incomeYTDCents : progress.current
                      const target = progress.target
                      const pct =
                        target > 0 ? Math.min(100, (current / target) * 100) : 0
                      return (
                        <li
                          key={goal.id}
                          className="flex items-center gap-4 px-5 py-3"
                        >
                          <div className="flex w-56 shrink-0 items-center gap-2">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${palette.bar}`}
                              aria-hidden
                            />
                            <span className="truncate text-sm font-medium text-slate-900">
                              {goal.name}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              {goalTypeLabel(goal.type)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all ${palette.bar}`}
                                style={{ width: `${pct}%` }}
                                aria-hidden
                              />
                            </div>
                          </div>
                          <div className="w-12 text-right font-mono text-xs tabular-nums text-slate-500">
                            {pct.toFixed(0)}%
                          </div>
                          <div className="w-44 text-right font-mono text-xs tabular-nums text-slate-500">
                            {formatDollars(current)}
                            <span className="text-slate-400">
                              {' '}
                              / {formatDollars(target)}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Your Goals
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setModalMode('create')
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                >
                  + New Goal
                </button>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
                  <span className="mr-1.5 text-base">🎯</span>No savings goals yet. Create your first goal to start tracking your financial targets.
                </div>
              ) : (
                <div className="space-y-4">
                  {rows.map(({ goal, progress }) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      progress={progress}
                      incomeTargetCurrentCents={
                        goal.type === 'income_target' ? incomeYTDCents : undefined
                      }
                      onEdit={() => {
                        setEditing(goal)
                        setModalMode('edit')
                      }}
                      onDelete={() => void handleDelete(goal.id, goal.name)}
                      onAddFunds={(cents) => handleAddFunds(goal, cents)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {modalMode === 'create' && (
        <GoalModal
          mode="create"
          onCancel={() => setModalMode(null)}
          onSubmit={handleCreate}
        />
      )}
      {modalMode === 'edit' && editing && (
        <GoalModal
          mode="edit"
          initial={editing}
          onCancel={() => {
            setModalMode(null)
            setEditing(null)
          }}
          onSubmit={handleUpdate}
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
