import { colorHex } from '../lib/format'

export const PRESET_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'gray',
] as const

export type PresetColor = (typeof PRESET_COLORS)[number]

type Props = {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {PRESET_COLORS.map((c) => {
        const selected = value === c
        return (
          <button
            key={c}
            type="button"
            aria-label={c}
            title={c}
            onClick={() => onChange(c)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition ${
              selected
                ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2'
                : 'border-slate-200 hover:border-slate-400'
            }`}
            style={{ backgroundColor: colorHex(c) }}
          >
            {selected && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-white drop-shadow"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 0 1 0 1.42l-8 8a1 1 0 0 1-1.42 0l-4-4a1 1 0 1 1 1.42-1.42L8 12.586l7.293-7.293a1 1 0 0 1 1.41 0Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
