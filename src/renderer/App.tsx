import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './lib/api'
import Sidebar from './components/Sidebar'
import { ApiKeyProvider } from './lib/useApiKey'
import CategoriesPage from './pages/CategoriesPage'
import DashboardPage from './pages/DashboardPage'
import EditTransactionPage from './pages/EditTransactionPage'
import GoalsPage from './pages/GoalsPage'
import JobsPage from './pages/JobsPage'
import NewTransactionPage from './pages/NewTransactionPage'
import ChatPage from './pages/ChatPage'
import OnboardingPage from './pages/OnboardingPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectsPage from './pages/ProjectsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import TransactionsPage from './pages/TransactionsPage'

function Placeholder({ name }: { name: string }) {
  return (
    <main className="flex-1 overflow-auto p-10">
      <h1 className="text-3xl font-semibold text-slate-900">{name}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {name} screen — coming soon.
      </p>
    </main>
  )
}

function MainApp() {
  const location = useLocation()
  const isOnboarding = location.pathname === '/onboarding'

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {!isOnboarding && <Sidebar />}
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/new" element={<NewTransactionPage />} />
        <Route path="/transactions/edit/:id" element={<EditTransactionPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Placeholder name="Not Found" />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    api.settings.get().then((s) => {
      setNeedsOnboarding(!s.onboardingComplete)
      setReady(true)
    }).catch(() => {
      setNeedsOnboarding(false)
      setReady(true)
    })
  }, [])

  if (!ready) return null

  if (needsOnboarding) {
    return <OnboardingPage onComplete={() => setNeedsOnboarding(false)} />
  }

  return (
    <ApiKeyProvider>
      <MainApp />
    </ApiKeyProvider>
  )
}
