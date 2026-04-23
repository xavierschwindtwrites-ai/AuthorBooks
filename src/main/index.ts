import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { getDB, initDB } from './database'
import { registerIpcHandlers } from './ipc'
import { getSettings } from './settings'
import { startBackend } from './backend/server'

const isDev = !!process.env.VITE_DEV_SERVER_URL

if (isDev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9229')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'AuthorBooks',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  initDB()
  await registerIpcHandlers(getDB())

  const settings = getSettings()
  if (settings.openRouterApiKey) {
    try {
      await startBackend(settings.openRouterApiKey)
    } catch (e) {
      console.error('[main] backend failed to start:', e)
    }
  }

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
