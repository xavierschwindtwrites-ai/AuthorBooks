import { useEffect } from 'react'

type Props = {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
  durationMs?: number
}

export default function Toast({
  message,
  type = 'success',
  onClose,
  durationMs = 3000,
}: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs)
    return () => clearTimeout(t)
  }, [onClose, durationMs])

  const palette =
    type === 'success'
      ? 'bg-emerald-600 text-white'
      : 'bg-rose-600 text-white'
  const icon = type === 'success' ? '✓' : '✕'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${palette}`}
      >
        <span aria-hidden className="text-base leading-none">
          {icon}
        </span>
        {message}
      </div>
    </div>
  )
}
