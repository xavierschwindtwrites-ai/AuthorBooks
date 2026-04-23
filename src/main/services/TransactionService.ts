import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
  BusinessType,
} from '../../types'
import { nowISO, parseJSONArray, stringifyJSONArray, toBool, toInt } from './util'

type Row = {
  id: string
  date: string
  amount: number
  type: string
  description: string | null
  vendor: string | null
  categoryId: string | null
  projectId: string | null
  notes: string | null
  tags: string | null
  businessType: string
  taxDeductible: number
  receiptPath: string | null
  status: string
  aiSuggested: number
  aiConfidence: number | null
  recurringId: string | null
  createdAt: string
}

export type TransactionCreate = {
  date: string
  amount: number
  type: TransactionType
  description?: string | null
  vendor?: string | null
  categoryId?: string | null
  projectId?: string | null
  notes?: string | null
  tags?: string[] | null
  businessType?: BusinessType
  taxDeductible?: boolean
  receiptPath?: string | null
  status?: TransactionStatus
  aiSuggested?: boolean
  aiConfidence?: number | null
  recurringId?: string | null
}

export type TransactionUpdate = Partial<TransactionCreate>

export type TransactionFilters = {
  dateFrom?: string
  dateTo?: string
  categoryId?: string
  businessType?: string
  projectId?: string
  search?: string
}

const INSERT_SQL = `
  INSERT INTO transactions (
    id, date, amount, type, description, vendor, categoryId, projectId,
    notes, tags, businessType, taxDeductible, receiptPath, status,
    aiSuggested, aiConfidence, recurringId, createdAt
  ) VALUES (
    @id, @date, @amount, @type, @description, @vendor, @categoryId, @projectId,
    @notes, @tags, @businessType, @taxDeductible, @receiptPath, @status,
    @aiSuggested, @aiConfidence, @recurringId, @createdAt
  )
`

export class TransactionService {
  constructor(private db: Database) {}

  private mapRow(r: Row): Transaction {
    return {
      id: r.id,
      date: r.date,
      amount: r.amount,
      type: r.type as TransactionType,
      description: r.description,
      vendor: r.vendor,
      categoryId: r.categoryId,
      projectId: r.projectId,
      notes: r.notes,
      tags: parseJSONArray<string>(r.tags),
      businessType: r.businessType as BusinessType,
      taxDeductible: toBool(r.taxDeductible),
      receiptPath: r.receiptPath,
      status: r.status as TransactionStatus,
      aiSuggested: toBool(r.aiSuggested),
      aiConfidence: r.aiConfidence,
      recurringId: r.recurringId,
      createdAt: r.createdAt,
    }
  }

  create(data: TransactionCreate): Transaction {
    const id = randomUUID()
    const params = {
      id,
      date: data.date,
      amount: data.amount,
      type: data.type,
      description: data.description ?? null,
      vendor: data.vendor ?? null,
      categoryId: data.categoryId ?? null,
      projectId: data.projectId ?? null,
      notes: data.notes ?? null,
      tags: stringifyJSONArray(data.tags ?? null),
      businessType: data.businessType ?? 'business',
      taxDeductible: toInt(data.taxDeductible ?? false),
      receiptPath: data.receiptPath ?? null,
      status: data.status ?? 'pending',
      aiSuggested: toInt(data.aiSuggested ?? false),
      aiConfidence: data.aiConfidence ?? null,
      recurringId: data.recurringId ?? null,
      createdAt: nowISO(),
    }
    try {
      this.db.prepare(INSERT_SQL).run(params)
    } catch (e) {
      throw new Error(`TransactionService.create failed: ${(e as Error).message}`)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error('TransactionService.create: row missing after insert')
    return fresh
  }

  getById(id: string): Transaction | undefined {
    const row = this.db
      .prepare('SELECT * FROM transactions WHERE id = ?')
      .get(id) as Row | undefined
    return row ? this.mapRow(row) : undefined
  }

  getAll(filters: TransactionFilters = {}): Transaction[] {
    const clauses: string[] = []
    const params: Record<string, unknown> = {}
    if (filters.dateFrom) {
      clauses.push('date >= @dateFrom')
      params.dateFrom = filters.dateFrom
    }
    if (filters.dateTo) {
      clauses.push('date <= @dateTo')
      params.dateTo = filters.dateTo
    }
    if (filters.categoryId) {
      clauses.push('categoryId = @categoryId')
      params.categoryId = filters.categoryId
    }
    if (filters.businessType) {
      clauses.push('businessType = @businessType')
      params.businessType = filters.businessType
    }
    if (filters.projectId) {
      clauses.push('projectId = @projectId')
      params.projectId = filters.projectId
    }
    if (filters.search) {
      clauses.push(
        '(description LIKE @search OR vendor LIKE @search OR notes LIKE @search)',
      )
      params.search = `%${filters.search}%`
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
    const rows = this.db
      .prepare(
        `SELECT * FROM transactions ${where} ORDER BY date DESC, createdAt DESC`,
      )
      .all(params) as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  update(id: string, updates: TransactionUpdate): Transaction {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Transaction not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.date !== undefined) assign('date', updates.date)
    if (updates.amount !== undefined) assign('amount', updates.amount)
    if (updates.type !== undefined) assign('type', updates.type)
    if (updates.description !== undefined) assign('description', updates.description)
    if (updates.vendor !== undefined) assign('vendor', updates.vendor)
    if (updates.categoryId !== undefined) assign('categoryId', updates.categoryId)
    if (updates.projectId !== undefined) assign('projectId', updates.projectId)
    if (updates.notes !== undefined) assign('notes', updates.notes)
    if (updates.tags !== undefined) assign('tags', stringifyJSONArray(updates.tags))
    if (updates.businessType !== undefined) assign('businessType', updates.businessType)
    if (updates.taxDeductible !== undefined) assign('taxDeductible', toInt(updates.taxDeductible))
    if (updates.receiptPath !== undefined) assign('receiptPath', updates.receiptPath)
    if (updates.status !== undefined) assign('status', updates.status)
    if (updates.aiSuggested !== undefined) assign('aiSuggested', toInt(updates.aiSuggested))
    if (updates.aiConfidence !== undefined) assign('aiConfidence', updates.aiConfidence)
    if (updates.recurringId !== undefined) assign('recurringId', updates.recurringId)

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = @id`)
        .run(params)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error(`Transaction disappeared after update: ${id}`)
    return fresh
  }

  delete(id: string): void {
    const res = this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`Transaction not found: ${id}`)
  }

  unlinkProject(projectId: string): void {
    this.db
      .prepare('UPDATE transactions SET projectId = NULL WHERE projectId = ?')
      .run(projectId)
  }

  getRecentN(n: number): Transaction[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM transactions ORDER BY date DESC, createdAt DESC LIMIT ?',
      )
      .all(n) as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getTotalByType(
    type: 'expense' | 'income',
    businessType?: string,
    dateFrom?: string,
    dateTo?: string,
  ): number {
    const clauses = ['type = @type']
    const params: Record<string, unknown> = { type }
    if (businessType) {
      clauses.push('businessType = @businessType')
      params.businessType = businessType
    }
    if (dateFrom) {
      clauses.push('date >= @dateFrom')
      params.dateFrom = dateFrom
    }
    if (dateTo) {
      clauses.push('date <= @dateTo')
      params.dateTo = dateTo
    }
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE ${clauses.join(' AND ')}`,
      )
      .get(params) as { total: number }
    return row.total
  }
}
