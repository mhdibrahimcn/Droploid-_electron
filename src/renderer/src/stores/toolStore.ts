import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { ToolStatus } from '../../../shared/types/models'

interface ToolState {
  tools: ToolStatus[]
  checking: boolean
  hasBlocker: boolean

  checkAll: () => Promise<void>
  install: (name: string) => Promise<void>
  repairAll: () => Promise<void>
}

export const useToolStore = create<ToolState>((set) => ({
  tools: [],
  checking: false,
  hasBlocker: false,

  checkAll: async () => {
    set({ checking: true })
    const tools = await ipc.invoke<ToolStatus[]>('tools:check')
    const hasBlocker = tools.some((t) => t.name === 'homebrew' && t.state === 'missing')
    set({ tools, checking: false, hasBlocker })
  },

  install: async (name) => {
    set((s) => ({
      tools: s.tools.map((t) => t.name === name ? { ...t, state: 'installing' } : t)
    }))
    await ipc.invoke('tools:install', { name })
    const tools = await ipc.invoke<ToolStatus[]>('tools:check')
    set({ tools })
  },

  repairAll: async () => {
    set({ checking: true })
    await ipc.invoke('tools:repair')
    const tools = await ipc.invoke<ToolStatus[]>('tools:check')
    const hasBlocker = tools.some((t) => t.name === 'homebrew' && t.state === 'missing')
    set({ tools, checking: false, hasBlocker })
  }
}))
