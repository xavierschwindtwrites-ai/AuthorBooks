import type { SavingsGoal, SavingsProgress } from '../lib/api'
import { formatDollars } from '../lib/format'

export type GoalWithProgress = {
  goal: SavingsGoal
  progress: SavingsProgress
}

type Props = {
  items: GoalWithProgress[]
}

export default function GoalsProgress({ items }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Savings Goals</h2>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          No savings goals yet.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map(({ goal, progress }) => {
            const pct = Math.max(0, Math.min(100, progress.percentage))
            return (
              <li key={goal.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {goal.name}
                  </span>
                  <span className="ml-3 font-mono text-xs tabular-nums text-slate-500">
                    {formatDollars(progress.current)} /{' '}
                    <span className="text-slate-400">{formatDollars(progress.target)}</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress.onTrack ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-500">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
