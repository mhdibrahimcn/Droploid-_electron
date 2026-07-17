import { create } from 'zustand'

export type WorkspaceTab = 'overview' | 'history' | 'release'
export type Theme = 'dark' | 'light'

interface UIState {
  sidebarOpen: boolean
  activeTab: WorkspaceTab
  deployPanelOpen: boolean
  settingsOpen: boolean
  orgSheetOpen: boolean
  isOrgSheetOpen: boolean
  orgSheetEditId: string | null
  selectedOrgId: string | null
  commandPaletteOpen: boolean
  promoteSheetOpen: boolean
  orgDetailOpen: boolean
  theme: Theme

  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void
  setTab: (tab: WorkspaceTab) => void
  setDeployPanel: (v: boolean) => void
  setSettings: (v: boolean) => void
  openOrgSheet: (editId?: string) => void
  closeOrgSheet: () => void
  setOrgSheetOpen: (v: boolean, editId?: string) => void
  setCommandPalette: (v: boolean) => void
  setPromoteSheet: (v: boolean) => void
  openOrgDetail: () => void
  closeOrgDetail: () => void
  toggleTheme: (originX?: number, originY?: number) => void
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('droploid_theme', theme)
}

const storedTheme = (localStorage.getItem('droploid_theme') as Theme | null) ?? 'dark'
applyTheme(storedTheme)

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  activeTab: 'overview',
  deployPanelOpen: false,
  settingsOpen: false,
  orgSheetOpen: false,
  isOrgSheetOpen: false,
  orgSheetEditId: null,
  selectedOrgId: null,
  commandPaletteOpen: false,
  promoteSheetOpen: false,
  orgDetailOpen: false,
  theme: storedTheme,

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTab: (tab) => set({ activeTab: tab }),
  setDeployPanel: (v) => set({ deployPanelOpen: v }),
  setSettings: (v) => set({ settingsOpen: v }),
  openOrgSheet: (editId) => set({ orgSheetOpen: true, isOrgSheetOpen: true, orgSheetEditId: editId ?? null, selectedOrgId: editId ?? null }),
  closeOrgSheet: () => set({ orgSheetOpen: false, isOrgSheetOpen: false, orgSheetEditId: null, selectedOrgId: null }),
  setOrgSheetOpen: (v, editId) => set({ orgSheetOpen: v, isOrgSheetOpen: v, orgSheetEditId: v ? (editId ?? null) : null, selectedOrgId: v ? (editId ?? null) : null }),
  setCommandPalette: (v) => set({ commandPaletteOpen: v }),
  setPromoteSheet: (v) => set({ promoteSheetOpen: v }),
  openOrgDetail: () => set({ orgDetailOpen: true }),
  closeOrgDetail: () => set({ orgDetailOpen: false }),

  toggleTheme: (originX, originY) => {
    const newTheme: Theme = get().theme === 'dark' ? 'light' : 'dark'

    const startVT = (document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> }
    }).startViewTransition

    if (startVT && originX !== undefined && originY !== undefined) {
      const maxRadius = Math.hypot(
        Math.max(originX, window.innerWidth - originX),
        Math.max(originY, window.innerHeight - originY)
      )

      const transition = startVT.call(document, () => {
        applyTheme(newTheme)
        set({ theme: newTheme })
      })

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${originX}px ${originY}px)`,
              `circle(${maxRadius}px at ${originX}px ${originY}px)`,
            ],
          },
          {
            duration: 480,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        )
      }).catch(() => {})
    } else {
      applyTheme(newTheme)
      set({ theme: newTheme })
    }
  },
}))

export const useUiStore = useUIStore
