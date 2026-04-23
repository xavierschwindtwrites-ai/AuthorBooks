type Props<K extends string> = {
  label: string
  sortKey: K
  activeKey: K
  direction: 'asc' | 'desc'
  onSort: (key: K) => void
  align?: 'left' | 'right'
  className?: string
}

export default function SortableHeader<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
  className = '',
}: Props<K>) {
  const isActive = sortKey === activeKey
  const indicator = isActive ? (direction === 'asc' ? '▲' : '▼') : ''
  return (
    <th
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition hover:text-slate-900 ${
          isActive ? 'text-slate-900' : ''
        }`}
      >
        {label}
        {indicator && <span className="text-[10px]">{indicator}</span>}
      </button>
    </th>
  )
}
