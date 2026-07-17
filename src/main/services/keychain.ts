import keytar from 'keytar'
import { kKeychainService } from '../utils/paths'

export type OrgCredField =
  | 'ios_p8_path'
  | 'ios_key_id'
  | 'ios_issuer_id'
  | 'ios_team_id'
  | 'android_json_path'

function key(orgId: string, field: OrgCredField): string {
  return `org.${orgId}.${field}`
}

export async function setCredential(
  orgId: string,
  field: OrgCredField,
  value: string
): Promise<void> {
  await keytar.setPassword(kKeychainService, key(orgId, field), value)
}

export async function getCredential(
  orgId: string,
  field: OrgCredField
): Promise<string | null> {
  return keytar.getPassword(kKeychainService, key(orgId, field))
}

export async function deleteOrgCredentials(orgId: string): Promise<void> {
  const fields: OrgCredField[] = [
    'ios_p8_path',
    'ios_key_id',
    'ios_issuer_id',
    'ios_team_id',
    'android_json_path'
  ]
  await Promise.all(fields.map((f) => keytar.deletePassword(kKeychainService, key(orgId, f))))
}
