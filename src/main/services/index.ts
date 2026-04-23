import { getDB } from '../database'
import { TransactionService } from './TransactionService'
import { CategoryService } from './CategoryService'
import { ProjectService } from './ProjectService'
import { JobService } from './JobService'
import { WorkLogService } from './WorkLogService'
import { IncomeService } from './IncomeService'
import { SubscriptionService } from './SubscriptionService'
import { SavingsGoalService } from './SavingsGoalService'

export const transactions = new TransactionService(getDB())
export const categories = new CategoryService(getDB())
export const projects = new ProjectService(getDB())
export const jobs = new JobService(getDB())
export const workLogs = new WorkLogService(getDB())
export const income = new IncomeService(getDB())
export const subscriptions = new SubscriptionService(getDB())
export const savingsGoals = new SavingsGoalService(getDB())

export {
  TransactionService,
  CategoryService,
  ProjectService,
  JobService,
  WorkLogService,
  IncomeService,
  SubscriptionService,
  SavingsGoalService,
}
