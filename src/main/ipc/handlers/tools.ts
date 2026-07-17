import { ipcMain, BrowserWindow } from 'electron'
import { checkAllTools, checkTool, installTool } from '../../services/toolChecker'
import type { ToolName } from '../../../shared/types/models'

export function registerToolHandlers(): void {
  ipcMain.handle('tools:check', async () => {
    return checkAllTools()
  })

  ipcMain.handle('tools:install', async (_, { name }: { name: string }) => {
    await installTool(name as ToolName)
  })

  ipcMain.handle('tools:repair', async () => {
    const statuses = await checkAllTools()
    for (const s of statuses) {
      if (s.state === 'missing') {
        await installTool(s.name)
      }
    }
  })
}
