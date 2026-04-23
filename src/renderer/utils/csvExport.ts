function escapeField(value: string | number): string {
  const raw = typeof value === 'number' ? String(value) : value
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function toCSVString(
  headers: string[],
  rows: (string | number)[][],
): string {
  const head = headers.map(escapeField).join(',')
  const body = rows.map((row) => row.map(escapeField).join(',')).join('\n')
  return body ? `${head}\n${body}\n` : `${head}\n`
}

export function exportCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const csv = toCSVString(headers, rows)
  // Prepend UTF-8 BOM so Excel/Numbers detect encoding correctly
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoke on next tick — some browsers need the URL to stay valid briefly
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function centsToDollarsString(cents: number): string {
  return (cents / 100).toFixed(2)
}
