// App Store Connect API — set version metadata (What's New / Promotional Text) without fastlane.
// Auth is an ES256 JWT signed with the org's .p8 key (same key used for uploads). No extra deps:
// Node's crypto signs ES256 directly (dsaEncoding 'ieee-p1363' = the JOSE raw r||s format).
import { readFileSync } from 'fs'
import { createPrivateKey, sign as ecSign } from 'crypto'

const ASC = 'https://api.appstoreconnect.apple.com/v1'

// App Store version states we're allowed to edit metadata on. If an app has a live version
// plus a new editable one, we prefer the editable one; else fall back to the newest.
const EDITABLE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED',
  'INVALID_BINARY', 'WAITING_FOR_REVIEW', 'PENDING_DEVELOPER_RELEASE', 'READY_FOR_REVIEW'
])

const b64url = (b: Buffer): string =>
  b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

function jwt(keyId: string, issuerId: string, p8Pem: string): string {
  const now = Math.floor(Date.now() / 1000)
  const enc = (o: unknown): string => b64url(Buffer.from(JSON.stringify(o)))
  const head = enc({ alg: 'ES256', kid: keyId, typ: 'JWT' })
  const body = enc({ iss: issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' })
  const sig = ecSign('sha256', Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(p8Pem),
    dsaEncoding: 'ieee-p1363'
  })
  return `${head}.${body}.${b64url(sig)}`
}

async function asc(token: string, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(ASC + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.errors?.[0]?.title ?? text
    throw new Error(`ASC ${res.status}: ${detail}`)
  }
  return json
}

export interface StoreTextResult { versionString: string; locale: string; fields: string[] }

// Set What's New (whatsNew) and/or Promotional Text on the editable App Store version localization.
// Returns which fields were written, the version, and the locale touched.
export async function setAppStoreText(opts: {
  keyId: string
  issuerId: string
  p8Path: string
  bundleId: string
  whatsNew?: string
  promotionalText?: string
  locale?: string // default: en-US, else first available
}): Promise<StoreTextResult> {
  const pem = readFileSync(opts.p8Path, 'utf8')
  const token = jwt(opts.keyId, opts.issuerId, pem)

  const apps = await asc(token, 'GET', `/apps?filter[bundleId]=${encodeURIComponent(opts.bundleId)}&limit=1`)
  const app = apps.data?.[0]
  if (!app) throw new Error(`no App Store app found for bundleId ${opts.bundleId}`)

  const versions = await asc(token, 'GET', `/apps/${app.id}/appStoreVersions?limit=10`)
  const list: any[] = versions.data ?? []
  const version = list.find((v) => EDITABLE_STATES.has(v.attributes?.appStoreState)) ?? list[0]
  if (!version) throw new Error('no App Store version found — create/prepare one in App Store Connect first')

  const locs = await asc(token, 'GET', `/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`)
  const locList: any[] = locs.data ?? []
  const loc = (opts.locale && locList.find((l) => l.attributes?.locale === opts.locale))
    ?? locList.find((l) => l.attributes?.locale === 'en-US')
    ?? locList[0]
  if (!loc) throw new Error('no version localization found to edit')

  const attributes: Record<string, string> = {}
  if (opts.whatsNew !== undefined) attributes.whatsNew = opts.whatsNew
  if (opts.promotionalText !== undefined) attributes.promotionalText = opts.promotionalText

  await asc(token, 'PATCH', `/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes }
  })

  return {
    versionString: version.attributes?.versionString ?? '?',
    locale: loc.attributes?.locale ?? '?',
    fields: Object.keys(attributes)
  }
}
