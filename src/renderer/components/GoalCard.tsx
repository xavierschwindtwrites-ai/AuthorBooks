import { useState } from 'react'
import AddFundsForm from './AddFundsForm'
import StarRating from './StarRating'
import { goalTypeLabel, goalTypePalette } from './GoalModal'
import type { SavingsGoal, SavingsProgress } from '../lib/api'
import { formatDate, formatDollars } from '../lib/format'

type Props = {
  goal: SavingsGoal
  progress: SavingsProgress
  incomeTargetCurrentCents?: number
  onEdit: () => void
  onDelete: () => void
  onAddFunds: (amountCents: number) => Promise<void>
}

export default function GoalCard({
  goal,
  progress,
  incomeTargetCurrentCents,
  onEdit,
  onDelete,
  onAddFunds,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const palette = goalTypePalette(goal.type)

  const isIncomeTarget = goal.type === 'income_target'
  const displayCurrent =
    isIncomeTarget && incomeTargetCurrentCents !== undefined
      ? incomeTargetCurrentCents
      : progress.current
  const displayTarget = progress.target
  const displayPct =
    displayTarget > 0
      ? Math.min(100, (displayCurrent / displayTarget) * 100)
      : 0
  const clampedPct = Math.max(0, Math.min(100, displayPct))
  const onTrack = isIncomeTarget ? displayPct >= 0 : progress.onTrack

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{goal.name}</h3>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette.badge}`}
            >
              {goalTypeLabel(goal.type)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              P{goal.priority}
              <StarRating
                value={goal.priority}
                readOnly
                size="sm"
                ariaLabel={`Priority ${goal.priority}`}
              />
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              {goal.deadline ? (
                <>By {formatDate(goal.deadline)}</>
              ) : (
                <>No deadline</>
              )}
            </span>
            {onTrack ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                On Track ✓
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                Off Track ⚠️
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Edit"
            aria-label="Edit"
            onClick={onEdit}
            className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            title="Delete"
            aria-label="Delete"
            onClick={() => setConfirmingDelete(true)}
            className="rounded p-1.5 text-rose-600 transition hover:bg-rose-50"
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            + Add Funds
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${palette.bar}`}
            style={{ width: `${clampedPct}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          {isIncomeTarget ? (
            <div className="text-sm text-slate-700">
              Earned{' '}
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {formatDollars(displayCurrent)}
              </span>{' '}
              of{' '}
              <span className="font-mono tabular-nums text-slate-500">
                {formatDollars(displayTarget)}
              </span>{' '}
              target this year
            </div>
          ) : (
            <div className="text-sm text-slate-700">
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {formatDollars(displayCurrent)}
              </span>{' '}
              saved of{' '}
              <span className="font-mono tabular-nums text-slate-500">
                {formatDollars(displayTarget)}
              </span>{' '}
              target
            </div>
          )}
          <div className="font-mono text-sm font-semibold tabular-nums text-slate-700">
            {clampedPct.toFixed(0)}%
          </div>
        </div>
        {isIncomeTarget && (
          <div className="mt-1 text-xs text-slate-500">
            On pace for{' '}
            <span className="font-mono tabular-nums">
              {formatDollars(paceFor(displayCurrent))}
            </span>
            /year
          </div>
        )}
      </div>

      {goal.notes && (
        <p className="mt-4 text-xs italic text-slate-500">{goal.notes}</p>
      )}

      {adding && (
        <div className="mt-4">
          <AddFundsForm
            onCancel={() => setAdding(false)}
            onConfirm={async (cents) => {
              await onAddFunds(cents)
              setAdding(false)
            }}
          />
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          <div className="text-sm text-rose-800">
            Delete <strong>{goal.name}</strong>? This cannot be undone.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false)
                onDelete()
              }}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-700"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function paceFor(ytdCents: number): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1).getTime()
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime()
  const totalMs = end - start
  const elapsedMs = Math.max(1, now.getTime() - start)
  const fraction = elapsedMs / totalMs
  if (fraction <= 0) return 0
  return Math.round(ytdCents / fraction)
}

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
