export function formatDollars(cents: number, opts: { signed?: boolean } = {}): string {
  const dollars = cents / 100
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  })
  return formatter.format(dollars)
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function monthRange(offset = 0): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: ymd(start), to: `${ymd(end)}T23:59:59.999Z` }
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso).getTime()
  if (Number.isNaN(target)) return null
  const now = Date.now()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export const COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
  green: '#22c55e',
  orange: '#f97316',
  yellow: '#eab308',
  red: '#ef4444',
  gray: '#6b7280',
  slate: '#64748b',
  teal: '#14b8a6',
  lime: '#84cc16',
  amber: '#f59e0b',
  rose: '#f43f5e',
  emerald: '#10b981',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  fuchsia: '#d946ef',
}

export function colorHex(color: string | null | undefined): string {
  if (!color) return COLOR_HEX.gray
  if (color.startsWith('#')) return color
  return COLOR_HEX[color] ?? COLOR_HEX.gray
}
