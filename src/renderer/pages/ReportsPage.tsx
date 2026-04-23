import { useState } from 'react'
import CategoryBreakdown from '../components/reports/CategoryBreakdown'
import MonthlySummary from '../components/reports/MonthlySummary'
import ProjectSummaryReport from '../components/reports/ProjectSummaryReport'
import TaxReport from '../components/reports/TaxReport'

type TabKey = 'monthly' | 'category' | 'project' | 'tax'

type Tab = {
  key: TabKey
  label: string
  description: string
}

const TABS: Tab[] = [
  {
    key: 'monthly',
    label: 'Monthly Summary',
    description: 'Income, expenses, and net by month',
  },
  {
    key: 'category',
    label: 'Category Breakdown',
    description: 'Spending by category, with chart',
  },
  {
    key: 'project',
    label: 'Project Summary',
    description: 'All-time performance by project',
  },
  {
    key: 'tax',
    label: 'Tax Report',
    description: 'Deductible business expenses',
  },
]

export default function ReportsPage() {
  const [active, setActive] = useState<TabKey>('monthly')

  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0]

  return (
    <main className="flex flex-1 overflow-hidden">
      <aside className="w-[200px] shrink-0 border-r border-slate-200 bg-white px-3 py-6">
        <h2 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Reports
        </h2>
        <nav className="flex flex-col gap-1">
          {TABS.map((t) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? 'bg-slate-900 font-semibold text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </aside>
      <section className="flex-1 overflow-auto p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {activeTab.label}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{activeTab.description}</p>
        </header>
        {active === 'monthly' && <MonthlySummary />}
        {active === 'category' && <CategoryBreakdown />}
        {active === 'project' && <ProjectSummaryReport />}
        {active === 'tax' && <TaxReport />}
      </section>
    </main>
  )
}
