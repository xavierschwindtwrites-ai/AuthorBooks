import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { WorkLog } from '../../types'
import { nowISO, toBool, toInt } from './util'

type Row = {
  id: string
  jobId: string
  date: string
  hoursWorked: number
  paid: number
  incomeAssociated: number | null
  description: string | null
  notes: string | null
  createdAt: string
}

export type WorkLogCreate = {
  jobId: string
  date: string
  hoursWorked: number
  paid?: boolean
  incomeAssociated?: number | null
  description?: string | null
  notes?: string | null
}

export type WorkLogUpdate = Partial<WorkLogCreate>

export class WorkLogService {
  constructor(private db: Database) {}

  private mapRow(r: Row): WorkLog {
    return {
      id: r.id,
      jobId: r.jobId,
      date: r.date,
      hoursWorked: r.hoursWorked,
      paid: toBool(r.paid),
      incomeAssociated: r.incomeAssociated,
      description: r.description,
      notes: r.notes,
      createdAt: r.createdAt,
    }
  }

  create(data: WorkLogCreate): WorkLog {
    const id = randomUUID()
    const params = {
      id,
      jobId: data.jobId,
      date: data.date,
      hoursWorked: data.hoursWorked,
      paid: toInt(data.paid ?? true),
      incomeAssociated: data.incomeAssociated ?? null,
      description: data.description ?? null,
      notes: data.notes ?? null,
      createdAt: nowISO(),
    }
    try {
      this.db
        .prepare(
          `INSERT INTO workLogs
             (id, jobId, date, hoursWorked, paid, incomeAssociated, description, notes, createdAt)
           VALUES
             (@id, @jobId, @date, @hoursWorked, @paid, @incomeAssociated, @description, @notes, @createdAt)`,
        )
        .run(params)
    } catch (e) {
      throw new Error(`WorkLogService.create failed: ${(e as Error).message}`)
    }
    const fresh = this.db
      .prepare('SELECT * FROM workLogs WHERE id = ?')
      .get(id) as Row | undefined
    if (!fresh) throw new Error('WorkLogService.create: row missing after insert')
    return this.mapRow(fresh)
  }

  getByJob(jobId: string, dateFrom?: string, dateTo?: string): WorkLog[] {
    const clauses = ['jobId = @jobId']
    const params: Record<string, unknown> = { jobId }
    if (dateFrom) {
      clauses.push('date >= @dateFrom')
      params.dateFrom = dateFrom
    }
    if (dateTo) {
      clauses.push('date <= @dateTo')
      params.dateTo = dateTo
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM workLogs WHERE ${clauses.join(' AND ')} ORDER BY date DESC, createdAt DESC`,
      )
      .all(params) as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  update(id: string, updates: WorkLogUpdate): WorkLog {
    const existing = this.db
      .prepare('SELECT * FROM workLogs WHERE id = ?')
      .get(id) as Row | undefined
    if (!existing) throw new Error(`WorkLog not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.jobId !== undefined) assign('jobId', updates.jobId)
    if (updates.date !== undefined) assign('date', updates.date)
    if (updates.hoursWorked !== undefined) assign('hoursWorked', updates.hoursWorked)
    if (updates.paid !== undefined) assign('paid', toInt(updates.paid))
    if (updates.incomeAssociated !== undefined)
      assign('incomeAssociated', updates.incomeAssociated)
    if (updates.description !== undefined) assign('description', updates.description)
    if (updates.notes !== undefined) assign('notes', updates.notes)

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE workLogs SET ${sets.join(', ')} WHERE id = @id`)
        .run(params)
    }
    const fresh = this.db
      .prepare('SELECT * FROM workLogs WHERE id = ?')
      .get(id) as Row | undefined
    if (!fresh) throw new Error(`WorkLog disappeared after update: ${id}`)
    return this.mapRow(fresh)
  }

  delete(id: string): void {
    const res = this.db.prepare('DELETE FROM workLogs WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`WorkLog not found: ${id}`)
  }

  getTotalHoursByJob(jobId: string): { paid: number; unpaid: number; total: number } {
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN paid = 1 THEN hoursWorked ELSE 0 END), 0) AS paid,
           COALESCE(SUM(CASE WHEN paid = 0 THEN hoursWorked ELSE 0 END), 0) AS unpaid,
           COALESCE(SUM(hoursWorked), 0) AS total
         FROM workLogs
         WHERE jobId = ?`,
      )
      .get(jobId) as { paid: number; unpaid: number; total: number }
    return row
  }

  getAllJobs(): Array<{
    jobId: string
    jobName: string
    totalHours: number
    paidHours: number
    income: number
    hourlyRate: number | null
  }> {
    const rows = this.db
      .prepare(
        `SELECT
           j.id          AS jobId,
           j.name        AS jobName,
           j.hourlyRate  AS hourlyRate,
           COALESCE(SUM(w.hoursWorked), 0)                                       AS totalHours,
           COALESCE(SUM(CASE WHEN w.paid = 1 THEN w.hoursWorked ELSE 0 END), 0) AS paidHours,
           COALESCE(SUM(w.incomeAssociated), 0)                                  AS income
         FROM jobs j
         LEFT JOIN workLogs w ON w.jobId = j.id
         GROUP BY j.id
         ORDER BY j.name ASC`,
      )
      .all() as Array<{
        jobId: string
        jobName: string
        hourlyRate: number | null
        totalHours: number
        paidHours: number
        income: number
      }>
    return rows
  }
}
