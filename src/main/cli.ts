// Headless CLI. Runs inside Electron (via `--cli` argv branch in index.ts) so it reuses the
// exact same store / keychain / buildEngine the GUI uses — no reimplementation, no drift.
// Convention: human/log output → stderr, machine result → stdout. `--json` makes stdout parseable
// for AI agents. Exits the process itself (app.exit) with 0=ok, 1=error/failed.
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { store } from './services/store'
import { setCredential } from './services/keychain'
import { detect } from './services/projectDetector'
import { getInitialCheckpoints, startBuild, startShorebirdPatch } from './services/buildEngine'
import { runPreflight } from './services/preflightChecker'
import { checkAllTools } from './services/toolChecker'
import { kLogsDir } from './utils/paths'
import type {
  BuildPlatform, BumpKind, BuildResult, LinkedApp, Organisation, OrgCredentials
} from '../shared/types/models'

// ── tiny arg parser (ponytail: no commander dep for ~10 flags) ────────────────
interface Parsed { _: string[]; flags: Record<string, string | boolean> }
function parse(argv: string[]): Parsed {
  const _: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) flags[key] = true
      else { flags[key] = next; i++ }
    } else _.push(a)
  }
  return { _, flags }
}
const str = (v: string | boolean | undefined): string | undefined =>
  typeof v === 'string' ? v : undefined

const err = (msg: string): void => { process.stderr.write(msg + '\n') }
const out = (msg: string): void => { process.stdout.write(msg + '\n') }

function done(code: number, json: boolean, payload: unknown): never {
  if (json) out(JSON.stringify(payload))
  // process.exit halts synchronously; app.exit only schedules a quit, so code would fall through.
  process.exit(code)
}

// app ref = --app <ref> OR first positional (so `droploid deploy MyApp` just works)
function appRef(p: Parsed): string | undefined {
  return str(p.flags.app) ?? p._[0]
}
// resolve an app by id OR name (agent-friendly)
function findApp(ref: string): LinkedApp | undefined {
  const apps = store.get('apps', [])
  return apps.find((a) => a.id === ref) ?? apps.find((a) => a.name === ref)
}
function findOrg(ref: string): Organisation | undefined {
  const orgs = store.get('organisations', [])
  return orgs.find((o) => o.id === ref) ?? orgs.find((o) => o.name === ref)
}

const HELP = `droploid — deploy Flutter & native iOS/Android apps to the App Store & Play Store

USAGE
  droploid <command> [app] [options] [--json]
  droploid --help

COMMANDS
  setup                                Interactive first-time setup (no flags — just answer prompts)
  orgs                                 List organisations
  apps [--org <id|name>]               List linked apps
  tools                                Check required toolchain (flutter, fastlane, xcode…)
  link <dir> --org <id|name>           Detect & link an app project
  config-org --name <name> [creds]     Create an org (prints its id)
  config-org --id <id> [creds]         Update an org's credentials
  preflight <app>                      Run pre-deploy checks
  deploy <app> [options]               Build & upload
  patch <app>                          Shorebird OTA patch (no store upload)
  history <app>                        Recent build runs

  <app> = app id or name (or pass --app <id|name>)

CREDS (config-org)
  --ios-key-id <k> --ios-issuer-id <i> --ios-team-id <t> --ios-p8 <path> --android-json <path>
  iOS: App Store Connect ▸ Users and Access ▸ Integrations ▸ App Store Connect API (Issuer ID + Key ID + .p8)
  Android: Google Cloud Console ▸ IAM & Admin ▸ Service Accounts ▸ Keys ▸ Add key ▸ JSON, then grant it in Play Console
  Tip: run "droploid setup" for a guided, no-flags walkthrough.

DEPLOY OPTIONS
  --platform ios|android|both   (default both)
  --track internal|beta|production   (default internal; Android)
  --bump none|buildOnly|patch|minor|major   (default none)
  --rollout <0..1>              Staged production rollout fraction
  --notes "<text>"             Release notes
  --shorebird                  Build a patchable Shorebird release

--json on any command prints a machine-readable result to stdout (for AI agents).`

async function cmdDeploy(p: Parsed, json: boolean): Promise<never> {
  const ref = appRef(p)
  if (!ref) { err('deploy: app required — `droploid deploy <id|name>` or --app'); return done(1, json, { error: 'app_required' }) }
  const appRec = findApp(ref)
  if (!appRec) { err(`deploy: app not found: ${ref}`); return done(1, json, { error: 'app_not_found' }) }

  const platform = (str(p.flags.platform) ?? 'both') as BuildPlatform
  const track = str(p.flags.track) ?? 'internal'
  const bumpKind = (str(p.flags.bump) ?? 'none') as BumpKind
  const useShorebird = p.flags.shorebird === true
  const rollout = str(p.flags.rollout) ? Number(str(p.flags.rollout)) : undefined
  const releaseNotes = str(p.flags.notes)

  const runId = randomUUID()
  const checkpoints = getInitialCheckpoints(platform, useShorebird)
  const logPath = join(kLogsDir, `${runId}.log`)
  const startedAt = new Date().toISOString()

  store.set('build_runs', [...store.get('build_runs', []), {
    id: runId, appId: appRec.id, platform, version: appRec.currentVersion, track,
    startedAt, result: 'running' as BuildResult, logPath, trigger: 'manual' as const
  }])

  err(`▶ Deploying ${appRec.name} (${platform}) v${appRec.currentVersion}${useShorebird ? ' [shorebird]' : ''}`)

  const combined: BuildResult = await new Promise((resolve) => {
    startBuild({
      runId, appId: appRec.id, orgId: appRec.organisationId, platform, bumpKind, track,
      rollout, releaseNotes, useShorebird, checkpoints,
      callbacks: {
        onCheckpoint: (cp) => err(`  ${cp.state === 'done' ? '✓' : cp.state === 'failed' ? '✗' : '…'} [${cp.platform}] ${cp.label}`),
        onLogLine: (line) => err(line.text),
        onComplete: (ios, android) => {
          const endedAt = new Date().toISOString()
          const result: BuildResult = ios === 'failed' || android === 'failed' ? 'failed' : 'success'
          store.set('build_runs', store.get('build_runs', []).map((r) =>
            r.id === runId ? { ...r, result, iosResult: ios ?? undefined, androidResult: android ?? undefined, endedAt } : r))
          store.set('apps', store.get('apps', []).map((a) =>
            a.id === appRec.id ? { ...a, lastDeployAt: endedAt } : a))
          resolve(result)
        }
      }
    })
  })

  err(combined === 'success' ? '✓ Deploy complete' : '✗ Deploy failed')
  return done(combined === 'success' ? 0 : 1, json, { runId, result: combined })
}

async function cmdPatch(p: Parsed, json: boolean): Promise<never> {
  const ref = appRef(p)
  const appRec = ref ? findApp(ref) : undefined
  if (!appRec) { err('patch: app required — `droploid patch <id|name>`'); return done(1, json, { error: 'app_not_found' }) }
  const platform = (str(p.flags.platform) ?? 'both') as BuildPlatform
  const res = await startShorebirdPatch({
    runId: randomUUID(), appId: appRec.id, platform,
    onLine: (line) => err(line.text)
  })
  const ok = res.ios !== false && res.android !== false
  return done(ok ? 0 : 1, json, res)
}

function cmdConfigOrg(p: Parsed, json: boolean): Promise<never> | never {
  const creds: OrgCredentials = {
    iosKeyID: str(p.flags['ios-key-id']),
    iosIssuerID: str(p.flags['ios-issuer-id']),
    iosTeamID: str(p.flags['ios-team-id']),
    iosP8Path: str(p.flags['ios-p8']),
    androidJsonPath: str(p.flags['android-json'])
  }
  const writeCreds = async (id: string): Promise<void> => {
    if (creds.iosKeyID) await setCredential(id, 'ios_key_id', creds.iosKeyID)
    if (creds.iosIssuerID) await setCredential(id, 'ios_issuer_id', creds.iosIssuerID)
    if (creds.iosTeamID) await setCredential(id, 'ios_team_id', creds.iosTeamID)
    if (creds.iosP8Path) await setCredential(id, 'ios_p8_path', creds.iosP8Path)
    if (creds.androidJsonPath) await setCredential(id, 'android_json_path', creds.androidJsonPath)
  }

  const idFlag = str(p.flags.id)
  if (idFlag) {
    const org = findOrg(idFlag)
    if (!org) { err(`config-org: org not found: ${idFlag}`); return done(1, json, { error: 'org_not_found' }) }
    return writeCreds(org.id).then(() => {
      const name = str(p.flags.name)
      if (name) store.set('organisations', store.get('organisations', []).map((o) => o.id === org.id ? { ...o, name } : o))
      err(`✓ Updated org ${org.name} (${org.id})`)
      return done(0, json, { id: org.id, name: name ?? org.name })
    })
  }

  const name = str(p.flags.name)
  if (!name) { err('config-org: --name <name> required to create an org'); return done(1, json, { error: 'name_required' }) }
  const id = randomUUID()
  return writeCreds(id).then(() => {
    const org: Organisation = { id, name, createdAt: new Date().toISOString() }
    store.set('organisations', [...store.get('organisations', []), org])
    err(`✓ Created org ${name}\n  id: ${id}`)
    return done(0, json, { id, name })
  })
}

function cmdLink(p: Parsed, json: boolean): never {
  const dir = p._[0]
  const orgRef = str(p.flags.org)
  if (!dir || !orgRef) { err('link: usage: droploid link <dir> --org <id|name>'); return done(1, json, { error: 'usage' }) }
  const org = findOrg(orgRef)
  if (!org) { err(`link: org not found: ${orgRef}`); return done(1, json, { error: 'org_not_found' }) }
  const meta = detect(dir)
  const appRec: LinkedApp = {
    id: randomUUID(), organisationId: org.id, dirPath: dir, name: meta.name,
    bundleID: meta.bundleID, packageName: meta.packageName, currentVersion: meta.version,
    projectType: meta.projectType, xcodeSchemeName: meta.schemeName, iconPath: meta.iconPath,
    linkedAt: new Date().toISOString()
  }
  store.set('apps', [...store.get('apps', []), appRec])
  err(`✓ Linked ${appRec.name} (${appRec.projectType}) v${appRec.currentVersion}\n  id: ${appRec.id}`)
  return done(0, json, appRec)
}

async function cmdPreflight(p: Parsed, json: boolean): Promise<never> {
  const ref = appRef(p)
  const appRec = ref ? findApp(ref) : undefined
  if (!appRec) { err('preflight: app required — `droploid preflight <id|name>`'); return done(1, json, { error: 'app_not_found' }) }
  const platform = (str(p.flags.platform) ?? 'both') as BuildPlatform
  const checks = await runPreflight(appRec.id, appRec.organisationId, platform)
  checks.forEach((c) => err(`  ${c.passed ? '✓' : c.isBlocker ? '✗' : '⚠'} ${c.label}${c.message ? ` — ${c.message}` : ''}`))
  const blocked = checks.some((c) => !c.passed && c.isBlocker)
  return done(blocked ? 1 : 0, json, { passed: !blocked, checks })
}

// ── interactive setup (deploy.sh-style menus; no flags to memorise) ───────────
// Human-only (ignores --json). Prompts go to stdout with no trailing newline.
const C = { cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m' }
function banner(title: string): void {
  out(`\n${C.cyan}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n  ${title}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n`)
}

// Manual line reader. readline/promises loses buffered lines when a piped stream hits EOF
// between questions (hangs). This queues lines and resolves pending asks; on EOF, unanswered
// asks resolve to null → works for a live TTY *and* piped input (no hang).
function makePrompter(): { q: (prompt: string) => Promise<string | null>; close: () => void } {
  const stdin = process.stdin
  stdin.setEncoding('utf8')
  const queued: string[] = []
  const waiters: ((v: string | null) => void)[] = []
  let buf = ''
  let closed = false
  const push = (line: string): void => { const w = waiters.shift(); if (w) w(line); else queued.push(line) }
  stdin.on('data', (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) { push(buf.slice(0, nl).replace(/\r$/, '')); buf = buf.slice(nl + 1) }
  })
  stdin.on('end', () => { closed = true; if (buf.length) push(buf); buf = ''; while (waiters.length) waiters.shift()!(null) })
  stdin.resume()
  return {
    q: (prompt: string) => {
      process.stdout.write(prompt)
      if (queued.length) return Promise.resolve(queued.shift()!)
      if (closed) return Promise.resolve(null)
      return new Promise((res) => waiters.push(res))
    },
    close: () => stdin.pause()
  }
}

async function cmdSetup(): Promise<never> {
  const rl = makePrompter()
  const ask = async (label: string, def = ''): Promise<string> => {
    const a = await rl.q(`  ${label}${def ? ` ${C.dim}[${def}]${C.reset}` : ''}: `)
    return (a ?? '').trim() || def
  }
  // returns '' when skipped, null on EOF for a required field (caller aborts)
  const askPath = async (label: string, required: boolean): Promise<string | null> => {
    for (;;) {
      const raw = await rl.q(`  ${label}${required ? '' : ` ${C.dim}(Enter to skip)${C.reset}`}: `)
      if (raw === null) return required ? null : ''
      const path = raw.trim().replace(/^~/, homedir())
      if (!path) { if (!required) return ''; out(`  ${C.yellow}⚠ required${C.reset}`); continue }
      if (existsSync(path)) return path
      out(`  ${C.yellow}⚠ file not found: ${path}${C.reset}`)
    }
  }

  banner('🚀 Droploid setup')
  out('  What do you want to do?')
  out('  1) Create a profile (organisation + signing credentials)')
  out('  2) Link an app to a profile')
  out(`  3) Both — first-time setup ${C.dim}(recommended)${C.reset}\n`)
  const choice = await ask('Choose', '3')
  const doOrg = choice === '1' || choice === '3'
  const doLink = choice === '2' || choice === '3'

  let orgId: string | undefined
  let orgName: string | undefined

  if (doOrg) {
    banner('🏢 New profile')
    orgName = await ask('Profile / organisation name')
    if (!orgName) { rl.close(); err('setup: name required'); return done(1, false, {}) }

    out(`\n  ${C.bold}🍎 iOS — App Store Connect${C.reset} ${C.dim}(Enter to skip iOS)${C.reset}`)
    out(`  ${C.dim}Where: appstoreconnect.apple.com ▸ Users and Access ▸ Integrations ▸ App Store Connect API${C.reset}`)
    out(`  ${C.dim}Issuer ID sits above the keys table · Key ID is next to your key · download the .p8 once (can't re-download)${C.reset}`)
    const iosKeyID = await ask('Key ID')
    const iosIssuerID = iosKeyID ? await ask('Issuer ID (UUID)') : ''
    const iosTeamID = iosKeyID ? await ask('Apple Team ID (optional)') : ''
    const iosP8Path = iosKeyID ? (await askPath('Path to .p8 private key', false)) ?? '' : ''

    out(`\n  ${C.bold}🤖 Android — Play Store${C.reset} ${C.dim}(Enter to skip Android)${C.reset}`)
    out(`  ${C.dim}Where: console.cloud.google.com ▸ IAM & Admin ▸ Service Accounts ▸ (your account) ▸ Keys ▸ Add key ▸ JSON${C.reset}`)
    out(`  ${C.dim}Then Play Console ▸ Users and permissions / API access ▸ grant that service-account email (Admin or Release manager)${C.reset}`)
    const androidJsonPath = (await askPath('Path to service-account .json', false)) ?? ''

    orgId = randomUUID()
    if (iosKeyID) await setCredential(orgId, 'ios_key_id', iosKeyID)
    if (iosIssuerID) await setCredential(orgId, 'ios_issuer_id', iosIssuerID)
    if (iosTeamID) await setCredential(orgId, 'ios_team_id', iosTeamID)
    if (iosP8Path) await setCredential(orgId, 'ios_p8_path', iosP8Path)
    if (androidJsonPath) await setCredential(orgId, 'android_json_path', androidJsonPath)
    const org: Organisation = { id: orgId, name: orgName, createdAt: new Date().toISOString() }
    store.set('organisations', [...store.get('organisations', []), org])
    out(`\n  ${C.green}✓ Profile "${orgName}" saved${C.reset}  ${C.dim}(${orgId})${C.reset}`)
  }

  if (doLink) {
    banner('📱 Link an app')
    if (!orgId) {
      const orgs = store.get('organisations', [])
      if (!orgs.length) { rl.close(); err('setup: no profiles yet — run setup and choose option 1 or 3'); return done(1, false, {}) }
      orgs.forEach((o, i) => out(`  ${i + 1}) ${o.name}`))
      const pick = await ask('\n  Which profile', '1')
      const org = orgs[Number(pick) - 1] ?? findOrg(pick)
      if (!org) { rl.close(); err('setup: invalid profile'); return done(1, false, {}) }
      orgId = org.id; orgName = org.name
    }
    const dir = await askPath('App project folder', true)
    if (!dir) { rl.close(); err('setup: app folder required'); return done(1, false, {}) }
    const meta = detect(dir)
    const appRec: LinkedApp = {
      id: randomUUID(), organisationId: orgId, dirPath: dir, name: meta.name,
      bundleID: meta.bundleID, packageName: meta.packageName, currentVersion: meta.version,
      projectType: meta.projectType, xcodeSchemeName: meta.schemeName, iconPath: meta.iconPath,
      linkedAt: new Date().toISOString()
    }
    store.set('apps', [...store.get('apps', []), appRec])
    out(`\n  ${C.green}✓ Linked ${appRec.name}${C.reset}  ${meta.projectType} v${meta.version}  ${C.dim}(${appRec.id})${C.reset}`)
    out(`\n  ${C.bold}Next:${C.reset}  droploid deploy "${appRec.name}"`)
  }

  rl.close()
  out(`\n  ${C.green}${C.bold}Done.${C.reset} Run ${C.bold}droploid apps${C.reset} to see your apps.\n`)
  return done(0, false, { orgId, orgName })
}

export async function runCli(processArgv: string[]): Promise<void> {
  const i = processArgv.indexOf('--cli')
  const argv = i >= 0 ? processArgv.slice(i + 1) : processArgv.slice(1)
  const p = parse(argv)
  const cmd = p._.shift()
  const json = p.flags.json === true

  const wantsHelp = !cmd || cmd === 'help' || cmd === '-h' || cmd === '--help' || p.flags.help || p.flags.h
  if (wantsHelp) { err(HELP); return done(0, false, {}) }

  try {
    switch (cmd) {
      case 'orgs': {
        const orgs = store.get('organisations', [])
        orgs.forEach((o) => err(`  ${o.name}  (${o.id})`))
        if (!orgs.length) err('  (no organisations — run: droploid config-org --name <name>)')
        return done(0, json, orgs)
      }
      case 'apps': {
        const orgRef = str(p.flags.org)
        const org = orgRef ? findOrg(orgRef) : undefined
        let apps = store.get('apps', [])
        if (orgRef) { if (!org) { err(`apps: org not found: ${orgRef}`); return done(1, json, { error: 'org_not_found' }) } apps = apps.filter((a) => a.organisationId === org!.id) }
        apps.forEach((a) => err(`  ${a.name}  ${a.projectType}  v${a.currentVersion}  (${a.id})`))
        if (!apps.length) err('  (no apps — run: droploid link <dir> --org <id>)')
        return done(0, json, apps)
      }
      case 'tools': {
        const t = await checkAllTools()
        t.forEach((s) => err(`  ${s.state === 'found' ? '✓' : '✗'} ${s.name}${s.version ? `  ${s.version}` : ''}`))
        return done(t.some((s) => s.state !== 'found') ? 1 : 0, json, t)
      }
      case 'history': {
        const ref = appRef(p)
        const appRec = ref ? findApp(ref) : undefined
        if (!appRec) { err('history: app required — `droploid history <id|name>`'); return done(1, json, { error: 'app_not_found' }) }
        const runs = store.get('build_runs', []).filter((r) => r.appId === appRec.id)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 20)
        runs.forEach((r) => err(`  ${r.result.padEnd(9)} ${r.platform.padEnd(7)} v${r.version}  ${r.startedAt}`))
        if (!runs.length) err('  (no build history)')
        return done(0, json, runs)
      }
      case 'setup': return await cmdSetup()
      case 'link': return cmdLink(p, json)
      case 'config-org': return await cmdConfigOrg(p, json)
      case 'preflight': return await cmdPreflight(p, json)
      case 'deploy': return await cmdDeploy(p, json)
      case 'patch': return await cmdPatch(p, json)
      default:
        err(`Unknown command: ${cmd}\n`); err(HELP)
        return done(1, json, { error: 'unknown_command', cmd })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    err(`Error: ${msg}`)
    return done(1, json, { error: msg })
  }
}
