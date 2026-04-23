type Props = {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  readOnly?: boolean
  ariaLabel?: string
}

const STARS = [1, 2, 3, 4, 5] as const

export default function StarRating({
  value,
  onChange,
  size = 'md',
  readOnly = false,
  ariaLabel = 'Priority',
}: Props) {
  const sizeClass =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-lg'

  return (
    <div
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5"
    >
      {STARS.map((n) => {
        const filled = n <= value
        if (readOnly) {
          return (
            <span
              key={n}
              aria-hidden
              className={`${sizeClass} leading-none ${filled ? 'text-amber-500' : 'text-slate-300'}`}
            >
              ★
            </span>
          )
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`Priority ${n}`}
            onClick={() => onChange?.(n)}
            className={`${sizeClass} leading-none transition-transform hover:scale-110 focus:outline-none ${
              filled ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'
            }`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
