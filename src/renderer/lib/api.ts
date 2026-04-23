import type { Api } from '../../types/api'

export const api: Api = window.api

export type {
  Api,
  ProjectSummary,
  JobTotalHours,
  JobRollup,
  SourceTotal,
  SavingsProgress,
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
} from '../../types/api'

export type {
  BusinessType,
  Category,
  Income,
  Job,
  Project,
  SavingsGoal,
  Subscription,
  Transaction,
  TransactionType,
  TransactionStatus,
  JobStatus,
  ProjectStatus,
  SubscriptionPeriod,
  SubscriptionStatus,
  WorkLog,
} from '../../types'
