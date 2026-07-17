import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { kDroploidPATH } from '../utils/paths'
import type { TrackInfo } from '../../shared/types/models'

function buildScript(packageName: string, jsonKeyPath: string): string {
  return `import json, sys
from googleapiclient.discovery import build
from google.oauth2 import service_account

SCOPES = ['https://www.googleapis.com/auth/androidpublisher']

creds = service_account.Credentials.from_service_account_file(
    ${JSON.stringify(jsonKeyPath)}, scopes=SCOPES)
service = build('androidpublisher', 'v3', credentials=creds)

edit = service.edits().insert(packageName=${JSON.stringify(packageName)}, body={}).execute()
edit_id = edit['id']

tracks = service.edits().tracks().list(
    packageName=${JSON.stringify(packageName)}, editId=edit_id).execute()

service.edits().delete(packageName=${JSON.stringify(packageName)}, editId=edit_id).execute()

print(json.dumps(tracks.get('tracks', [])))
`
}

export async function queryTracks(
  packageName: string,
  jsonKeyPath: string
): Promise<TrackInfo[]> {
  const scriptPath = join(tmpdir(), `droploid_tracks_${Date.now()}.py`)
  writeFileSync(scriptPath, buildScript(packageName, jsonKeyPath), 'utf8')

  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scriptPath], {
      env: { ...process.env, PATH: kDroploidPATH },
      stdio: 'pipe',
      shell: false
    })
    let out = ''
    let err = ''
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.stderr?.on('data', (d) => { err += d.toString() })
    child.on('close', (code) => {
      try { unlinkSync(scriptPath) } catch { /* ignore */ }
      if (code !== 0) {
        reject(new Error(err || 'Track query failed'))
        return
      }
      try {
        const raw = JSON.parse(out.trim())
        const tracks: TrackInfo[] = raw.map((t: Record<string, unknown>) => ({
          track: t['track'] as string,
          releases: ((t['releases'] as Record<string, unknown>[]) ?? []).map((r) => ({
            name: r['name'] as string | undefined,
            versionCodes: (r['versionCodes'] as string[]) ?? [],
            status: r['status'] as string ?? 'unknown',
            userFraction: r['userFraction'] as number | undefined
          }))
        }))
        resolve(tracks)
      } catch {
        reject(new Error('Failed to parse track data'))
      }
    })
    child.on('error', (e) => {
      try { unlinkSync(scriptPath) } catch { /* ignore */ }
      reject(e)
    })
  })
}
