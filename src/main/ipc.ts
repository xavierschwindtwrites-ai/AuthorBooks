import { ipcMain, app, shell } from 'electron'
import fs from 'node:fs'
import nodePath from 'node:path'
import type { Database } from 'better-sqlite3'

import type {
  TransactionCreate,
  TransactionFilters,
  TransactionUpdate,
} from './services/TransactionService'
import type {
  CategoryCreate,
  CategoryUpdate,
} from './services/CategoryService'
import type {
  ProjectCreate,
  ProjectUpdate,
} from './services/ProjectService'
import type { JobCreate, JobUpdate } from './services/JobService'
import type {
  WorkLogCreate,
  WorkLogUpdate,
} from './services/WorkLogService'
import type {
  IncomeCreate,
  IncomeUpdate,
} from './services/IncomeService'
import type {
  SubscriptionCreate,
  SubscriptionUpdate,
} from './services/SubscriptionService'
import type {
  SavingsGoalCreate,
  SavingsGoalUpdate,
} from './services/SavingsGoalService'
import type { BusinessType } from '../types'
import { getSettings, saveSettings, type Settings } from './settings'
import { restartBackend, stopBackend } from './backend/server'

type IpcResponse<T> = { data: T } | { error: string }

export async function registerIpcHandlers(_db: Database): Promise<void> {
  const {
    transactions,
    categories,
    projects,
    jobs,
    workLogs,
    income,
    subscriptions,
    savingsGoals,
  } = await import('./services')

  const handle = <A extends unknown[], R>(
    channel: string,
    fn: (...args: A) => R | Promise<R>,
  ): void => {
    ipcMain.handle(
      channel,
      async (_e, ...args: unknown[]): Promise<IpcResponse<R>> => {
        try {
          const data = await Promise.resolve(fn(...(args as A)))
          return { data }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.error(`[ipc] ${channel} failed:`, e)
          return { error: message }
        }
      },
    )
  }

  handle('transactions:create', (data: TransactionCreate) =>
    transactions.create(data),
  )
  handle('transactions:getAll', (filters?: TransactionFilters) =>
    transactions.getAll(filters),
  )
  handle('transactions:getById', (id: string) => transactions.getById(id))
  handle('transactions:update', (id: string, updates: TransactionUpdate) =>
    transactions.update(id, updates),
  )
  handle('transactions:delete', (id: string) => transactions.delete(id))
  handle('transactions:unlinkProject', (projectId: string) =>
    transactions.unlinkProject(projectId),
  )
  handle('transactions:getRecent', (n: number) => transactions.getRecentN(n))
  handle(
    'transactions:getTotal',
    (
      type: 'expense' | 'income',
      businessType?: string,
      dateFrom?: string,
      dateTo?: string,
    ) => transactions.getTotalByType(type, businessType, dateFrom, dateTo),
  )

  handle('categories:getAll', () => categories.getAll())
  handle('categories:create', (data: CategoryCreate) => categories.create(data))
  handle('categories:update', (id: string, updates: CategoryUpdate) =>
    categories.update(id, updates),
  )
  handle('categories:delete', (id: string) => categories.delete(id))

  handle('projects:getAll', () => projects.getAll())
  handle('projects:getRoots', () => projects.getRootProjects())
  handle('projects:getChildren', (parentId: string) => projects.getChildren(parentId))
  handle('projects:create', (data: ProjectCreate) => projects.create(data))
  handle('projects:update', (id: string, updates: ProjectUpdate) =>
    projects.update(id, updates),
  )
  handle('projects:delete', (id: string) => projects.delete(id))
  handle('projects:getSummary', (id: string) => projects.getSummary(id))

  handle('jobs:getAll', () => jobs.getAll())
  handle('jobs:getActive', () => jobs.getActive())
  handle('jobs:create', (data: JobCreate) => jobs.create(data))
  handle('jobs:update', (id: string, updates: JobUpdate) =>
    jobs.update(id, updates),
  )
  handle('jobs:delete', (id: string) => jobs.delete(id))

  handle('workLogs:create', (data: WorkLogCreate) => workLogs.create(data))
  handle(
    'workLogs:getByJob',
    (jobId: string, dateFrom?: string, dateTo?: string) =>
      workLogs.getByJob(jobId, dateFrom, dateTo),
  )
  handle('workLogs:update', (id: string, updates: WorkLogUpdate) =>
    workLogs.update(id, updates),
  )
  handle('workLogs:delete', (id: string) => workLogs.delete(id))
  handle('workLogs:getTotalHours', (jobId: string) =>
    workLogs.getTotalHoursByJob(jobId),
  )
  handle('workLogs:getAllJobs', () => workLogs.getAllJobs())

  handle('income:getAll', (dateFrom?: string, dateTo?: string) =>
    income.getAll(dateFrom, dateTo),
  )
  handle('income:create', (data: IncomeCreate) => income.create(data))
  handle('income:update', (id: string, updates: IncomeUpdate) =>
    income.update(id, updates),
  )
  handle('income:delete', (id: string) => income.delete(id))
  handle('income:getTotalBySource', () => income.getTotalBySource())

  handle('subscriptions:getAll', () => subscriptions.getAll())
  handle('subscriptions:getActive', () => subscriptions.getActive())
  handle('subscriptions:getRenewing', (days: number) =>
    subscriptions.getRenewingSoon(days),
  )
  handle('subscriptions:getMonthlyTotal', (businessType?: BusinessType) =>
    subscriptions.getMonthlyTotal(businessType),
  )
  handle('subscriptions:create', (data: SubscriptionCreate) =>
    subscriptions.create(data),
  )
  handle('subscriptions:update', (id: string, updates: SubscriptionUpdate) =>
    subscriptions.update(id, updates),
  )
  handle('subscriptions:delete', (id: string) => subscriptions.delete(id))

  handle('savingsGoals:getAll', () => savingsGoals.getAll())
  handle('savingsGoals:create', (data: SavingsGoalCreate) =>
    savingsGoals.create(data),
  )
  handle('savingsGoals:update', (id: string, updates: SavingsGoalUpdate) =>
    savingsGoals.update(id, updates),
  )
  handle('savingsGoals:delete', (id: string) => savingsGoals.delete(id))
  handle('savingsGoals:getProgress', (id: string) =>
    savingsGoals.getProgress(id),
  )

  handle('receipts:save', (data: { base64: string; filename: string }) => {
    const dir = nodePath.join(app.getPath('userData'), 'receipts')
    fs.mkdirSync(dir, { recursive: true })
    const safeName = nodePath.basename(data.filename).replace(/[^a-zA-Z0-9._\-]/g, '_')
    const filePath = nodePath.join(dir, safeName)
    if (!filePath.startsWith(dir + nodePath.sep)) {
      throw new Error('Invalid receipt filename')
    }
    fs.writeFileSync(filePath, Buffer.from(data.base64, 'base64'))
    return { path: filePath }
  })

  handle('receipts:open', async (filePath: string) => {
    await shell.openPath(filePath)
  })

  handle('settings:get', () => getSettings())
  handle('settings:save', (data: Settings) => {
    saveSettings(data)
  })
  handle('settings:restartBackend', async () => {
    const settings = getSettings()
    if (settings.openRouterApiKey) {
      await restartBackend(settings.openRouterApiKey)
    } else {
      await stopBackend()
    }
  })
}
