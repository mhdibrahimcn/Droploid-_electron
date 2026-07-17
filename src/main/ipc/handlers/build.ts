import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { store } from '../../services/store'
import { runPreflight } from '../../services/preflightChecker'
import { startBuild, cancelBuild, getInitialCheckpoints, startShorebirdPatch } from '../../services/buildEngine'
import { queryTracks } from '../../services/trackQueryEngine'
import { promoteRelease } from '../../services/promoteEngine'
import { getCredential } from '../../services/keychain'
import { kLogsDir } from '../../utils/paths'
import type { BuildPlatform, BumpKind, BuildResult } from '../../../shared/types/models'

export function registerBuildHandlers(win: BrowserWindow): void {
  ipcMain.handle('build:preflight', async (_, { appId, orgId, platform }: { appId: string; orgId: string; platform: BuildPlatform }) => {
    return runPreflight(appId, orgId, platform)
  })

  ipcMain.handle('build:history', async (_, { appId }: { appId: string }) => {
    return store.get('build_runs', [])
      .filter((r) => r.appId === appId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  })

  ipcMain.handle('build:start', async (
    _,
    { appId, orgId, platform, bumpKind, track, rollout, releaseNotes, useShorebird }: {
      appId: string; orgId: string; platform: BuildPlatform; bumpKind: BumpKind;
      track: string; rollout?: number; releaseNotes?: string; useShorebird?: boolean
    }
  ) => {
    const runId = randomUUID()
    const app = store.get('apps', []).find((a) => a.id === appId)
    if (!app) throw new Error('App not found')

    const checkpoints = getInitialCheckpoints(platform, useShorebird)
    const logPath = join(kLogsDir, `${runId}.log`)

    const run = {
      id: runId,
      appId,
      platform,
      version: app.currentVersion,
      track,
      startedAt: new Date().toISOString(),
      result: 'running' as BuildResult,
      logPath,
      trigger: 'manual' as const
    }
    store.set('build_runs', [...store.get('build_runs', []), run])

    // emit initial checkpoints so renderer can listen before build starts
    checkpoints.forEach((cp) => win.webContents.send('build:checkpoint', cp))

    setImmediate(() => {
      startBuild({
        runId, appId, orgId, platform, bumpKind, track, rollout, releaseNotes, useShorebird,
        checkpoints,
        callbacks: {
          onCheckpoint: (cp) => win.webContents.send('build:checkpoint', cp),
          onLogLine: (line) => win.webContents.send('build:log-line', line),
          onComplete: (iosResult, androidResult) => {
            const combined: BuildResult =
              iosResult === 'failed' || androidResult === 'failed' ? 'failed' : 'success'
            const endedAt = new Date().toISOString()
            const runs = store.get('build_runs', [])
            store.set('build_runs', runs.map((r) =>
              r.id === runId
                ? { ...r, result: combined, iosResult: iosResult ?? undefined, androidResult: androidResult ?? undefined, endedAt }
                : r
            ))
            store.set('apps', store.get('apps', []).map((a) =>
              a.id === appId ? { ...a, lastDeployAt: endedAt } : a
            ))
            win.webContents.send('build:complete', { runId, result: combined, iosResult, androidResult })
          }
        }
      })
    })

    return { runId, checkpoints }
  })

  ipcMain.handle('build:cancel', async (_, { runId }: { runId: string }) => {
    cancelBuild(runId)
    const runs = store.get('build_runs', [])
    store.set('build_runs', runs.map((r) => r.id === runId ? { ...r, result: 'cancelled' as BuildResult } : r))
  })

  // Shorebird OTA patch — standalone flow, no build_run record, streams over build:log-line.
  ipcMain.handle('build:shorebird-patch', async (_, { appId, platform }: { appId: string; platform: BuildPlatform }) => {
    const runId = randomUUID()
    const result = await startShorebirdPatch({
      runId, appId, platform,
      onLine: (line) => win.webContents.send('build:log-line', line)
    })
    return { runId, ...result }
  })

  ipcMain.handle('build:tracks', async (_, { packageName, jsonKeyPath }: { packageName: string; jsonKeyPath: string }) => {
    return queryTracks(packageName, jsonKeyPath)
  })

  ipcMain.handle('build:promote', async (_, { packageName, jsonKeyPath, fromTrack, toTrack }: { packageName: string; jsonKeyPath: string; fromTrack: string; toTrack: string }) => {
    await promoteRelease({
      packageName, jsonKeyPath, fromTrack, toTrack,
      onLine: (line) => win.webContents.send('promote:log-line', { text: line })
    })
    win.webContents.send('promote:complete', { success: true })
  })
}
