import './bootstrap' // MUST be first — pins userData before store.ts loads
import { app, BrowserWindow, shell, protocol } from 'electron'
import { join, extname } from 'path'
import { readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerOrgHandlers } from './ipc/handlers/org'
import { registerAppHandlers } from './ipc/handlers/app'
import { registerBuildHandlers } from './ipc/handlers/build'
import { registerToolHandlers } from './ipc/handlers/tools'
import { registerKeychainHandlers } from './ipc/handlers/keychain'
import { registerSystemHandlers } from './ipc/handlers/system'

protocol.registerSchemesAsPrivileged([{
  scheme: 'local-file',
  privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true }
}])

// Headless CLI mode: `Droploid --cli <command>`. Skip the single-instance lock so the CLI works
// while the GUI is open, and never open a window (handled in whenReady below).
const cliMode = process.argv.includes('--cli')

if (!cliMode && !app.requestSingleInstanceLock()) {
  app.quit()
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  if (cliMode) {
    app.dock?.hide()
    const { runCli } = await import('./cli')
    await runCli(process.argv)
    return
  }

  const imgMime: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  }
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.slice('local-file://'.length))
    try {
      const data = readFileSync(filePath)
      const mime = imgMime[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      return new Response(data, { headers: { 'Content-Type': mime } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  electronApp.setAppUserModelId('com.droploid.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerOrgHandlers()
  registerAppHandlers()
  registerToolHandlers()
  registerKeychainHandlers()
  registerSystemHandlers()

  const mainWindow = createWindow()
  registerBuildHandlers(mainWindow)

  app.on('second-instance', () => {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
