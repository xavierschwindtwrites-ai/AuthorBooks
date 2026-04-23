import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { SavingsGoal } from '../../types'
import { nowISO, parseJSONArray, stringifyJSONArray } from './util'

type Row = {
  id: string
  name: string
  type: string | null
  targetAmount: number
  currentAmount: number
  deadline: string | null
  priority: number
  description: string | null
  linkedCategories: string | null
  linkedIncomeStreams: string | null
  notes: string | null
  createdAt: string
}

export type SavingsGoalCreate = {
  name: string
  targetAmount: number
  type?: string | null
  currentAmount?: number
  deadline?: string | null
  priority?: number
  description?: string | null
  linkedCategories?: string[] | null
  linkedIncomeStreams?: string[] | null
  notes?: string | null
}

export type SavingsGoalUpdate = Partial<SavingsGoalCreate>

export class SavingsGoalService {
  constructor(private db: Database) {}

  private mapRow(r: Row): SavingsGoal {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      targetAmount: r.targetAmount,
      currentAmount: r.currentAmount,
      deadline: r.deadline,
      priority: r.priority,
      description: r.description,
      linkedCategories: parseJSONArray<string>(r.linkedCategories),
      linkedIncomeStreams: parseJSONArray<string>(r.linkedIncomeStreams),
      notes: r.notes,
      createdAt: r.createdAt,
    }
  }

  create(data: SavingsGoalCreate): SavingsGoal {
    const id = randomUUID()
    const params = {
      id,
      name: data.name,
      type: data.type ?? null,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount ?? 0,
      deadline: data.deadline ?? null,
      priority: data.priority ?? 3,
      description: data.description ?? null,
      linkedCategories: stringifyJSONArray(data.linkedCategories ?? null),
      linkedIncomeStreams: stringifyJSONArray(data.linkedIncomeStreams ?? null),
      notes: data.notes ?? null,
      createdAt: nowISO(),
    }
    try {
      this.db
        .prepare(
          `INSERT INTO savingsGoals
             (id, name, type, targetAmount, currentAmount, deadline, priority,
              description, linkedCategories, linkedIncomeStreams, notes, createdAt)
           VALUES
             (@id, @name, @type, @targetAmount, @currentAmount, @deadline, @priority,
              @description, @linkedCategories, @linkedIncomeStreams, @notes, @createdAt)`,
        )
        .run(params)
    } catch (e) {
      throw new Error(`SavingsGoalService.create failed: ${(e as Error).message}`)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error('SavingsGoalService.create: row missing after insert')
    return fresh
  }

  getAll(): SavingsGoal[] {
    const rows = this.db
      .prepare('SELECT * FROM savingsGoals ORDER BY priority ASC, createdAt DESC')
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getById(id: string): SavingsGoal | undefined {
    const row = this.db
      .prepare('SELECT * FROM savingsGoals WHERE id = ?')
      .get(id) as Row | undefined
    return row ? this.mapRow(row) : undefined
  }

  update(id: string, updates: SavingsGoalUpdate): SavingsGoal {
    const existing = this.getById(id)
    if (!existing) throw new Error(`SavingsGoal not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.name !== undefined) assign('name', updates.name)
    if (updates.type !== undefined) assign('type', updates.type)
    if (updates.targetAmount !== undefined) assign('targetAmount', updates.targetAmount)
    if (updates.currentAmount !== undefined)
      assign('currentAmount', updates.currentAmount)
    if (updates.deadline !== undefined) assign('deadline', updates.deadline)
    if (updates.priority !== undefined) assign('priority', updates.priority)
    if (updates.description !== undefined) assign('description', updates.description)
    if (updates.linkedCategories !== undefined)
      assign('linkedCategories', stringifyJSONArray(updates.linkedCategories))
    if (updates.linkedIncomeStreams !== undefined)
      assign('linkedIncomeStreams', stringifyJSONArray(updates.linkedIncomeStreams))
    if (updates.notes !== undefined) assign('notes', updates.notes)

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE savingsGoals SET ${sets.join(', ')} WHERE id = @id`)
        .run(params)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error(`SavingsGoal disappeared after update: ${id}`)
    return fresh
  }

  delete(id: string): void {
    const res = this.db.prepare('DELETE FROM savingsGoals WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`SavingsGoal not found: ${id}`)
  }

  getProgress(
    id: string,
  ): { current: number; target: number; percentage: number; onTrack: boolean } {
    const goal = this.getById(id)
    if (!goal) throw new Error(`SavingsGoal not found: ${id}`)

    const percentage =
      goal.targetAmount > 0
        ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
        : 0

    let onTrack = true
    if (goal.deadline) {
      const start = new Date(goal.createdAt).getTime()
      const end = new Date(goal.deadline).getTime()
      const now = Date.now()
      const totalMs = end - start
      if (totalMs > 0) {
        const elapsedPct = Math.min(100, ((now - start) / totalMs) * 100)
        onTrack = percentage >= elapsedPct
      }
    }

    return {
      current: goal.currentAmount,
      target: goal.targetAmount,
      percentage,
      onTrack,
    }
  }
}
