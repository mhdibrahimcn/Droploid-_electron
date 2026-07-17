import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { Organisation, OrgCredentials } from '../../../shared/types/models'

interface OrgState {
  orgs: Organisation[]
  organizations: Organisation[]
  selectedOrgId: string | null
  loading: boolean

  load: () => Promise<void>
  select: (id: string) => void
  create: (name: string, photoPath: string | undefined, credentials: OrgCredentials) => Promise<Organisation>
  update: (id: string, name?: string, photoPath?: string, credentials?: OrgCredentials) => Promise<void>
  remove: (id: string) => Promise<void>
  addOrg: (data: { name: string; description?: string; role?: string }) => Promise<void>
  updateOrg: (id: string, data: { name?: string; description?: string }) => Promise<void>
}

export const useOrgStore = create<OrgState>((set, get) => ({
  orgs: [],
  organizations: [],
  selectedOrgId: null,
  loading: false,

  load: async () => {
    set({ loading: true })
    const orgs = await ipc.invoke<Organisation[]>('org:list')
    set({ orgs, organizations: orgs, loading: false, selectedOrgId: orgs[0]?.id ?? null })
  },

  select: (id) => set({ selectedOrgId: id }),

  create: async (name, photoPath, credentials) => {
    const org = await ipc.invoke<Organisation>('org:create', { name, photoPath, credentials })
    set((s) => {
      const orgs = [...s.orgs, org]
      return { orgs, organizations: orgs, selectedOrgId: s.selectedOrgId ?? org.id }
    })
    return org
  },

  update: async (id, name, photoPath, credentials) => {
    const updated = await ipc.invoke<Organisation>('org:update', { id, name, photoPath, credentials })
    set((s) => {
      const orgs = s.orgs.map((o) => o.id === id ? updated : o)
      return { orgs, organizations: orgs }
    })
  },

  remove: async (id) => {
    await ipc.invoke('org:delete', { id })
    const orgs = get().orgs.filter((o) => o.id !== id)
    set({ orgs, organizations: orgs, selectedOrgId: orgs[0]?.id ?? null })
  },

  addOrg: async ({ name, description }) => {
    const org = await ipc.invoke<Organisation>('org:create', { name, description, credentials: {} as OrgCredentials })
    set((s) => {
      const orgs = [...s.orgs, org]
      return { orgs, organizations: orgs, selectedOrgId: s.selectedOrgId ?? org.id }
    })
  },

  updateOrg: async (id, { name, description }) => {
    const updated = await ipc.invoke<Organisation>('org:update', { id, name, description })
    set((s) => {
      const orgs = s.orgs.map((o) => o.id === id ? updated : o)
      return { orgs, organizations: orgs }
    })
  }
}))
