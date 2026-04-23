import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Project, ProjectStatus, ProjectSummary } from '../lib/api'
import { formatDate, formatDollars } from '../lib/format'
import ProjectCard, {
  statusLabel,
  statusPalette,
} from '../components/ProjectCard'
import ProjectModal, {
  type ProjectFormValues,
} from '../components/ProjectModal'
import Toast from '../components/Toast'

type ToastState = { message: string; type: 'success' | 'error' }
type ViewMode = 'grid' | 'list'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [summaries, setSummaries] = useState<Map<string, ProjectSummary>>(
    new Map(),
  )
  const [summariesLoading, setSummariesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [view, setView] = useState<ViewMode>('grid')

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [subprojectParentId, setSubprojectParentId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [deleteWorking, setDeleteWorking] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await api.projects.getAll()
      setProjects(list)
      setLoading(false)
      setSummariesLoading(true)
      const entries = await Promise.all(
        list.map(async (p) => {
          try {
            const s = await api.projects.getSummary(p.id)
            return [p.id, s] as const
          } catch {
            return [p.id, { totalExpenses: 0, totalIncome: 0, net: 0 }] as const
          }
        }),
      )
      setSummaries(new Map(entries))
      setSummariesLoading(false)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
      setLoading(false)
      setSummariesLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  function openCreate() {
    setEditing(null)
    setSubprojectParentId(null)
    setModalMode('create')
  }

  function openCreateSubproject(parentId: string) {
    setEditing(null)
    setSubprojectParentId(parentId)
    setModalMode('create')
  }

  function openEdit(project: Project) {
    setEditing(project)
    setSubprojectParentId(null)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditing(null)
    setSubprojectParentId(null)
  }

  async function handleSubmit(values: ProjectFormValues) {
    if (modalMode === 'create') {
      await api.projects.create({
        name: values.name,
        type: values.type,
        status: values.status,
        startDate: values.startDate,
        targetPublishDate: values.targetPublishDate,
        budget: values.budgetCents,
        notes: values.notes,
        parentId: values.parentId,
      })
      setToast({ message: 'Project created', type: 'success' })
    } else if (modalMode === 'edit' && editing) {
      await api.projects.update(editing.id, {
        name: values.name,
        type: values.type,
        status: values.status,
        startDate: values.startDate,
        targetPublishDate: values.targetPublishDate,
        budget: values.budgetCents,
        notes: values.notes,
        parentId: values.parentId,
      })
      setToast({ message: 'Project updated', type: 'success' })
    }
    closeModal()
    await refetch()
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteWorking(true)
    try {
      await api.transactions.unlinkProject(deleting.id)
      await api.projects.delete(deleting.id)
      setToast({ message: 'Project deleted', type: 'success' })
      setDeleting(null)
      await refetch()
    } catch (e: unknown) {
      setToast({
        message: `Delete failed: ${e instanceof Error ? e.message : String(e)}`,
        type: 'error',
      })
    } finally {
      setDeleteWorking(false)
    }
  }

  const rootProjects = projects.filter((p) => !p.parentId)
  const childrenMap = new Map<string, Project[]>()
  for (const p of projects) {
    if (p.parentId) {
      const arr = childrenMap.get(p.parentId) ?? []
      arr.push(p)
      childrenMap.set(p.parentId, arr)
    }
  }

  const editingHasChildren = editing
    ? projects.some((p) => p.parentId === editing.id)
    : false

  const viewToggle = (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      {(['grid', 'list'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={`px-3 py-1.5 text-sm font-medium transition ${
            view === v
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {v === 'grid' ? 'Grid' : 'List'}
        </button>
      ))}
    </div>
  )

  return (
    <main className="flex-1 overflow-auto bg-slate-50 p-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">
            Track spending and income per book or series.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {viewToggle}
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            + New Project
          </button>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load projects: {loadError}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
          <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          <span className="mr-1.5 text-base">📚</span>No projects yet. Create your first project to track spending by book or series.
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rootProjects.map((root) => {
            const children = childrenMap.get(root.id) ?? []
            return (
              <div key={root.id} className="flex flex-col gap-2">
                <ProjectCard
                  project={root}
                  summary={summaries.get(root.id) ?? null}
                  summaryLoading={summariesLoading && !summaries.has(root.id)}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                />
                {(children.length > 0 || true) && (
                  <div className="ml-4 flex flex-col gap-1.5 border-l-2 border-slate-200 pl-3">
                    {children.map((child) => (
                      <SubprojectCard
                        key={child.id}
                        project={child}
                        summary={summaries.get(child.id) ?? null}
                        summaryLoading={summariesLoading && !summaries.has(child.id)}
                        onEdit={openEdit}
                        onDelete={setDeleting}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => openCreateSubproject(root.id)}
                      className="mt-0.5 rounded-md px-2 py-1 text-left text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      + Add Subproject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <ProjectsList
          rootProjects={rootProjects}
          childrenMap={childrenMap}
          summaries={summaries}
          summariesLoading={summariesLoading}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      )}

      {modalMode && (
        <ProjectModal
          mode={modalMode}
          initial={editing ?? undefined}
          initialParentId={subprojectParentId}
          hasChildren={editingHasChildren}
          onCancel={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteWorking) setDeleting(null)
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Delete Project
              </h2>
            </div>
            <div className="px-6 py-5 text-sm text-slate-700">
              Delete <strong>{deleting.name}</strong>? This will not delete
              associated transactions, just unlink them.
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={deleteWorking}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteWorking}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-60"
              >
                {deleteWorking ? 'Deleting…' : 'Delete Project'}
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

type SubprojectCardProps = {
  project: Project
  summary: ProjectSummary | null
  summaryLoading: boolean
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
}

function SubprojectCard({
  project,
  summary,
  summaryLoading,
  onEdit,
  onDelete,
}: SubprojectCardProps) {
  const navigate = useNavigate()
  const loadingCell = (
    <span className="inline-block h-2.5 w-12 animate-pulse rounded bg-slate-100" />
  )
  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/projects/${project.id}`)
        }
      }}
      className="group flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-800">{project.name}</span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusPalette(project.status)}`}
          >
            {statusLabel(project.status)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
          <span>
            Spent{' '}
            <span className="font-mono text-rose-600">
              {summaryLoading ? loadingCell : formatDollars(summary?.totalExpenses ?? 0)}
            </span>
          </span>
          <span>
            Net{' '}
            <span
              className={`font-mono font-medium ${(summary?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              {summaryLoading ? loadingCell : formatDollars(summary?.net ?? 0)}
            </span>
          </span>
        </div>
      </div>
      <div
        className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Edit"
          onClick={() => onEdit(project)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Delete"
          onClick={() => onDelete(project)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75V4H3.5a.75.75 0 0 0 0 1.5h.553l.717 11.186A2.75 2.75 0 0 0 7.516 19h4.968a2.75 2.75 0 0 0 2.746-2.314L15.947 5.5h.553a.75.75 0 0 0 0-1.5H14v-.25A2.75 2.75 0 0 0 11.25 1h-2.5ZM7.5 4v-.25c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25V4h-5Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  )
}

type ListProps = {
  rootProjects: Project[]
  childrenMap: Map<string, Project[]>
  summaries: Map<string, ProjectSummary>
  summariesLoading: boolean
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
}

function ProjectsList({
  rootProjects,
  childrenMap,
  summaries,
  summariesLoading,
  onEdit,
  onDelete,
}: ListProps) {
  const loadingCell = (
    <span className="inline-block h-3 w-16 animate-pulse rounded bg-slate-100" />
  )

  function renderRow(p: Project, isChild: boolean) {
    const s = summaries.get(p.id)
    const showLoading = summariesLoading && !s
    const status = (p.status ?? null) as ProjectStatus | null
    return (
      <tr
        key={p.id}
        className={`border-t border-slate-100 hover:bg-slate-50 ${isChild ? 'bg-slate-50/50' : ''}`}
      >
        <td className="px-4 py-3">
          <Link
            to={`/projects/${p.id}`}
            className={`font-medium hover:underline ${isChild ? 'text-slate-500' : 'text-slate-900'}`}
          >
            {isChild ? <span className="mr-1 text-slate-400">└</span> : null}
            {p.name}
          </Link>
        </td>
        <td className={`px-4 py-3 text-xs ${isChild ? 'text-slate-400' : 'text-slate-600'}`}>
          {p.type ?? '—'}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusPalette(status)}`}
          >
            {statusLabel(status)}
          </span>
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${isChild ? 'text-slate-400' : 'text-slate-700'}`}>
          {p.budget !== null ? (
            formatDollars(p.budget)
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${isChild ? 'text-rose-400' : 'text-rose-600'}`}>
          {showLoading ? loadingCell : formatDollars(s?.totalExpenses ?? 0)}
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${isChild ? 'text-emerald-400' : 'text-emerald-600'}`}>
          {showLoading ? loadingCell : formatDollars(s?.totalIncome ?? 0)}
        </td>
        <td
          className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${
            (s?.net ?? 0) >= 0
              ? isChild ? 'text-emerald-400' : 'text-emerald-600'
              : isChild ? 'text-rose-400' : 'text-rose-600'
          }`}
        >
          {showLoading ? loadingCell : formatDollars(s?.net ?? 0)}
        </td>
        <td className={`whitespace-nowrap px-4 py-3 text-xs ${isChild ? 'text-slate-400' : 'text-slate-600'}`}>
          {p.startDate ? formatDate(p.startDate) : '—'}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          <button
            type="button"
            aria-label="Edit"
            title="Edit"
            onClick={() => onEdit(p)}
            className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Delete"
            title="Delete"
            onClick={() => onDelete(p)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75V4H3.5a.75.75 0 0 0 0 1.5h.553l.717 11.186A2.75 2.75 0 0 0 7.516 19h4.968a2.75 2.75 0 0 0 2.746-2.314L15.947 5.5h.553a.75.75 0 0 0 0-1.5H14v-.25A2.75 2.75 0 0 0 11.25 1h-2.5ZM7.5 4v-.25c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25V4h-5Z" clipRule="evenodd" />
            </svg>
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium">Budget</th>
            <th className="px-4 py-2 text-right font-medium">Spent</th>
            <th className="px-4 py-2 text-right font-medium">Income</th>
            <th className="px-4 py-2 text-right font-medium">Net</th>
            <th className="px-4 py-2 font-medium">Start Date</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rootProjects.map((root) => (
            <>
              {renderRow(root, false)}
              {(childrenMap.get(root.id) ?? []).map((child) =>
                renderRow(child, true),
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
