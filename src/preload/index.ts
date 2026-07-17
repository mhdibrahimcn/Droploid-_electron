import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  invoke: <T = unknown>(channel: string, args?: unknown): Promise<T> =>
    ipcRenderer.invoke(channel, args) as Promise<T>,

  on: (channel: string, listener: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.off(channel, wrapped)
  },

  send: (channel: string, args?: unknown): void => {
    ipcRenderer.send(channel, args)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)

export type ElectronAPI = typeof electronAPI
