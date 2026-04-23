import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import type { Category, BusinessType } from '../../types'
import { nowISO, toBool, toInt } from './util'

type Row = {
  id: string
  name: string
  color: string | null
  defaultTaxDeductible: number
  defaultBusinessType: string
  isCustom: number
  createdAt: string
}

export type CategoryCreate = {
  name: string
  color?: string | null
  defaultTaxDeductible?: boolean
  defaultBusinessType?: BusinessType
  isCustom?: boolean
}

export type CategoryUpdate = Partial<CategoryCreate>

export class CategoryService {
  constructor(private db: Database) {}

  private mapRow(r: Row): Category {
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      defaultTaxDeductible: toBool(r.defaultTaxDeductible),
      defaultBusinessType: r.defaultBusinessType as BusinessType,
      isCustom: toBool(r.isCustom),
      createdAt: r.createdAt,
    }
  }

  create(data: CategoryCreate): Category {
    const id = randomUUID()
    const params = {
      id,
      name: data.name,
      color: data.color ?? null,
      defaultTaxDeductible: toInt(data.defaultTaxDeductible ?? false),
      defaultBusinessType: data.defaultBusinessType ?? 'business',
      isCustom: toInt(data.isCustom ?? true),
      createdAt: nowISO(),
    }
    try {
      this.db
        .prepare(
          `INSERT INTO categories
             (id, name, color, defaultTaxDeductible, defaultBusinessType, isCustom, createdAt)
           VALUES
             (@id, @name, @color, @defaultTaxDeductible, @defaultBusinessType, @isCustom, @createdAt)`,
        )
        .run(params)
    } catch (e) {
      throw new Error(
        `CategoryService.create failed for "${data.name}": ${(e as Error).message}`,
      )
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error('CategoryService.create: row missing after insert')
    return fresh
  }

  getAll(): Category[] {
    const rows = this.db
      .prepare('SELECT * FROM categories ORDER BY name ASC')
      .all() as Row[]
    return rows.map((r) => this.mapRow(r))
  }

  getById(id: string): Category | undefined {
    const row = this.db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .get(id) as Row | undefined
    return row ? this.mapRow(row) : undefined
  }

  update(id: string, updates: CategoryUpdate): Category {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Category not found: ${id}`)

    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    const assign = (col: string, val: unknown) => {
      sets.push(`${col} = @${col}`)
      params[col] = val
    }

    if (updates.name !== undefined) assign('name', updates.name)
    if (updates.color !== undefined) assign('color', updates.color)
    if (updates.defaultTaxDeductible !== undefined)
      assign('defaultTaxDeductible', toInt(updates.defaultTaxDeductible))
    if (updates.defaultBusinessType !== undefined)
      assign('defaultBusinessType', updates.defaultBusinessType)
    if (updates.isCustom !== undefined) assign('isCustom', toInt(updates.isCustom))

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = @id`)
        .run(params)
    }
    const fresh = this.getById(id)
    if (!fresh) throw new Error(`Category disappeared after update: ${id}`)
    return fresh
  }

  delete(id: string): void {
    const res = this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    if (res.changes === 0) throw new Error(`Category not found: ${id}`)
  }
}
