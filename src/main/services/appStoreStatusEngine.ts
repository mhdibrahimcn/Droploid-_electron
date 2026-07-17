import { createSign } from 'crypto'
import { readFileSync } from 'fs'
import type { IOSStoreStatus } from '../../shared/types/models'

const BASE = 'https://api.appstoreconnect.apple.com/v1'

function generateJWT(keyId: string, issuerId: string, p8Path: string): string {
  const privateKey = readFileSync(p8Path, 'utf8')
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url')
  const signingInput = `${header}.${payload}`
  const signer = createSign('SHA256')
  signer.update(signingInput)
  const sig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${signingInput}.${sig}`
}

async function appleGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Apple API ${res.status} ${path}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

interface ASCResponse<T> { data: T[]; included?: Record<string, unknown>[] }

export async function queryIOSStatus(params: {
  bundleId: string
  keyId: string
  issuerId: string
  p8Path: string
}): Promise<IOSStoreStatus> {
  const { bundleId, keyId, issuerId, p8Path } = params
  const token = generateJWT(keyId, issuerId, p8Path)

  const appsResp = await appleGet<ASCResponse<{ id: string }>>(
    token,
    `/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=id,name&limit=1`
  )
  const appId = (appsResp as unknown as ASCResponse<{ id: string }>).data?.[0]?.id
  if (!appId) throw new Error(`App not found for bundle ID: ${bundleId}`)

  const [versionsResp, buildsResp] = await Promise.all([
    appleGet<ASCResponse<{ id: string; attributes: { versionString: string; appStoreState: string; createdDate?: string } }>>(
      token,
      `/apps/${appId}/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState,createdDate&limit=10`
    ),
    appleGet<ASCResponse<{ id: string; attributes: { version: string; uploadedDate?: string; processingState: string }; relationships?: { preReleaseVersion?: { data?: { id: string } } } }>>(
      token,
      `/builds?filter[app]=${appId}&sort=-uploadedDate&limit=10&fields[builds]=version,uploadedDate,processingState&include=preReleaseVersion&fields[preReleaseVersions]=version`
    ),
  ])

  const appStoreVersions = versionsResp.data.map((v) => ({
    versionString: v.attributes.versionString,
    state: v.attributes.appStoreState,
    createdDate: v.attributes.createdDate,
  }))

  const includedVersions = (buildsResp.included ?? []) as Array<{ id: string; type: string; attributes: { version: string } }>

  const testFlightBuilds = buildsResp.data.map((b) => {
    const preRelId = b.relationships?.preReleaseVersion?.data?.id
    const preRel = preRelId ? includedVersions.find((i) => i.type === 'preReleaseVersions' && i.id === preRelId) : undefined
    return {
      buildNumber: b.attributes.version,
      version: preRel?.attributes.version ?? '',
      uploadedDate: b.attributes.uploadedDate,
      processingState: b.attributes.processingState,
    }
  })

  return { appStoreVersions, testFlightBuilds }
}
