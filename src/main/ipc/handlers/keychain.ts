import { ipcMain } from 'electron'
import { setCredential, getCredential, deleteOrgCredentials } from '../../services/keychain'
import type { OrgCredField } from '../../services/keychain'

export function registerKeychainHandlers(): void {
  ipcMain.handle('keychain:set', async (_, { orgId, field, value }: { orgId: string; field: string; value: string }) => {
    await setCredential(orgId, field as OrgCredField, value)
  })

  ipcMain.handle('keychain:get', async (_, { orgId, field }: { orgId: string; field: string }) => {
    return getCredential(orgId, field as OrgCredField)
  })

  ipcMain.handle('keychain:delete-org', async (_, { orgId }: { orgId: string }) => {
    await deleteOrgCredentials(orgId)
  })
}
