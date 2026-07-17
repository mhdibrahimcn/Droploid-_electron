import { spawn, spawnSync, ChildProcess } from 'child_process'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'
import { kDroploidPATH, kRubyPATH, kArchiveCacheDir } from '../utils/paths'
import { stripAnsi } from '../utils/processRunner'
import { store } from './store'
import { getCredential } from './keychain'
import { bump, writeToPubspec } from './versionBumper'
import {
  kShorebirdPATH,
  shorebirdAndroidReleaseArgs,
  shorebirdIOSReleaseArgs,
  runShorebirdPatch
} from './shorebird'
import type { BuildPlatform, BumpKind, BuildResult, BuildCheckpoint, LogLine } from '../../shared/types/models'

export interface BuildCallbacks {
  onCheckpoint: (cp: BuildCheckpoint) => void
  onLogLine: (line: LogLine) => void
  onComplete: (iosResult: BuildResult | null, androidResult: BuildResult | null) => void
}

interface ActiveBuild {
  runId: string
  children: ChildProcess[]
  cancelled: boolean
}

const activeBuilds = new Map<string, ActiveBuild>()

let cpCounter = 0
function mkcp(label: string, platform: 'ios' | 'android'): BuildCheckpoint {
  return { id: `cp_${cpCounter++}`, label, platform, state: 'pending' }
}

const IOS_STEPS = [
  'Install CocoaPods',
  'Flutter build iOS',
  'Archive with Xcode',
  'Export IPA',
  'Validate IPA',
  'Upload to App Store'
]

// Shorebird release drives pod install + flutter build ipa + archive itself, so those
// collapse into a single step. Validate + upload are shared with the normal flow.
const IOS_SHOREBIRD_STEPS = [
  'Shorebird release iOS',
  'Validate IPA',
  'Upload to App Store'
]

const ANDROID_STEPS = [
  'Flutter build appbundle',
  'Upload via fastlane'
]

const ANDROID_SHOREBIRD_STEPS = [
  'Shorebird release appbundle',
  'Upload via fastlane'
]

export function getInitialCheckpoints(platform: BuildPlatform, useShorebird = false): BuildCheckpoint[] {
  const iosSteps = useShorebird ? IOS_SHOREBIRD_STEPS : IOS_STEPS
  const androidSteps = useShorebird ? ANDROID_SHOREBIRD_STEPS : ANDROID_STEPS
  const cps: BuildCheckpoint[] = []
  if (platform === 'ios' || platform === 'both') iosSteps.forEach((l) => cps.push(mkcp(l, 'ios')))
  if (platform === 'android' || platform === 'both') androidSteps.forEach((l) => cps.push(mkcp(l, 'android')))
  return cps
}

// Match Shorebird's build to the Flutter the project uses locally (deploy.sh pins this to
// avoid version-skew breakage). Best-effort — returns undefined if flutter isn't resolvable.
function detectFlutterVersion(): string | undefined {
  try {
    const r = spawnSync('flutter', ['--version', '--machine'], {
      env: { ...process.env, PATH: kDroploidPATH },
      encoding: 'utf8'
    })
    if (r.status === 0 && r.stdout) return JSON.parse(r.stdout).flutterVersion as string
  } catch {
    /* ignore — leave unpinned */
  }
  return undefined
}

function buildIOSEnv(keyID: string, issuerID: string, p8Path: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: kRubyPATH,
    // credentials via env, never argv — invisible to ps aux
    XCODE_AUTH_KEY_ID: keyID,
    XCODE_AUTH_KEY_ISSUER_ID: issuerID,
    XCODE_AUTH_KEY_PATH: p8Path
  }
}

function spawnLine(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv },
  onLine: (line: string) => void,
  active: ActiveBuild
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, stdio: 'pipe', shell: false })
    active.children.push(child)
    let buf = ''
    const flush = (chunk: Buffer) => {
      buf += chunk.toString('utf8')
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      lines.forEach((l) => {
        const clean = stripAnsi(l.trimEnd())
        if (clean) onLine(clean)
      })
    }
    child.stdout?.on('data', flush)
    child.stderr?.on('data', flush)
    child.on('close', (code) => {
      if (buf.trim()) onLine(stripAnsi(buf.trim()))
      resolve(active.cancelled ? 99 : (code ?? 1))
    })
    child.on('error', (e) => { onLine(`Error: ${e.message}`); resolve(1) })
  })
}

async function runIOS(
  appId: string,
  orgId: string,
  checkpoints: BuildCheckpoint[],
  cb: BuildCallbacks,
  active: ActiveBuild,
  useShorebird: boolean,
  flutterVersion: string | undefined
): Promise<BuildResult> {
  const apps = store.get('apps', [])
  const app = apps.find((a) => a.id === appId)
  if (!app) return 'failed'

  const keyID = await getCredential(orgId, 'ios_key_id') ?? ''
  const issuerID = await getCredential(orgId, 'ios_issuer_id') ?? ''
  const teamID = await getCredential(orgId, 'ios_team_id') ?? ''
  const p8Path = await getCredential(orgId, 'ios_p8_path') ?? ''
  const env = buildIOSEnv(keyID, issuerID, p8Path)
  const iosCps = checkpoints.filter((c) => c.platform === 'ios')
  let idx = 0

  const advance = (state: 'running' | 'done' | 'failed') => {
    if (iosCps[idx]) {
      iosCps[idx].state = state
      cb.onCheckpoint({ ...iosCps[idx] })
      if (state === 'done') idx++
    }
  }

  const log = (text: string, kind: LogLine['kind'] = 'output') => {
    cb.onLogLine({ id: `${Date.now()}`, kind, text, platform: 'ios' })
  }

  const bundleID = app.bundleID ?? 'com.example.app'
  const scheme = app.xcodeSchemeName ?? 'Runner'
  const archiveDir = join(kArchiveCacheDir, bundleID)
  const archivePath = join(archiveDir, 'Runner.xcarchive')

  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })

  const iosDir = join(app.dirPath, 'ios')
  const workspacePath = join(iosDir, 'Runner.xcworkspace')

  // ExportOptions.plist — shared by the normal export step and shorebird release (both need it).
  const plistPath = join(tmpdir(), `droploid_export_${Date.now()}.plist`)
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>${teamID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadBitcode</key><false/>
  <key>uploadSymbols</key><true/>
  <key>compileBitcode</key><false/>
</dict></plist>`

  let ipaPath = ''

  if (useShorebird) {
    // Single step: `shorebird release --platforms ios` runs pod install + flutter build ipa +
    // archive itself, signing via the plist above. IPA lands in build/ios/ipa. Signing goes
    // through Xcode automatic signing — a distribution profile must be available locally.
    advance('running')
    log('▶ Shorebird release iOS', 'step')
    writeFileSync(plistPath, plist, 'utf8')
    const sbEnv = { ...env, PATH: kShorebirdPATH, CI: 'true' }
    const sbArgs = shorebirdIOSReleaseArgs(plistPath, { flutterVersion })
    const sbCode = await spawnLine('shorebird', sbArgs, { cwd: app.dirPath, env: sbEnv }, log, active)
    try { unlinkSync(plistPath) } catch { /* ignore */ }
    if (sbCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
    const ipaDir = join(app.dirPath, 'build', 'ios', 'ipa')
    const sbIpas = existsSync(ipaDir) ? readdirSync(ipaDir).filter((f) => f.endsWith('.ipa')) : []
    if (sbIpas.length === 0) { log('Shorebird IPA not found (build/ios/ipa)', 'error'); advance('failed'); return 'failed' }
    ipaPath = join(ipaDir, sbIpas[0])
    advance('done')
  } else {
    // Step 1: pod install
    advance('running')
    log('▶ Install CocoaPods', 'step')
    const useBundle = existsSync(join(iosDir, 'Gemfile'))
    const podCmd = useBundle ? 'bundle' : 'pod'
    const podArgs = useBundle ? ['exec', 'pod', 'install', '--repo-update'] : ['install', '--repo-update']
    const podCode = await spawnLine(podCmd, podArgs, { cwd: iosDir, env }, log, active)
    if (podCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
    advance('done')

    // Step 2: flutter build ios
    advance('running')
    log('▶ Flutter build iOS', 'step')
    if (app.projectType === 'flutter') {
      const fbCode = await spawnLine('flutter', ['build', 'ios', '--release', '--no-codesign'], { cwd: app.dirPath, env }, log, active)
      if (fbCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
    }
    advance('done')

    // Step 3: xcodebuild archive — workspace + explicit auth key flags (bash script pattern)
    advance('running')
    log('▶ Archive with Xcode', 'step')
    const archiveArgs = [
      'archive',
      '-workspace', workspacePath,
      '-scheme', scheme,
      '-configuration', 'Release',
      '-archivePath', archivePath,
      '-destination', 'generic/platform=iOS',
      '-allowProvisioningUpdates',
      '-authenticationKeyPath', p8Path,
      '-authenticationKeyID', keyID,
      '-authenticationKeyIssuerID', issuerID,
      'CODE_SIGN_STYLE=Automatic',
      ...(teamID ? [`DEVELOPMENT_TEAM=${teamID}`] : [])
    ]
    const archCode = await spawnLine('/usr/bin/xcodebuild', archiveArgs, { cwd: app.dirPath, env }, log, active)
    if (archCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
    advance('done')

    // Step 4: export IPA — app-store-connect method + signingStyle + symbols
    advance('running')
    log('▶ Export IPA', 'step')
    writeFileSync(plistPath, plist, 'utf8')
    const exportArgs = [
      '-exportArchive',
      '-archivePath', archivePath,
      '-exportPath', archiveDir,
      '-exportOptionsPlist', plistPath,
      '-allowProvisioningUpdates',
      '-authenticationKeyPath', p8Path,
      '-authenticationKeyID', keyID,
      '-authenticationKeyIssuerID', issuerID
    ]
    const exportCode = await spawnLine('/usr/bin/xcodebuild', exportArgs, { cwd: app.dirPath, env }, log, active)
    try { unlinkSync(plistPath) } catch { /* ignore */ }
    if (exportCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }

    // locate the exported .ipa dynamically (filename = app name, not always Runner.ipa)
    const ipaFiles = existsSync(archiveDir) ? readdirSync(archiveDir).filter((f) => f.endsWith('.ipa')) : []
    if (ipaFiles.length === 0) { log('IPA not found after export', 'error'); advance('failed'); return 'failed' }
    ipaPath = join(archiveDir, ipaFiles[0])
    advance('done')
  }

  // Step 5: validate IPA before uploading
  advance('running')
  log('▶ Validate IPA', 'step')
  const validateArgs = ['altool', '--validate-app', '--type', 'ios', '--file', ipaPath, '--apiKey', keyID, '--apiIssuer', issuerID, '--verbose']
  const validateCode = await spawnLine('/usr/bin/xcrun', validateArgs, { env }, log, active)
  if (validateCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
  advance('done')

  // Step 6: upload to TestFlight
  advance('running')
  log('▶ Upload to App Store', 'step')
  const uploadArgs = ['altool', '--upload-app', '--type', 'ios', '--file', ipaPath, '--apiKey', keyID, '--apiIssuer', issuerID, '--verbose']
  const uploadCode = await spawnLine('/usr/bin/xcrun', uploadArgs, { env }, log, active)
  if (uploadCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
  advance('done')

  log('✓ iOS deploy complete', 'success')
  return 'success'
}

async function runAndroid(
  appId: string,
  orgId: string,
  track: string,
  rollout: number | undefined,
  releaseNotes: string | undefined,
  checkpoints: BuildCheckpoint[],
  cb: BuildCallbacks,
  active: ActiveBuild,
  useShorebird: boolean,
  flutterVersion: string | undefined
): Promise<BuildResult> {
  const apps = store.get('apps', [])
  const app = apps.find((a) => a.id === appId)
  if (!app) return 'failed'

  const jsonPath = await getCredential(orgId, 'android_json_path') ?? ''
  const env = { ...process.env, PATH: kDroploidPATH }
  const androidCps = checkpoints.filter((c) => c.platform === 'android')
  let idx = 0

  const advance = (state: 'running' | 'done' | 'failed') => {
    if (androidCps[idx]) {
      androidCps[idx].state = state
      cb.onCheckpoint({ ...androidCps[idx] })
      if (state === 'done') idx++
    }
  }

  const log = (text: string, kind: LogLine['kind'] = 'output') => {
    cb.onLogLine({ id: `${Date.now()}`, kind, text, platform: 'android' })
  }

  // Step 1: build the AAB — shorebird release (patchable) or plain flutter build.
  // Both land the bundle at build/app/outputs/bundle/release, so step 2 is unchanged.
  advance('running')
  if (useShorebird) {
    log('▶ Shorebird release appbundle', 'step')
    const sbEnv = { ...process.env, PATH: kShorebirdPATH, CI: 'true' }
    const sbCode = await spawnLine('shorebird', shorebirdAndroidReleaseArgs({ flutterVersion }), { cwd: app.dirPath, env: sbEnv }, log, active)
    if (sbCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
  } else {
    log('▶ Flutter build appbundle', 'step')
    const buildArgs = ['build', 'appbundle', '--release', '--obfuscate', '--split-debug-info=build/debug-info']
    const buildCode = await spawnLine('flutter', buildArgs, { cwd: app.dirPath, env }, log, active)
    if (buildCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
  }
  advance('done')

  // Step 2: fastlane supply
  advance('running')
  log('▶ Upload via fastlane', 'step')
  const aabPath = join(app.dirPath, 'build', 'app', 'outputs', 'bundle', 'release', 'app-release.aab')
  const supplyArgs: string[] = [
    'supply',
    '--aab', aabPath,
    '--track', track,
    '--package_name', app.packageName ?? '',
    '--json_key', jsonPath
  ]
  if (rollout !== undefined && track === 'production') supplyArgs.push('--rollout', String(rollout))

  let notesTmp: string | undefined
  if (releaseNotes?.trim()) {
    notesTmp = join(tmpdir(), `droploid_notes_${Date.now()}.txt`)
    writeFileSync(notesTmp, releaseNotes, 'utf8')
    supplyArgs.push('--release_notes_path', notesTmp)
  }

  const supplyCode = await spawnLine('fastlane', supplyArgs, { env }, log, active)
  if (notesTmp) try { unlinkSync(notesTmp) } catch { /* ignore */ }
  if (supplyCode !== 0 || active.cancelled) { advance('failed'); return 'failed' }
  advance('done')

  log('✓ Android deploy complete', 'success')
  return 'success'
}

export async function startBuild(params: {
  runId: string
  appId: string
  orgId: string
  platform: BuildPlatform
  bumpKind: BumpKind
  track: string
  rollout?: number
  releaseNotes?: string
  useShorebird?: boolean
  checkpoints: BuildCheckpoint[]
  callbacks: BuildCallbacks
}): Promise<void> {
  const { runId, appId, orgId, platform, bumpKind, track, rollout, releaseNotes, checkpoints, callbacks } = params
  const useShorebird = params.useShorebird ?? false
  const active: ActiveBuild = { runId, children: [], cancelled: false }
  activeBuilds.set(runId, active)

  // Pin shorebird's build to the local Flutter version (skip detection when not using shorebird).
  const flutterVersion = useShorebird ? detectFlutterVersion() : undefined

  // bump version if requested
  if (bumpKind !== 'none') {
    const apps = store.get('apps', [])
    const app = apps.find((a) => a.id === appId)
    if (app && app.projectType === 'flutter') {
      const newVersion = bump(app.currentVersion, bumpKind)
      writeToPubspec(app.dirPath, newVersion)
      store.set('apps', apps.map((a) => a.id === appId ? { ...a, currentVersion: newVersion } : a))
    }
  }

  let iosResult: BuildResult | null = null
  let androidResult: BuildResult | null = null

  const iosPromise = (platform === 'ios' || platform === 'both')
    ? runIOS(appId, orgId, checkpoints, callbacks, active, useShorebird, flutterVersion)
    : Promise.resolve(null)

  const androidPromise = (platform === 'android' || platform === 'both')
    ? runAndroid(appId, orgId, track, rollout, releaseNotes, checkpoints, callbacks, active, useShorebird, flutterVersion)
    : Promise.resolve(null)

  ;[iosResult, androidResult] = await Promise.all([iosPromise, androidPromise])

  activeBuilds.delete(runId)
  callbacks.onComplete(iosResult, androidResult)
}

// Standalone OTA patch flow (deploy.sh option 5). Patches the latest shorebird release
// over-the-air — no store upload. Only works on a build made with `shorebird release`.
// `platform: 'both'` patches iOS then Android sequentially. Registered in activeBuilds so
// cancelBuild can kill it. Resolves with per-platform success.
export async function startShorebirdPatch(params: {
  runId: string
  appId: string
  platform: BuildPlatform
  onLine: (line: LogLine) => void
}): Promise<{ ios?: boolean; android?: boolean }> {
  const { runId, appId, platform, onLine } = params
  const app = store.get('apps', []).find((a) => a.id === appId)
  if (!app) return {}

  const active: ActiveBuild = { runId, children: [], cancelled: false }
  activeBuilds.set(runId, active)

  const patch = async (p: 'ios' | 'android'): Promise<boolean> => {
    onLine({ id: `${Date.now()}`, kind: 'step', text: `▶ Shorebird patch ${p}`, platform: p })
    const code = await runShorebirdPatch(
      p,
      app.dirPath,
      (line) => onLine({ id: `${Date.now()}`, kind: 'output', text: line, platform: p }),
      active
    )
    const ok = code === 0 && !active.cancelled
    onLine({
      id: `${Date.now()}`,
      kind: ok ? 'success' : 'error',
      text: ok ? `✓ ${p} patch pushed` : `${p} patch failed`,
      platform: p
    })
    return ok
  }

  const result: { ios?: boolean; android?: boolean } = {}
  if ((platform === 'ios' || platform === 'both') && !active.cancelled) result.ios = await patch('ios')
  if ((platform === 'android' || platform === 'both') && !active.cancelled) result.android = await patch('android')

  activeBuilds.delete(runId)
  return result
}

export function cancelBuild(runId: string): void {
  const active = activeBuilds.get(runId)
  if (!active) return
  active.cancelled = true
  active.children.forEach((c) => { try { c.kill('SIGTERM') } catch { /* ignore */ } })
  activeBuilds.delete(runId)
}
