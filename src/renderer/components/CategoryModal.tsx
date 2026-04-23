import { useEffect, useState, type FormEvent } from 'react'
import type { Category, BusinessType } from '../lib/api'
import ColorPicker, { PRESET_COLORS } from './ColorPicker'

export type CategoryBizType = 'business' | 'personal' | 'mixed'

export type CategoryFormValues = {
  name: string
  color: string
  defaultBusinessType: CategoryBizType
  defaultTaxDeductible: boolean
}

type Props = {
  mode: 'create' | 'edit'
  initial?: Category
  existingNames: string[] // already excludes self when editing
  onCancel: () => void
  onSubmit: (values: CategoryFormValues) => Promise<void>
}

export function bizTypeFromCategory(c: Category): CategoryBizType {
  const raw = c.defaultBusinessType as string
  if (raw === 'business' || raw === 'personal' || raw === 'mixed') return raw
  return 'business'
}

export function toStoredBusinessType(b: CategoryBizType): BusinessType {
  // The DB column is TEXT; BusinessType is 'business' | 'personal'.
  // We store 'mixed' as-is but cast through BusinessType at the API boundary.
  return b as BusinessType
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'
const inputCls =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'
const errorText = 'mt-1 text-xs text-rose-600'

export default function CategoryModal({
  mode,
  initial,
  existingNames,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState<string>(
    initial?.color && PRESET_COLORS.includes(initial.color as (typeof PRESET_COLORS)[number])
      ? initial.color
      : (initial?.color ?? 'blue'),
  )
  const [businessType, setBusinessType] = useState<CategoryBizType>(
    initial ? bizTypeFromCategory(initial) : 'business',
  )
  const [taxDeductible, setTaxDeductible] = useState<boolean>(
    initial?.defaultTaxDeductible ?? true,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    const trimmed = name.trim()
    if (!trimmed) {
      e.name = 'Name is required'
    } else if (
      existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())
    ) {
      e.name = 'A category with this name already exists'
    }
    return e
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name: name.trim(),
        color,
        defaultBusinessType: businessType,
        defaultTaxDeductible: taxDeductible,
      })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel()
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'create' ? 'New Category' : 'Edit Category'}
            </h2>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <label htmlFor="cat-name" className={labelCls}>
                Name
              </label>
              <input
                id="cat-name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                className={`${inputCls} ${errors.name ? 'border-rose-300' : ''}`}
                placeholder="e.g. Conferences"
              />
              {errors.name && <div className={errorText}>{errors.name}</div>}
            </div>

            <div>
              <span className={labelCls}>Color</span>
              <div className="mt-2">
                <ColorPicker value={color} onChange={setColor} />
              </div>
            </div>

            <div>
              <span className={labelCls}>Default Business Type</span>
              <div className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
                {(
                  [
                    ['business', 'Business', 'bg-blue-600'],
                    ['personal', 'Personal', 'bg-orange-500'],
                    ['mixed', 'Mixed', 'bg-slate-700'],
                  ] as const
                ).map(([val, label, activeCls]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBusinessType(val)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                      businessType === val
                        ? `${activeCls} text-white`
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={taxDeductible}
                  onChange={(e) => setTaxDeductible(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                Tax deductible by default
              </label>
            </div>

            {submitError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {submitError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
