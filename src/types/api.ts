import type {
  BusinessType,
  Category,
  Income,
  Job,
  Project,
  SavingsGoal,
  Subscription,
  Transaction,
  TransactionType,
  WorkLog,
} from './index'

import type {
  TransactionCreate,
  TransactionFilters,
  TransactionUpdate,
} from '../main/services/TransactionService'
import type {
  CategoryCreate,
  CategoryUpdate,
} from '../main/services/CategoryService'
import type {
  ProjectCreate,
  ProjectUpdate,
} from '../main/services/ProjectService'
import type { JobCreate, JobUpdate } from '../main/services/JobService'
import type {
  WorkLogCreate,
  WorkLogUpdate,
} from '../main/services/WorkLogService'
import type {
  IncomeCreate,
  IncomeUpdate,
} from '../main/services/IncomeService'
import type {
  SubscriptionCreate,
  SubscriptionUpdate,
} from '../main/services/SubscriptionService'
import type {
  SavingsGoalCreate,
  SavingsGoalUpdate,
} from '../main/services/SavingsGoalService'

export type {
  TransactionCreate,
  TransactionUpdate,
  TransactionFilters,
  CategoryCreate,
  CategoryUpdate,
  ProjectCreate,
  ProjectUpdate,
  JobCreate,
  JobUpdate,
  WorkLogCreate,
  WorkLogUpdate,
  IncomeCreate,
  IncomeUpdate,
  SubscriptionCreate,
  SubscriptionUpdate,
  SavingsGoalCreate,
  SavingsGoalUpdate,
}

export interface ProjectSummary {
  totalExpenses: number
  totalIncome: number
  net: number
}

export interface JobTotalHours {
  paid: number
  unpaid: number
  total: number
}

export interface JobRollup {
  jobId: string
  jobName: string
  totalHours: number
  paidHours: number
  income: number
  hourlyRate: number | null
}

export interface SourceTotal {
  source: string
  total: number
}

export interface SavingsProgress {
  current: number
  target: number
  percentage: number
  onTrack: boolean
}

export interface Api {
  transactions: {
    create: (data: TransactionCreate) => Promise<Transaction>
    getAll: (filters?: TransactionFilters) => Promise<Transaction[]>
    getById: (id: string) => Promise<Transaction | undefined>
    update: (id: string, updates: TransactionUpdate) => Promise<Transaction>
    delete: (id: string) => Promise<void>
    unlinkProject: (projectId: string) => Promise<void>
    getRecent: (n: number) => Promise<Transaction[]>
    getTotal: (
      type: TransactionType,
      businessType?: string,
      dateFrom?: string,
      dateTo?: string,
    ) => Promise<number>
  }
  categories: {
    getAll: () => Promise<Category[]>
    create: (data: CategoryCreate) => Promise<Category>
    update: (id: string, updates: CategoryUpdate) => Promise<Category>
    delete: (id: string) => Promise<void>
  }
  projects: {
    getAll: () => Promise<Project[]>
    getRoots: () => Promise<Project[]>
    getChildren: (parentId: string) => Promise<Project[]>
    create: (data: ProjectCreate) => Promise<Project>
    update: (id: string, updates: ProjectUpdate) => Promise<Project>
    delete: (id: string) => Promise<void>
    getSummary: (id: string) => Promise<ProjectSummary>
  }
  jobs: {
    getAll: () => Promise<Job[]>
    getActive: () => Promise<Job[]>
    create: (data: JobCreate) => Promise<Job>
    update: (id: string, updates: JobUpdate) => Promise<Job>
    delete: (id: string) => Promise<void>
  }
  workLogs: {
    create: (data: WorkLogCreate) => Promise<WorkLog>
    getByJob: (
      jobId: string,
      dateFrom?: string,
      dateTo?: string,
    ) => Promise<WorkLog[]>
    update: (id: string, updates: WorkLogUpdate) => Promise<WorkLog>
    delete: (id: string) => Promise<void>
    getTotalHours: (jobId: string) => Promise<JobTotalHours>
    getAllJobs: () => Promise<JobRollup[]>
  }
  income: {
    getAll: (dateFrom?: string, dateTo?: string) => Promise<Income[]>
    create: (data: IncomeCreate) => Promise<Income>
    update: (id: string, updates: IncomeUpdate) => Promise<Income>
    delete: (id: string) => Promise<void>
    getTotalBySource: () => Promise<SourceTotal[]>
  }
  subscriptions: {
    getAll: () => Promise<Subscription[]>
    getActive: () => Promise<Subscription[]>
    getRenewing: (days: number) => Promise<Subscription[]>
    getMonthlyTotal: (businessType?: BusinessType) => Promise<number>
    create: (data: SubscriptionCreate) => Promise<Subscription>
    update: (id: string, updates: SubscriptionUpdate) => Promise<Subscription>
    delete: (id: string) => Promise<void>
  }
  savingsGoals: {
    getAll: () => Promise<SavingsGoal[]>
    create: (data: SavingsGoalCreate) => Promise<SavingsGoal>
    update: (id: string, updates: SavingsGoalUpdate) => Promise<SavingsGoal>
    delete: (id: string) => Promise<void>
    getProgress: (id: string) => Promise<SavingsProgress>
  }
  receipts: {
    save: (data: { base64: string; filename: string }) => Promise<{ path: string }>
    open: (filePath: string) => Promise<void>
  }
  settings: {
    get: () => Promise<{
      openRouterApiKey?: string
      onboardingComplete?: boolean
      userName?: string
      businessName?: string
    }>
    save: (data: {
      openRouterApiKey?: string
      onboardingComplete?: boolean
      userName?: string
      businessName?: string
    }) => Promise<void>
    restartBackend: () => Promise<void>
  }
}
