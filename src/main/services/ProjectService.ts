import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { Project, ProjectStatus } from '../../types'
import { nowISO } from './util'

type Row = {
  id: string
  name: string
  description: string | null
  type: string | null
  startDate: string | null
  targetPublishDate: string | null
  status: string | null
  budget: number | null
  notes: string | null
  parentId: string | null
  createdAt: string
}

export type ProjectCreate = {
  name: string
  description?: string | null
  type?: string | null
  startDate?: string | null
  targetPublishDate?: string | null
  status?: ProjectStatus | null
  budget?: number | null
  notes?: string | null
  parentId?: string | null
}

export type ProjectUpdate = Partial<ProjectCreate>

export class ProjectService {
  constructor(private db: Database) {}

  private mapRow(r: Row): Project {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      startDate: r.startDate,
      targetPublishDate: r.targetPublishDate,
      status: r.status as ProjectStatus | null,
      budget: r.budget,
      notes: r.notes,
      parentId: r.parentId,
      createdAt: r.createdAt,
    }
  }

  create(data: ProjectCreate): Project {
    const id = randomUUID()
    const params = {
      id,
      name: data.name,
      description: data.description ?? null,
      type: data.type ?? null,
      startDate: data.startDate ?? null,
      targetPublishDate: data.targetPublishDate ?? null,
      status: data.status ?? 'active',
      budget: data.budget ?? null,
      notes: data.notes ?? null,
      parentId: data.parentId ?? null,
      createdAt: nowISO(),
    }
    try {
      this.db
        .prepare(
          `INSERT INTO projects
             (id, name, description, type, startDate, targetPublishDate, status, budget, notes, parentId, createdAt)
           VALUES
             (@id, @name, @description, @type, @startDate, @targetPublishDate, @status, @budget, @notes, @parentId, @createdAt)`,
        )
        .run(params)
    } catch (e) {
      throw new Error(`ProjectService.create failed: ${(e as Error).message}`)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error('ProjectService.create: row missing after insert')
    return fresh
  }

  getAll(): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects ORDER BY createdAt DESC')
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getById(id: string): Project | undefined {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as Row | undefined
    return row ? this.mapRow(row) : undefined
  }

  getRootProjects(): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects WHERE parentId IS NULL ORDER BY name')
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getChildren(parentId: string): Project[] {
    const rows = this.db
      .prepare('SELECT * FROM projects WHERE parentId = ? ORDER BY name')
      .all(parentId) as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  update(id: string, updates: ProjectUpdate): Project {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Project not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.name !== undefined) assign('name', updates.name)
    if (updates.description !== undefined) assign('description', updates.description)
    if (updates.type !== undefined) assign('type', updates.type)
    if (updates.startDate !== undefined) assign('startDate', updates.startDate)
    if (updates.targetPublishDate !== undefined)
      assign('targetPublishDate', updates.targetPublishDate)
    if (updates.status !== undefined) assign('status', updates.status)
    if (updates.budget !== undefined) assign('budget', updates.budget)
    if (updates.notes !== undefined) assign('notes', updates.notes)
    if (updates.parentId !== undefined) assign('parentId', updates.parentId)

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = @id`)
        .run(params)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error(`Project disappeared after update: ${id}`)
    return fresh
  }

  delete(id: string): void {
    const children = this.db
      .prepare('SELECT COUNT(*) AS n FROM projects WHERE parentId = ?')
      .get(id) as { n: number }
    if (children.n > 0) {
      throw new Error('Cannot delete a project that has subprojects. Delete the subprojects first.')
    }
    const res = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`Project not found: ${id}`)
  }

  getSummary(id: string): { totalExpenses: number; totalIncome: number; net: number } {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Project not found: ${id}`)

    const childRows = this.db
      .prepare('SELECT id FROM projects WHERE parentId = ?')
      .all(id) as { id: string }[]
    const ids = [id, ...childRows.map((r) => r.id)]
    const ph = ids.map(() => '?').join(', ')

    const expenses = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
           FROM transactions
          WHERE projectId IN (${ph}) AND type = 'expense'`,
      )
      .get(...ids) as { total: number }

    const incomeFromTxn = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
           FROM transactions
          WHERE projectId IN (${ph}) AND type = 'income'`,
      )
      .get(...ids) as { total: number }

    const incomeFromTable = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
           FROM income
          WHERE projectId IN (${ph})`,
      )
      .get(...ids) as { total: number }

    const totalIncome = incomeFromTxn.total + incomeFromTable.total
    return {
      totalExpenses: expenses.total,
      totalIncome,
      net: totalIncome - expenses.total,
    }
  }
}
