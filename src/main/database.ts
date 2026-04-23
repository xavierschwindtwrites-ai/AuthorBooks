import { app } from 'electron'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

import schema001 from './migrations/001_schema.sql?raw'
import seed002 from './migrations/002_seed_categories.sql?raw'
import subprojects003 from './migrations/003_subprojects.sql?raw'

const MIGRATIONS: Array<{ id: string; sql: string }> = [
  { id: '001_schema', sql: schema001 },
  { id: '002_seed_categories', sql: seed002 },
  { id: '003_subprojects', sql: subprojects003 },
]

let dbInstance: Database.Database | null = null

export function initDB(): Database.Database {
  if (dbInstance) return dbInstance

  const userDataDir = app.getPath('userData')
  fs.mkdirSync(userDataDir, { recursive: true })
  const dbPath = path.join(userDataDir, 'data.db')

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    );
  `)

  const isApplied = db.prepare('SELECT 1 FROM _migrations WHERE id = ?')
  const markApplied = db.prepare(
    'INSERT INTO _migrations (id, appliedAt) VALUES (?, ?)',
  )

  for (const m of MIGRATIONS) {
    if (isApplied.get(m.id)) continue
    const tx = db.transaction(() => {
      db.exec(m.sql)
      markApplied.run(m.id, new Date().toISOString())
    })
    tx()
  }

  console.log(`[db] ready at ${dbPath}`)
  dbInstance = db
  return db
}

export function getDB(): Database.Database {
  if (!dbInstance) throw new Error('Database not initialized. Call initDB() first.')
  return dbInstance
}
