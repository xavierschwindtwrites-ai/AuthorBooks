import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type {
  Category,
  Subscription,
  Transaction,
} from '../lib/api'
import { monthRange } from '../lib/format'
import StatCard from '../components/StatCard'
import DisposableIncomePanel from '../components/DisposableIncomePanel'
import SpendingPieChart, { type PieSlice } from '../components/SpendingPieChart'
import RecentTransactions from '../components/RecentTransactions'
import UpcomingRenewals from '../components/UpcomingRenewals'
import GoalsProgress, { type GoalWithProgress } from '../components/GoalsProgress'

type DashboardData = {
  thisMonth: {
    incomeCents: number
    businessExpensesCents: number
    personalExpensesCents: number
  }
  lastMonth: {
    incomeCents: number
    businessExpensesCents: number
    personalExpensesCents: number
  }
  subscriptionsMonthlyCents: number
  recentTransactions: Transaction[]
  categories: Category[]
  spendingSlices: PieSlice[]
  renewingSoon: Subscription[]
  goals: GoalWithProgress[]
}

function sum<T>(arr: T[], fn: (x: T) => number): number {
  let total = 0
  for (const x of arr) total += fn(x)
  return total
}

async function loadDashboard(): Promise<DashboardData> {
  const thisM = monthRange(0)
  const lastM = monthRange(-1)

  const [
    thisIncome,
    lastIncome,
    thisTxns,
    lastTxns,
    subsMonthly,
    recent,
    categories,
    renewingSoon,
    goals,
  ] = await Promise.all([
    api.income.getAll(thisM.from, thisM.to),
    api.income.getAll(lastM.from, lastM.to),
    api.transactions.getAll({ dateFrom: thisM.from, dateTo: thisM.to }),
    api.transactions.getAll({ dateFrom: lastM.from, dateTo: lastM.to }),
    api.subscriptions.getMonthlyTotal(),
    api.transactions.getRecent(10),
    api.categories.getAll(),
    api.subscriptions.getRenewing(30),
    api.savingsGoals.getAll(),
  ])

  const goalsWithProgress = await Promise.all(
    goals.map(async (g) => ({
      goal: g,
      progress: await api.savingsGoals.getProgress(g.id),
    })),
  )

  const thisIncomeCents = sum(thisIncome, (x) => x.amount)
  const lastIncomeCents = sum(lastIncome, (x) => x.amount)

  const thisBusinessCents = sum(
    thisTxns.filter((t) => t.type === 'expense' && t.businessType === 'business'),
    (t) => t.amount,
  )
  const thisPersonalCents = sum(
    thisTxns.filter((t) => t.type === 'expense' && t.businessType === 'personal'),
    (t) => t.amount,
  )
  const lastBusinessCents = sum(
    lastTxns.filter((t) => t.type === 'expense' && t.businessType === 'business'),
    (t) => t.amount,
  )
  const lastPersonalCents = sum(
    lastTxns.filter((t) => t.type === 'expense' && t.businessType === 'personal'),
    (t) => t.amount,
  )

  const catById = new Map(categories.map((c) => [c.id, c]))
  const byCategory = new Map<string, number>()
  for (const t of thisTxns) {
    if (t.type !== 'expense') continue
    const key = t.categoryId ?? '__uncategorized__'
    byCategory.set(key, (byCategory.get(key) ?? 0) + t.amount)
  }
  const spendingSlices: PieSlice[] = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, amount]) => {
      const cat = catById.get(id)
      return {
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? 'gray',
        amountCents: amount,
      }
    })

  return {
    thisMonth: {
      incomeCents: thisIncomeCents,
      businessExpensesCents: thisBusinessCents,
      personalExpensesCents: thisPersonalCents,
    },
    lastMonth: {
      incomeCents: lastIncomeCents,
      businessExpensesCents: lastBusinessCents,
      personalExpensesCents: lastPersonalCents,
    },
    subscriptionsMonthlyCents: subsMonthly,
    recentTransactions: recent,
    categories,
    spendingSlices,
    renewingSoon,
    goals: goalsWithProgress,
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setData(null)
    loadDashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <main className="flex-1 overflow-auto p-10">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load dashboard: {error}
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading dashboard…
        </div>
      </main>
    )
  }

  const thisNetCents =
    data.thisMonth.incomeCents -
    data.thisMonth.businessExpensesCents -
    data.thisMonth.personalExpensesCents
  const lastNetCents =
    data.lastMonth.incomeCents -
    data.lastMonth.businessExpensesCents -
    data.lastMonth.personalExpensesCents

  const isEmpty =
    data.recentTransactions.length === 0 &&
    data.thisMonth.incomeCents === 0 &&
    data.thisMonth.businessExpensesCents === 0 &&
    data.thisMonth.personalExpensesCents === 0

  return (
    <main className="flex-1 overflow-auto bg-slate-50 p-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <Link
          to="/transactions/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          + New Transaction
        </Link>
      </header>

      {isEmpty && (
        <section className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 p-6">
          <h2 className="mb-1 text-base font-semibold text-indigo-900">
            Getting started with AuthorBooks
          </h2>
          <p className="mb-4 text-sm text-indigo-700">
            Your dashboard will fill up as you add data. Here's what to do first:
          </p>
          <ol className="space-y-2 text-sm text-indigo-800">
            {([
              ['Add a transaction', '/transactions/new', 'Record your first expense or income'],
              ['Create a project', '/projects', 'Link spending to a book or series'],
              ['Set a savings goal', '/goals', 'Track progress toward a financial target'],
              ['Set up AI features', '/settings', 'Enable receipt scanning and auto-categorization'],
            ] as [string, string, string][]).map(([label, to, desc], i) => (
              <li key={label} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700">
                  {i + 1}
                </span>
                <span>
                  <Link to={to} className="font-medium text-indigo-900 hover:underline">
                    {label}
                  </Link>
                  <span className="ml-1.5 text-indigo-600">{desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Income this month"
          amountCents={data.thisMonth.incomeCents}
          previousCents={data.lastMonth.incomeCents}
          accent="positive"
        />
        <StatCard
          label="Business expenses"
          amountCents={data.thisMonth.businessExpensesCents}
          previousCents={data.lastMonth.businessExpensesCents}
        />
        <StatCard
          label="Personal expenses"
          amountCents={data.thisMonth.personalExpensesCents}
          previousCents={data.lastMonth.personalExpensesCents}
        />
        <StatCard
          label="Net this month"
          amountCents={thisNetCents}
          previousCents={lastNetCents}
          accent={thisNetCents >= 0 ? 'positive' : 'negative'}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DisposableIncomePanel
            incomeCents={data.thisMonth.incomeCents}
            businessExpensesCents={data.thisMonth.businessExpensesCents}
            personalExpensesCents={data.thisMonth.personalExpensesCents}
            subscriptionsCents={data.subscriptionsMonthlyCents}
          />
        </div>
        <div className="lg:col-span-1">
          <SpendingPieChart slices={data.spendingSlices} />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions
            transactions={data.recentTransactions}
            categories={data.categories}
          />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-1">
          <UpcomingRenewals subscriptions={data.renewingSoon} />
          <GoalsProgress items={data.goals} />
        </div>
      </section>
    </main>
  )
}
