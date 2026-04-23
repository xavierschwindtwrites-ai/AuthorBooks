import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export type Settings = {
  openRouterApiKey?: string
  onboardingComplete?: boolean
  userName?: string
  businessName?: string
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): Settings {
  const p = settingsPath()
  try {
    if (!fs.existsSync(p)) return {}
    const raw = fs.readFileSync(p, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      const out: Settings = {}
      if (typeof obj.openRouterApiKey === 'string') {
        out.openRouterApiKey = obj.openRouterApiKey
      }
      if (typeof obj.onboardingComplete === 'boolean') {
        out.onboardingComplete = obj.onboardingComplete
      }
      if (typeof obj.userName === 'string') {
        out.userName = obj.userName
      }
      if (typeof obj.businessName === 'string') {
        out.businessName = obj.businessName
      }
      return out
    }
    return {}
  } catch (e) {
    console.error('[settings] failed to read settings.json:', e)
    return {}
  }
}

export function saveSettings(update: Settings): void {
  const current = getSettings()
  const merged: Settings = { ...current, ...update }
  const p = settingsPath()
  const tmp = p + '.tmp'
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8')
    fs.renameSync(tmp, p)
  } catch (e) {
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    console.error('[settings] failed to write settings.json:', e)
    throw e
  }
}
