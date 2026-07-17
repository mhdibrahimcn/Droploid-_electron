import { ipcMain, dialog, shell, Notification } from 'electron'
import { spawn } from 'child_process'
import { store } from '../../services/store'

export function registerSystemHandlers(): void {
  ipcMain.handle('system:pick-folder', async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('system:pick-file', async (event, { filters }: { filters?: { name: string; extensions: string[] }[] }) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('system:open-finder', async (_, { path }: { path: string }) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('system:notify', async (_, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })

  ipcMain.handle('store:get', async (_, { key }: { key: string }) => {
    return store.get(key as never)
  })

  ipcMain.handle('store:set', async (_, { key, value }: { key: string; value: unknown }) => {
    store.set(key as never, value as never)
  })
}
