import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type {
  Subscription,
  SubscriptionPeriod,
  SubscriptionStatus,
  BusinessType,
} from '../../types'
import { nowISO } from './util'

type Row = {
  id: string
  name: string
  vendor: string | null
  costPerPeriod: number
  period: string
  nextRenewalDate: string | null
  businessType: string
  categoryId: string | null
  status: string
  pausedFrom: string | null
  pausedUntil: string | null
  notes: string | null
  createdAt: string
  lastRenewalDate: string | null
}

export type SubscriptionCreate = {
  name: string
  costPerPeriod: number
  period: SubscriptionPeriod
  vendor?: string | null
  nextRenewalDate?: string | null
  businessType?: BusinessType
  categoryId?: string | null
  status?: SubscriptionStatus
  pausedFrom?: string | null
  pausedUntil?: string | null
  notes?: string | null
  lastRenewalDate?: string | null
}

export type SubscriptionUpdate = Partial<SubscriptionCreate>

export class SubscriptionService {
  constructor(private db: Database) {}

  private mapRow(r: Row): Subscription {
    return {
      id: r.id,
      name: r.name,
      vendor: r.vendor,
      costPerPeriod: r.costPerPeriod,
      period: r.period as SubscriptionPeriod,
      nextRenewalDate: r.nextRenewalDate,
      businessType: r.businessType as BusinessType,
      categoryId: r.categoryId,
      status: r.status as SubscriptionStatus,
      pausedFrom: r.pausedFrom,
      pausedUntil: r.pausedUntil,
      notes: r.notes,
      createdAt: r.createdAt,
      lastRenewalDate: r.lastRenewalDate,
    }
  }

  create(data: SubscriptionCreate): Subscription {
    const id = randomUUID()
    const params = {
      id,
      name: data.name,
      vendor: data.vendor ?? null,
      costPerPeriod: data.costPerPeriod,
      period: data.period,
      nextRenewalDate: data.nextRenewalDate ?? null,
      businessType: data.businessType ?? 'business',
      categoryId: data.categoryId ?? null,
      status: data.status ?? 'active',
      pausedFrom: data.pausedFrom ?? null,
      pausedUntil: data.pausedUntil ?? null,
      notes: data.notes ?? null,
      createdAt: nowISO(),
      lastRenewalDate: data.lastRenewalDate ?? null,
    }
    try {
      this.db
        .prepare(
          `INSERT INTO subscriptions
             (id, name, vendor, costPerPeriod, period, nextRenewalDate, businessType,
              categoryId, status, pausedFrom, pausedUntil, notes, createdAt, lastRenewalDate)
           VALUES
             (@id, @name, @vendor, @costPerPeriod, @period, @nextRenewalDate, @businessType,
              @categoryId, @status, @pausedFrom, @pausedUntil, @notes, @createdAt, @lastRenewalDate)`,
        )
        .run(params)
    } catch (e) {
      throw new Error(`SubscriptionService.create failed: ${(e as Error).message}`)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error('SubscriptionService.create: row missing after insert')
    return fresh
  }

  getAll(): Subscription[] {
    const rows = this.db
      .prepare('SELECT * FROM subscriptions ORDER BY name ASC')
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getById(id: string): Subscription | undefined {
    const row = this.db
      .prepare('SELECT * FROM subscriptions WHERE id = ?')
      .get(id) as Row | undefined
    return row ? this.mapRow(row) : undefined
  }

  getActive(): Subscription[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM subscriptions WHERE status = 'active' ORDER BY nextRenewalDate ASC`,
      )
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getRenewingSoon(withinDays: number): Subscription[] {
    const now = new Date()
    const end = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
    const rows = this.db
      .prepare(
        `SELECT * FROM subscriptions
           WHERE status = 'active'
             AND nextRenewalDate IS NOT NULL
             AND nextRenewalDate >= @from
             AND nextRenewalDate <= @to
           ORDER BY nextRenewalDate ASC`,
      )
      .all({ from: now.toISOString(), to: end.toISOString() }) as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  update(id: string, updates: SubscriptionUpdate): Subscription {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Subscription not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.name !== undefined) assign('name', updates.name)
    if (updates.vendor !== undefined) assign('vendor', updates.vendor)
    if (updates.costPerPeriod !== undefined)
      assign('costPerPeriod', updates.costPerPeriod)
    if (updates.period !== undefined) assign('period', updates.period)
    if (updates.nextRenewalDate !== undefined)
      assign('nextRenewalDate', updates.nextRenewalDate)
    if (updates.businessType !== undefined) assign('businessType', updates.businessType)
    if (updates.categoryId !== undefined) assign('categoryId', updates.categoryId)
    if (updates.status !== undefined) assign('status', updates.status)
    if (updates.pausedFrom !== undefined) assign('pausedFrom', updates.pausedFrom)
    if (updates.pausedUntil !== undefined) assign('pausedUntil', updates.pausedUntil)
    if (updates.notes !== undefined) assign('notes', updates.notes)
    if (updates.lastRenewalDate !== undefined)
      assign('lastRenewalDate', updates.lastRenewalDate)

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id = @id`)
        .run(params)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error(`Subscription disappeared after update: ${id}`)
    return fresh
  }

  delete(id: string): void {
    const res = this.db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`Subscription not found: ${id}`)
  }

  getMonthlyTotal(businessType?: 'business' | 'personal'): number {
    const clauses = ["status = 'active'"]
    const params: Record<string, unknown> = {}
    if (businessType) {
      clauses.push('businessType = @businessType')
      params.businessType = businessType
    }
    const rows = this.db
      .prepare(
        `SELECT costPerPeriod, period FROM subscriptions WHERE ${clauses.join(' AND ')}`,
      )
      .all(params) as Array<{ costPerPeriod: number; period: string }>

    let total = 0
    for (const r of rows) {
      switch (r.period) {
        case 'monthly':
          total += r.costPerPeriod
          break
        case 'quarterly':
          total += r.costPerPeriod / 3
          break
        case 'yearly':
          total += r.costPerPeriod / 12
          break
        case 'weekly':
          total += r.costPerPeriod * (52 / 12)
          break
        default:
          total += r.costPerPeriod
      }
    }
    return Math.round(total)
  }
}
