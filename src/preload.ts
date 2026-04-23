import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './types/api'

type IpcResponse<T> = { data?: T; error?: string }

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const response = (await ipcRenderer.invoke(channel, ...args)) as IpcResponse<T>
  if (response.error !== undefined) throw new Error(response.error)
  return response.data as T
}

const api: Api = {
  transactions: {
    create: (data) => invoke('transactions:create', data),
    getAll: (filters) => invoke('transactions:getAll', filters),
    getById: (id) => invoke('transactions:getById', id),
    update: (id, updates) => invoke('transactions:update', id, updates),
    delete: (id) => invoke('transactions:delete', id),
    unlinkProject: (projectId) => invoke('transactions:unlinkProject', projectId),
    getRecent: (n) => invoke('transactions:getRecent', n),
    getTotal: (type, businessType, dateFrom, dateTo) =>
      invoke('transactions:getTotal', type, businessType, dateFrom, dateTo),
  },
  categories: {
    getAll: () => invoke('categories:getAll'),
    create: (data) => invoke('categories:create', data),
    update: (id, updates) => invoke('categories:update', id, updates),
    delete: (id) => invoke('categories:delete', id),
  },
  projects: {
    getAll: () => invoke('projects:getAll'),
    getRoots: () => invoke('projects:getRoots'),
    getChildren: (parentId) => invoke('projects:getChildren', parentId),
    create: (data) => invoke('projects:create', data),
    update: (id, updates) => invoke('projects:update', id, updates),
    delete: (id) => invoke('projects:delete', id),
    getSummary: (id) => invoke('projects:getSummary', id),
  },
  jobs: {
    getAll: () => invoke('jobs:getAll'),
    getActive: () => invoke('jobs:getActive'),
    create: (data) => invoke('jobs:create', data),
    update: (id, updates) => invoke('jobs:update', id, updates),
    delete: (id) => invoke('jobs:delete', id),
  },
  workLogs: {
    create: (data) => invoke('workLogs:create', data),
    getByJob: (jobId, dateFrom, dateTo) =>
      invoke('workLogs:getByJob', jobId, dateFrom, dateTo),
    update: (id, updates) => invoke('workLogs:update', id, updates),
    delete: (id) => invoke('workLogs:delete', id),
    getTotalHours: (jobId) => invoke('workLogs:getTotalHours', jobId),
    getAllJobs: () => invoke('workLogs:getAllJobs'),
  },
  income: {
    getAll: (dateFrom, dateTo) => invoke('income:getAll', dateFrom, dateTo),
    create: (data) => invoke('income:create', data),
    update: (id, updates) => invoke('income:update', id, updates),
    delete: (id) => invoke('income:delete', id),
    getTotalBySource: () => invoke('income:getTotalBySource'),
  },
  subscriptions: {
    getAll: () => invoke('subscriptions:getAll'),
    getActive: () => invoke('subscriptions:getActive'),
    getRenewing: (days) => invoke('subscriptions:getRenewing', days),
    getMonthlyTotal: (businessType) =>
      invoke('subscriptions:getMonthlyTotal', businessType),
    create: (data) => invoke('subscriptions:create', data),
    update: (id, updates) => invoke('subscriptions:update', id, updates),
    delete: (id) => invoke('subscriptions:delete', id),
  },
  savingsGoals: {
    getAll: () => invoke('savingsGoals:getAll'),
    create: (data) => invoke('savingsGoals:create', data),
    update: (id, updates) => invoke('savingsGoals:update', id, updates),
    delete: (id) => invoke('savingsGoals:delete', id),
    getProgress: (id) => invoke('savingsGoals:getProgress', id),
  },
  receipts: {
    save: (data) => invoke('receipts:save', data),
    open: (filePath) => invoke('receipts:open', filePath),
  },
  settings: {
    get: () => invoke('settings:get'),
    save: (data) => invoke('settings:save', data),
    restartBackend: () => invoke('settings:restartBackend'),
  },
}

contextBridge.exposeInMainWorld('api', api)
