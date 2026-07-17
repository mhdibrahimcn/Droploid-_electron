import { describe, it, expect, vi, beforeEach } from 'vitest'

const listeners: Record<string, (...args: unknown[]) => void> = {}

vi.mock('../../lib/ipc', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listeners[channel] = listener
      return vi.fn()
    }),
    send: vi.fn(),
  },
}))

import { useBuildStore } from '../buildStore'
import type { BuildCheckpoint } from '../../../../../shared/types/models'

function makeCp(id: string, platform: 'ios' | 'android' = 'ios'): BuildCheckpoint {
  return { id, label: `Step ${id}`, platform, state: 'pending' }
}

describe('buildStore', () => {
  beforeEach(() => {
    useBuildStore.getState().reset()
    Object.keys(listeners).forEach((k) => delete listeners[k])
  })

  describe('setActiveRun', () => {
    it('seeds checkpoints and marks isRunning', () => {
      const cps = [makeCp('cp_1'), makeCp('cp_2')]
      useBuildStore.getState().setActiveRun('run-123', cps)
      const s = useBuildStore.getState()
      expect(s.activeRunId).toBe('run-123')
      expect(s.checkpoints).toHaveLength(2)
      expect(s.isRunning).toBe(true)
      expect(s.iosLogs).toHaveLength(0)
    })

    it('clears previous logs when starting new run', () => {
      useBuildStore.getState().setActiveRun('run-1', [makeCp('a')])
      useBuildStore.setState({ iosLogs: [{ id: '1', kind: 'output', text: 'old log', platform: 'ios' }] })
      useBuildStore.getState().setActiveRun('run-2', [makeCp('b')])
      expect(useBuildStore.getState().iosLogs).toHaveLength(0)
    })

    it('resets results from previous run', () => {
      useBuildStore.setState({ iosResult: 'success', androidResult: 'failed' })
      useBuildStore.getState().setActiveRun('run-3', [])
      expect(useBuildStore.getState().iosResult).toBeNull()
      expect(useBuildStore.getState().androidResult).toBeNull()
    })
  })

  describe('reset', () => {
    it('clears all build state', () => {
      useBuildStore.getState().setActiveRun('run-x', [makeCp('cp_x')])
      useBuildStore.getState().reset()
      const s = useBuildStore.getState()
      expect(s.activeRunId).toBeNull()
      expect(s.checkpoints).toHaveLength(0)
      expect(s.isRunning).toBe(false)
      expect(s.iosResult).toBeNull()
      expect(s.androidResult).toBeNull()
    })
  })

  describe('checkpoint listener (upsert)', () => {
    beforeEach(() => {
      useBuildStore.getState().startListening()
    })

    it('adds checkpoint when id not found', () => {
      const cp = makeCp('brand-new')
      listeners['build:checkpoint']!(cp)
      expect(useBuildStore.getState().checkpoints).toContainEqual(cp)
    })

    it('updates checkpoint state when id exists', () => {
      const cp = makeCp('existing-cp')
      useBuildStore.getState().setActiveRun('run-upd', [cp])
      const updated: BuildCheckpoint = { ...cp, state: 'done' }
      listeners['build:checkpoint']!(updated)
      const found = useBuildStore.getState().checkpoints.find((c) => c.id === 'existing-cp')
      expect(found?.state).toBe('done')
      expect(useBuildStore.getState().checkpoints).toHaveLength(1)
    })

    it('does not duplicate checkpoints on repeated updates', () => {
      const cp = makeCp('dupe-cp')
      useBuildStore.getState().setActiveRun('run-d', [cp])
      listeners['build:checkpoint']!({ ...cp, state: 'running' })
      listeners['build:checkpoint']!({ ...cp, state: 'done' })
      expect(useBuildStore.getState().checkpoints).toHaveLength(1)
      expect(useBuildStore.getState().checkpoints[0].state).toBe('done')
    })

    it('log-line appends to correct platform array', () => {
      const iosLine = { id: '1', kind: 'output' as const, text: 'ios log', platform: 'ios' as const }
      const androidLine = { id: '2', kind: 'output' as const, text: 'android log', platform: 'android' as const }
      listeners['build:log-line']!(iosLine)
      listeners['build:log-line']!(androidLine)
      expect(useBuildStore.getState().iosLogs).toContainEqual(iosLine)
      expect(useBuildStore.getState().androidLogs).toContainEqual(androidLine)
    })

    it('build:complete sets results and stops running', () => {
      useBuildStore.setState({ isRunning: true })
      listeners['build:complete']!({ runId: 'r1', result: 'success', iosResult: 'success', androidResult: 'failed' })
      const s = useBuildStore.getState()
      expect(s.isRunning).toBe(false)
      expect(s.iosResult).toBe('success')
      expect(s.androidResult).toBe('failed')
    })
  })
})
