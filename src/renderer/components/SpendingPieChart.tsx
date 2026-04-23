import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { colorHex, formatDollars } from '../lib/format'

export type PieSlice = {
  name: string
  amountCents: number
  color: string | null
}

type Props = {
  slices: PieSlice[]
}

export default function SpendingPieChart({ slices }: Props) {
  if (slices.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Spending by Category</h2>
        <div className="mt-6 py-12 text-center text-sm text-slate-400">
          No spending logged this month yet.
        </div>
      </div>
    )
  }

  const total = slices.reduce((s, x) => s + x.amountCents, 0)
  const data = slices.map((s) => ({
    name: s.name,
    value: s.amountCents,
    fill: colorHex(s.color),
  }))

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Spending by Category</h2>
      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                typeof value === 'number' ? formatDollars(value) : String(value)
              }
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {slices.map((s) => {
          const pct = total > 0 ? (s.amountCents / total) * 100 : 0
          return (
            <li key={s.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colorHex(s.color) }}
                />
                {s.name}
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                {formatDollars(s.amountCents)} ·{' '}
                <span className="text-slate-400">{pct.toFixed(0)}%</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
