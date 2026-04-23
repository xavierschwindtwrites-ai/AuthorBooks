import type { Category } from '../lib/api'
import { colorHex } from '../lib/format'

export type BusinessFilter = 'all' | 'business' | 'personal'
export type TypeFilter = 'all' | 'expense' | 'income'

export type FilterState = {
  search: string
  dateFrom: string
  dateTo: string
  categoryIds: string[]
  businessType: BusinessFilter
  type: TypeFilter
}

export const INITIAL_FILTERS: FilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  categoryIds: [],
  businessType: 'all',
  type: 'all',
}

type Props = {
  filters: FilterState
  categories: Category[]
  onChange: (next: FilterState) => void
  onClear: () => void
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetRange(preset: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all'): {
  from: string
  to: string
} {
  const now = new Date()
  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'thisYear') {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    }
  }
  const offset = preset === 'lastMonth' ? -1 : 0
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: ymd(start), to: ymd(end) }
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'
const inputCls =
  'block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'

export default function TransactionFilters({
  filters,
  categories,
  onChange,
  onClear,
}: Props) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  function applyPreset(p: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all') {
    const { from, to } = presetRange(p)
    onChange({ ...filters, dateFrom: from, dateTo: to })
  }

  function toggleCategory(id: string) {
    const has = filters.categoryIds.includes(id)
    const next = has
      ? filters.categoryIds.filter((c) => c !== id)
      : [...filters.categoryIds, id]
    set('categoryIds', next)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-5">
      <div>
        <label htmlFor="flt-search" className={labelCls}>
          Search
        </label>
        <input
          id="flt-search"
          type="search"
          placeholder="Vendor, description, notes…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          className={`mt-1.5 ${inputCls}`}
        />
      </div>

      <div>
        <span className={labelCls}>Date Range</span>
        <div className="mt-1.5 space-y-1.5">
          <input
            type="date"
            aria-label="Date from"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
            className={inputCls}
          />
          <input
            type="date"
            aria-label="Date to"
            value={filters.dateTo}
            onChange={(e) => set('dateTo', e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(
            [
              ['thisMonth', 'This Month'],
              ['lastMonth', 'Last Month'],
              ['thisYear', 'This Year'],
              ['all', 'All Time'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Category</span>
        <div className="mt-1.5 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {categories.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-slate-400">No categories</div>
          ) : (
            categories.map((c) => {
              const checked = filters.categoryIds.includes(c.id)
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(c.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorHex(c.color) }}
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              )
            })
          )}
        </div>
      </div>

      <div>
        <span className={labelCls}>Business / Personal</span>
        <div className="mt-1.5 space-y-1">
          {(
            [
              ['all', 'All'],
              ['business', 'Business'],
              ['personal', 'Personal'],
            ] as const
          ).map(([val, label]) => (
            <label
              key={val}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name="flt-business"
                checked={filters.businessType === val}
                onChange={() => set('businessType', val)}
                className="h-3.5 w-3.5 border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Type</span>
        <div className="mt-1.5 space-y-1">
          {(
            [
              ['all', 'All'],
              ['expense', 'Expenses'],
              ['income', 'Income'],
            ] as const
          ).map(([val, label]) => (
            <label
              key={val}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name="flt-type"
                checked={filters.type === val}
                onChange={() => set('type', val)}
                className="h-3.5 w-3.5 border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="mt-auto rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Clear Filters
      </button>
    </aside>
  )
}
