import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { BuildCheckpoint, BuildPlatform, LogLine, BuildResult, BuildRun } from '../../../shared/types/models'

interface BuildState {
  activeRunId: string | null
  checkpoints: BuildCheckpoint[]
  iosLogs: LogLine[]
  androidLogs: LogLine[]
  iosResult: BuildResult | null
  androidResult: BuildResult | null
  isRunning: boolean

  history: BuildRun[]
  historyLoading: boolean

  startListening: () => () => void
  loadHistory: (appId: string) => Promise<void>
  reset: () => void
  setActiveRun: (runId: string, checkpoints: BuildCheckpoint[]) => void
  // Shorebird OTA patch — standalone flow (no build:checkpoint / build:complete events).
  startPatch: (platform: BuildPlatform) => void
  finishPatch: (ios?: boolean, android?: boolean) => void
}

export const useBuildStore = create<BuildState>((set, get) => ({
  activeRunId: null,
  checkpoints: [],
  iosLogs: [],
  androidLogs: [],
  iosResult: null,
  androidResult: null,
  isRunning: false,
  history: [],
  historyLoading: false,

  startListening: () => {
    const offLog = ipc.on('build:log-line', (...args) => {
      const line = args[0] as LogLine
      if (line.platform === 'ios') {
        set((s) => ({ iosLogs: [...s.iosLogs.slice(-500), line] }))
      } else {
        set((s) => ({ androidLogs: [...s.androidLogs.slice(-500), line] }))
      }
    })

    const offCp = ipc.on('build:checkpoint', (...args) => {
      const cp = args[0] as BuildCheckpoint
      set((s) => {
        const idx = s.checkpoints.findIndex((c) => c.id === cp.id)
        if (idx === -1) return { checkpoints: [...s.checkpoints, cp] }
        const next = [...s.checkpoints]
        next[idx] = cp
        return { checkpoints: next }
      })
    })

    const offComplete = ipc.on('build:complete', (...args) => {
      const { iosResult, androidResult } = args[0] as { runId: string; result: BuildResult; iosResult?: BuildResult; androidResult?: BuildResult }
      set({ iosResult: iosResult ?? null, androidResult: androidResult ?? null, isRunning: false })
    })

    return () => { offLog(); offCp(); offComplete() }
  },

  loadHistory: async (appId) => {
    set({ historyLoading: true })
    const history = await ipc.invoke<BuildRun[]>('build:history', { appId })
    set({ history, historyLoading: false })
  },

  reset: () => set({
    activeRunId: null,
    checkpoints: [],
    iosLogs: [],
    androidLogs: [],
    iosResult: null,
    androidResult: null,
    isRunning: false
  }),

  setActiveRun: (runId, checkpoints) => set({
    activeRunId: runId,
    checkpoints,
    iosLogs: [],
    androidLogs: [],
    iosResult: null,
    androidResult: null,
    isRunning: true
  }),

  startPatch: (platform) => {
    const checkpoints: BuildCheckpoint[] = []
    if (platform === 'ios' || platform === 'both') {
      checkpoints.push({ id: 'shorebird-patch-ios', label: 'Shorebird OTA patch', platform: 'ios', state: 'running' })
    }
    if (platform === 'android' || platform === 'both') {
      checkpoints.push({ id: 'shorebird-patch-android', label: 'Shorebird OTA patch', platform: 'android', state: 'running' })
    }
    set({
      activeRunId: 'shorebird-patch',
      checkpoints,
      iosLogs: [],
      androidLogs: [],
      iosResult: null,
      androidResult: null,
      isRunning: true
    })
  },

  finishPatch: (ios, android) => set((s) => ({
    isRunning: false,
    checkpoints: s.checkpoints.map((c) => {
      if (c.platform === 'ios' && ios !== undefined) return { ...c, state: ios ? 'done' : 'failed' }
      if (c.platform === 'android' && android !== undefined) return { ...c, state: android ? 'done' : 'failed' }
      return c
    }),
    iosResult: ios === undefined ? s.iosResult : ios ? 'success' : 'failed',
    androidResult: android === undefined ? s.androidResult : android ? 'success' : 'failed'
  }))
}))
