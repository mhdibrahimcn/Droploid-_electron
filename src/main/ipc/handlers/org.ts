import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { store } from '../../services/store'
import { setCredential, deleteOrgCredentials } from '../../services/keychain'
import { kOrgPhotosDir } from '../../utils/paths'
import type { Organisation, OrgCredentials } from '../../../shared/types/models'

export function registerOrgHandlers(): void {
  ipcMain.handle('org:list', async () => {
    return store.get('organisations', [])
  })

  ipcMain.handle('org:create', async (_, { name, photoPath, credentials }: { name: string; photoPath?: string; credentials: OrgCredentials }) => {
    const id = randomUUID()

    let savedPhoto: string | undefined
    if (photoPath) {
      if (!existsSync(kOrgPhotosDir)) mkdirSync(kOrgPhotosDir, { recursive: true })
      const dest = join(kOrgPhotosDir, `${id}${extname(photoPath)}`)
      copyFileSync(photoPath, dest)
      savedPhoto = dest
    }

    if (credentials.iosKeyID) await setCredential(id, 'ios_key_id', credentials.iosKeyID)
    if (credentials.iosIssuerID) await setCredential(id, 'ios_issuer_id', credentials.iosIssuerID)
    if (credentials.iosTeamID) await setCredential(id, 'ios_team_id', credentials.iosTeamID)
    if (credentials.iosP8Path) await setCredential(id, 'ios_p8_path', credentials.iosP8Path)
    if (credentials.androidJsonPath) await setCredential(id, 'android_json_path', credentials.androidJsonPath)

    const org: Organisation = { id, name, photoPath: savedPhoto, createdAt: new Date().toISOString() }
    store.set('organisations', [...store.get('organisations', []), org])
    return org
  })

  ipcMain.handle('org:update', async (_, { id, name, photoPath, credentials }: { id: string; name?: string; photoPath?: string; credentials?: OrgCredentials }) => {
    const orgs = store.get('organisations', [])
    const idx = orgs.findIndex((o) => o.id === id)
    if (idx === -1) throw new Error('Organisation not found')

    let savedPhoto = orgs[idx].photoPath
    if (photoPath && photoPath !== savedPhoto) {
      if (!existsSync(kOrgPhotosDir)) mkdirSync(kOrgPhotosDir, { recursive: true })
      const dest = join(kOrgPhotosDir, `${id}${extname(photoPath)}`)
      copyFileSync(photoPath, dest)
      savedPhoto = dest
    }

    if (credentials) {
      if (credentials.iosKeyID !== undefined) await setCredential(id, 'ios_key_id', credentials.iosKeyID)
      if (credentials.iosIssuerID !== undefined) await setCredential(id, 'ios_issuer_id', credentials.iosIssuerID)
      if (credentials.iosTeamID !== undefined) await setCredential(id, 'ios_team_id', credentials.iosTeamID)
      if (credentials.iosP8Path !== undefined) await setCredential(id, 'ios_p8_path', credentials.iosP8Path)
      if (credentials.androidJsonPath !== undefined) await setCredential(id, 'android_json_path', credentials.androidJsonPath)
    }

    const updated = { ...orgs[idx], ...(name ? { name } : {}), photoPath: savedPhoto }
    orgs[idx] = updated
    store.set('organisations', orgs)
    return updated
  })

  ipcMain.handle('org:delete', async (_, { id }: { id: string }) => {
    await deleteOrgCredentials(id)

    const apps = store.get('apps', []).filter((a) => a.organisationId !== id)
    const deletedAppIds = store.get('apps', []).filter((a) => a.organisationId === id).map((a) => a.id)
    store.set('apps', apps)
    store.set('build_runs', store.get('build_runs', []).filter((r) => !deletedAppIds.includes(r.appId)))
    store.set('organisations', store.get('organisations', []).filter((o) => o.id !== id))
  })
}
