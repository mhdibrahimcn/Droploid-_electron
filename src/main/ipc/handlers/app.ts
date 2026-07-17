import { ipcMain, dialog } from 'electron'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { extname } from 'path'
import { store } from '../../services/store'
import { detect } from '../../services/projectDetector'
import { getCredential } from '../../services/keychain'
import { queryTracks } from '../../services/trackQueryEngine'
import { queryIOSStatus } from '../../services/appStoreStatusEngine'
import type { LinkedApp, AppStoreStatus } from '../../../shared/types/models'

const imgMime: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
}

function iconToDataUrl(iconPath: string | undefined): string | undefined {
  if (!iconPath) return undefined
  try {
    const data = readFileSync(iconPath)
    const mime = imgMime[extname(iconPath).toLowerCase()] ?? 'image/png'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return undefined
  }
}

export function registerAppHandlers(): void {
  ipcMain.handle('app:list', async (_, { orgId }: { orgId: string }) => {
    return store.get('apps', [])
      .filter((a) => a.organisationId === orgId)
      .map((a) => ({ ...a, iconData: iconToDataUrl(a.iconPath) }))
  })

  ipcMain.handle('app:detect', async (_, { dirPath }: { dirPath: string }) => {
    return detect(dirPath)
  })

  ipcMain.handle('app:link', async (_, { orgId, dirPath }: { orgId: string; dirPath: string }) => {
    const meta = detect(dirPath)
    const app: LinkedApp = {
      id: randomUUID(),
      organisationId: orgId,
      dirPath,
      name: meta.name,
      bundleID: meta.bundleID,
      packageName: meta.packageName,
      currentVersion: meta.version,
      projectType: meta.projectType,
      xcodeSchemeName: meta.schemeName,
      iconPath: meta.iconPath,
      linkedAt: new Date().toISOString()
    }
    store.set('apps', [...store.get('apps', []), app])
    return { ...app, iconData: iconToDataUrl(app.iconPath) }
  })

  ipcMain.handle('app:get-icon', async (_, { iconPath }: { iconPath: string }): Promise<string | null> => {
    try {
      const data = readFileSync(iconPath)
      const mime = imgMime[extname(iconPath).toLowerCase()] ?? 'image/png'
      return `data:${mime};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('app:unlink', async (_, { id }: { id: string }) => {
    store.set('apps', store.get('apps', []).filter((a) => a.id !== id))
    store.set('build_runs', store.get('build_runs', []).filter((r) => r.appId !== id))
  })

  ipcMain.handle('app:store-status', async (_, { appId, orgId }: { appId: string; orgId: string }) => {
    const app = store.get('apps', []).find((a) => a.id === appId)
    if (!app) throw new Error('App not found')

    const result: AppStoreStatus = { fetchedAt: new Date().toISOString() }

    await Promise.allSettled([
      (async () => {
        if (!app.packageName) return
        const jsonPath = await getCredential(orgId, 'android_json_path')
        if (!jsonPath) return
        result.android = await queryTracks(app.packageName, jsonPath)
      })(),
      (async () => {
        if (!app.bundleID) return
        const [keyId, issuerId, p8Path] = await Promise.all([
          getCredential(orgId, 'ios_key_id'),
          getCredential(orgId, 'ios_issuer_id'),
          getCredential(orgId, 'ios_p8_path'),
        ])
        if (!keyId || !issuerId || !p8Path) return
        result.ios = await queryIOSStatus({ bundleId: app.bundleID, keyId, issuerId, p8Path })
      })(),
    ])

    return result
  })
}
