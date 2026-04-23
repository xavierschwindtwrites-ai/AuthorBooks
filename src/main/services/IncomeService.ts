import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { Income } from '../../types'
import { nowISO } from './util'

type Row = {
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

export type IncomeCreate = {
  date: string
  amount: number
  source?: string | null
  projectId?: string | null
  jobId?: string | null
  publisher?: string | null
  platform?: string | null
  description?: string | null
  notes?: string | null
}

export type IncomeUpdate = Partial<IncomeCreate>

export class IncomeService {
  constructor(private db: Database) {}

  private mapRow(r: Row): Income {
    return {
      id: r.id,
      date: r.date,
      amount: r.amount,
      source: r.source,
      projectId: r.projectId,
      jobId: r.jobId,
      publisher: r.publisher,
      platform: r.platform,
      description: r.description,
      notes: r.notes,
      createdAt: r.createdAt,
    }
  }

  create(data: IncomeCreate): Income {
    const id = randomUUID()
    const params = {
      id,
      date: data.date,
      amount: data.amount,
      source: data.source ?? null,
      projectId: data.projectId ?? null,
      jobId: data.jobId ?? null,
      publisher: data.publisher ?? null,
      platform: data.platform ?? null,
      description: data.description ?? null,
      notes: data.notes ?? null,
      createdAt: nowISO(),
    }
    try {
      this.db
        .prepare(
          `INSERT INTO income
             (id, date, amount, source, projectId, jobId, publisher, platform, description, notes, createdAt)
           VALUES
             (@id, @date, @amount, @source, @projectId, @jobId, @publisher, @platform, @description, @notes, @createdAt)`,
        )
        .run(params)
    } catch (e) {
      throw new Error(`IncomeService.create failed: ${(e as Error).message}`)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error('IncomeService.create: row missing after insert')
    return fresh
  }

  getAll(dateFrom?: string, dateTo?: string): Income[] {
    const clauses: string[] = []
    const params: Record<string, unknown> = {}
    if (dateFrom) {
      clauses.push('date >= @dateFrom')
      params.dateFrom = dateFrom
    }
    if (dateTo) {
      clauses.push('date <= @dateTo')
      params.dateTo = dateTo
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
    const rows = this.db
      .prepare(`SELECT * FROM income ${where} ORDER BY date DESC, createdAt DESC`)
      .all(params) as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getById(id: string): Income | undefined {
    const row = this.db
      .prepare('SELECT * FROM income WHERE id = ?')
      .get(id) as Row | undefined
    return row ? this.mapRow(row) : undefined
  }

  update(id: string, updates: IncomeUpdate): Income {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Income not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.date !== undefined) assign('date', updates.date)
    if (updates.amount !== undefined) assign('amount', updates.amount)
    if (updates.source !== undefined) assign('source', updates.source)
    if (updates.projectId !== undefined) assign('projectId', updates.projectId)
    if (updates.jobId !== undefined) assign('jobId', updates.jobId)
    if (updates.publisher !== undefined) assign('publisher', updates.publisher)
    if (updates.platform !== undefined) assign('platform', updates.platform)
    if (updates.description !== undefined) assign('description', updates.description)
    if (updates.notes !== undefined) assign('notes', updates.notes)

    if (sets.length > 0) {
      this.db.prepare(`UPDATE income SET ${sets.join(', ')} WHERE id = @id`).run(params)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error(`Income disappeared after update: ${id}`)
    return fresh
  }

  delete(id: string): void {
    const res = this.db.prepare('DELETE FROM income WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`Income not found: ${id}`)
  }

  getTotalBySource(): Array<{ source: string; total: number }> {
    const rows = this.db
      .prepare(
        `SELECT COALESCE(source, '(unknown)') AS source, COALESCE(SUM(amount), 0) AS total
           FROM income
          GROUP BY COALESCE(source, '(unknown)')
          ORDER BY total DESC`,
      )
      .all() as Array<{ source: string; total: number }>
    return rows
  }
}
