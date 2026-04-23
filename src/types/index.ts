export type BusinessType = 'business' | 'personal'

export type TransactionType = 'expense' | 'income'
export type TransactionStatus = 'pending' | 'cleared' | 'reconciled'

export type ProjectStatus = 'active' | 'planning' | 'completed' | 'shelved'

export type JobStatus = 'active' | 'completed' | 'paused'

export type SubscriptionPeriod = 'monthly' | 'quarterly' | 'yearly' | 'weekly'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export interface Category {
  id: string
  name: string
  color: string | null
  defaultTaxDeductible: boolean
  defaultBusinessType: BusinessType
  isCustom: boolean
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  type: string | null
  startDate: string | null
  targetPublishDate: string | null
  status: ProjectStatus | null
  budget: number | null
  notes: string | null
  parentId: string | null
  createdAt: string
}

export interface Transaction {
  id: string
  date: string
  amount: number
  type: TransactionType
  description: string | null
  vendor: string | null
  categoryId: string | null
  projectId: string | null
  notes: string | null
  tags: string[] | null
  businessType: BusinessType
  taxDeductible: boolean
  receiptPath: string | null
  status: TransactionStatus
  aiSuggested: boolean
  aiConfidence: number | null
  recurringId: string | null
  createdAt: string
}

export interface Income {
  id: string
  date: string
  amount: number
  source: string | null
  projectId: string | null
  jobId: string | null
  publisher: string | null
  platform: string | null
  description: string | null
  notes: string | null
  createdAt: string
}

export interface Job {
  id: string
  name: string
  type: string | null
  clientName: string | null
  hourlyRate: number | null
  status: JobStatus
  description: string | null
  notes: string | null
  createdAt: string
  completedAt: string | null
}

export interface WorkLog {
  id: string
  jobId: string
  date: string
  hoursWorked: number
  paid: boolean
  incomeAssociated: number | null
  description: string | null
  notes: string | null
  createdAt: string
}

export interface Subscription {
  id: string
  name: string
  vendor: string | null
  costPerPeriod: number
  period: SubscriptionPeriod
  nextRenewalDate: string | null
  businessType: BusinessType
  categoryId: string | null
  status: SubscriptionStatus
  pausedFrom: string | null
  pausedUntil: string | null
  notes: string | null
  createdAt: string
  lastRenewalDate: string | null
}

export interface SavingsGoal {
  id: string
  name: string
  type: string | null
  targetAmount: number
  currentAmount: number
  deadline: string | null
  priority: number
  description: string | null
  linkedCategories: string[] | null
  linkedIncomeStreams: string[] | null
  notes: string | null
  createdAt: string
}

export interface BudgetLimit {
  id: string
  categoryId: string | null
  period: string
  amount: number
  alertThreshold: number
  businessType: 'business' | 'personal' | 'both'
  createdAt: string
}
