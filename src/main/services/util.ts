export function toBool(v: unknown): boolean {
  return v === 1 || v === true
}

export function toInt(v: boolean | undefined | null): number {
  return v ? 1 : 0
}

export function parseJSONArray<T>(v: string | null | undefined): T[] | null {
  if (!v) return null
  try {
    const parsed = JSON.parse(v)
    return Array.isArray(parsed) ? (parsed as T[]) : null
  } catch {
    return null
  }
}

export function stringifyJSONArray<T>(v: T[] | null | undefined): string | null {
  if (v == null) return null
  return JSON.stringify(v)
}

export function nowISO(): string {
  return new Date().toISOString()
}
