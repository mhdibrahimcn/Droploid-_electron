import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { LinkedApp } from '../../../shared/types/models'

interface AppState {
  apps: LinkedApp[]
  selectedAppId: string | null
  loading: boolean
  isSetupComplete: boolean
  isHydrated: boolean

  loadForOrg: (orgId: string) => Promise<void>
  select: (id: string | null) => void
  link: (orgId: string, dirPath: string) => Promise<LinkedApp>
  unlink: (id: string) => Promise<void>
  updateLastDeploy: (id: string, at: string) => void
  updateVersion: (id: string, version: string) => void
  markSetupComplete: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  apps: [],
  selectedAppId: null,
  loading: false,
  isSetupComplete: false,
  isHydrated: false,

  loadForOrg: async (orgId) => {
    set({ loading: true, selectedAppId: null })
    const apps = await ipc.invoke<LinkedApp[]>('app:list', { orgId })
    set({ apps, loading: false })
  },

  select: (id) => set({ selectedAppId: id }),

  link: async (orgId, dirPath) => {
    const app = await ipc.invoke<LinkedApp>('app:link', { orgId, dirPath })
    set((s) => ({ apps: [...s.apps, app] }))
    return app
  },

  unlink: async (id) => {
    await ipc.invoke('app:unlink', { id })
    const apps = get().apps.filter((a) => a.id !== id)
    const selectedAppId = get().selectedAppId === id ? null : get().selectedAppId
    set({ apps, selectedAppId })
  },

  updateLastDeploy: (id, at) => {
    set((s) => ({ apps: s.apps.map((a) => a.id === id ? { ...a, lastDeployAt: at } : a) }))
  },

  updateVersion: (id, version) => {
    set((s) => ({ apps: s.apps.map((a) => a.id === id ? { ...a, currentVersion: version } : a) }))
  },

  markSetupComplete: async () => {
    await ipc.invoke('store:set', { key: 'setup_complete', value: true })
    set({ isSetupComplete: true })
  }
}))

// Hydrate isSetupComplete from persisted store on module load
ipc.invoke<boolean>('store:get', { key: 'setup_complete' })
  .then((v) => { useAppStore.setState({ isSetupComplete: !!v, isHydrated: true }) })
  .catch(() => { useAppStore.setState({ isHydrated: true }) })
