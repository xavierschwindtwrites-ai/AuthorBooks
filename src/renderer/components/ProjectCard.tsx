import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project, ProjectSummary, ProjectStatus } from '../lib/api'
import { formatDate, formatDollars } from '../lib/format'

type Props = {
  project: Project
  summary: ProjectSummary | null
  summaryLoading: boolean
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export function statusPalette(status: ProjectStatus | null): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'planning':
      return 'bg-blue-100 text-blue-700'
    case 'completed':
      return 'bg-slate-200 text-slate-700'
    case 'shelved':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export function statusLabel(status: ProjectStatus | null): string {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function ProjectCard({
  project,
  summary,
  summaryLoading,
  onEdit,
  onDelete,
}: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const budgetCents = project.budget ?? null
  const spentCents = summary?.totalExpenses ?? 0
  const incomeCents = summary?.totalIncome ?? 0
  const netCents = summary?.net ?? 0
  const pct =
    budgetCents && budgetCents > 0
      ? Math.min(100, (spentCents / budgetCents) * 100)
      : null

  function goDetail() {
    navigate(`/projects/${project.id}`)
  }

  return (
    <div
      onClick={goDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          goDetail()
        }
      }}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {project.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {project.type && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {project.type}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPalette(project.status)}`}
            >
              {statusLabel(project.status)}
            </span>
          </div>
        </div>
        <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Project actions"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit(project)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(project)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {project.startDate && (
        <p className="text-xs text-slate-500">
          Started {formatDate(project.startDate)}
        </p>
      )}

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Budget
          </span>
          <span className="font-mono tabular-nums text-slate-700">
            {budgetCents !== null ? (
              formatDollars(budgetCents)
            ) : (
              <span className="text-slate-400">No budget set</span>
            )}
          </span>
        </div>

        {summaryLoading ? (
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Spent
              </span>
              <span className="font-mono tabular-nums text-rose-600">
                {formatDollars(spentCents)}
              </span>
            </div>
            {pct !== null && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    pct >= 100
                      ? 'bg-rose-500'
                      : pct >= 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Income
              </span>
              <span className="font-mono tabular-nums text-emerald-600">
                {formatDollars(incomeCents)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Net
              </span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  netCents >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatDollars(netCents)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
