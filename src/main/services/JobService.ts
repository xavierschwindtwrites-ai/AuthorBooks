import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { Job, JobStatus } from '../../types'
import { nowISO } from './util'

type Row = {
  id: string
  name: string
  type: string | null
  clientName: string | null
  hourlyRate: number | null
  status: string
  description: string | null
  notes: string | null
  createdAt: string
  completedAt: string | null
}

export type JobCreate = {
  name: string
  type?: string | null
  clientName?: string | null
  hourlyRate?: number | null
  status?: JobStatus
  description?: string | null
  notes?: string | null
  completedAt?: string | null
}

export type JobUpdate = Partial<JobCreate>

export class JobService {
  constructor(private db: Database) {}

  private mapRow(r: Row): Job {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      clientName: r.clientName,
      hourlyRate: r.hourlyRate,
      status: r.status as JobStatus,
      description: r.description,
      notes: r.notes,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }
  }

  create(data: JobCreate): Job {
    const id = randomUUID()
    const params = {
      id,
      name: data.name,
      type: data.type ?? null,
      clientName: data.clientName ?? null,
      hourlyRate: data.hourlyRate ?? null,
      status: data.status ?? 'active',
      description: data.description ?? null,
      notes: data.notes ?? null,
      createdAt: nowISO(),
      completedAt: data.completedAt ?? null,
    }
    try {
      this.db
        .prepare(
          `INSERT INTO jobs
             (id, name, type, clientName, hourlyRate, status, description, notes, createdAt, completedAt)
           VALUES
             (@id, @name, @type, @clientName, @hourlyRate, @status, @description, @notes, @createdAt, @completedAt)`,
        )
        .run(params)
    } catch (e) {
      throw new Error(`JobService.create failed: ${(e as Error).message}`)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error('JobService.create: row missing after insert')
    return fresh
  }

  getAll(): Job[] {
    const rows = this.db
      .prepare('SELECT * FROM jobs ORDER BY createdAt DESC')
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getById(id: string): Job | undefined {
    const row = this.db
      .prepare('SELECT * FROM jobs WHERE id = ?')
      .get(id) as Row | undefined
    return row ? this.mapRow(row) : undefined
  }

  update(id: string, updates: JobUpdate): Job {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Job not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.name !== undefined) assign('name', updates.name)
    if (updates.type !== undefined) assign('type', updates.type)
    if (updates.clientName !== undefined) assign('clientName', updates.clientName)
    if (updates.hourlyRate !== undefined) assign('hourlyRate', updates.hourlyRate)
    if (updates.status !== undefined) assign('status', updates.status)
    if (updates.description !== undefined) assign('description', updates.description)
    if (updates.notes !== undefined) assign('notes', updates.notes)
    if (updates.completedAt !== undefined) assign('completedAt', updates.completedAt)

    if (sets.length > 0) {
      this.db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = @id`).run(params)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error(`Job disappeared after update: ${id}`)
    return fresh
  }

  delete(id: string): void {
    const res = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`Job not found: ${id}`)
  }

  getActive(): Job[] {
    const rows = this.db
      .prepare(`SELECT * FROM jobs WHERE status = 'active' ORDER BY createdAt DESC`)
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }
}
