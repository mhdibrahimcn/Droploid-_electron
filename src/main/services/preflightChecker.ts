import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { kDroploidPATH } from '../utils/paths'
import type { PreflightCheck, BuildPlatform } from '../../shared/types/models'
import { store } from './store'
import { getCredential } from './keychain'

function freeDiskGB(): number {
  try {
    const result = spawnSync('/bin/df', ['-k', '/'], { encoding: 'utf8' })
    const line = result.stdout.split('\n')[1]
    const cols = line.trim().split(/\s+/)
    const available = parseInt(cols[3], 10)
    return available / (1024 * 1024)
  } catch {
    return 999
  }
}

function toolExists(name: string): boolean {
  const result = spawnSync('/usr/bin/which', [name], {
    env: { ...process.env, PATH: kDroploidPATH },
    stdio: 'pipe'
  })
  return result.status === 0
}

export async function runPreflight(
  appId: string,
  orgId: string,
  platform: BuildPlatform
): Promise<PreflightCheck[]> {
  const checks: PreflightCheck[] = []
  const apps = store.get('apps', [])
  const app = apps.find((a) => a.id === appId)
  if (!app) return checks

  const diskGB = freeDiskGB()
  checks.push({
    id: 'disk_blocker',
    label: 'Free disk space ≥ 1 GB',
    passed: diskGB >= 1,
    isBlocker: true,
    message: diskGB < 1 ? `Only ${diskGB.toFixed(1)} GB free` : undefined
  })
  checks.push({
    id: 'disk_warning',
    label: 'Free disk space ≥ 2 GB',
    passed: diskGB >= 2,
    isBlocker: false,
    message: diskGB < 2 ? `${diskGB.toFixed(1)} GB free — builds may fail` : undefined
  })

  const iosNeeded = platform === 'ios' || platform === 'both'
  const androidNeeded = platform === 'android' || platform === 'both'

  if (iosNeeded) {
    const keyID = await getCredential(orgId, 'ios_key_id')
    const issuerID = await getCredential(orgId, 'ios_issuer_id')
    const teamID = await getCredential(orgId, 'ios_team_id')
    const p8Path = await getCredential(orgId, 'ios_p8_path')

    checks.push({ id: 'ios_key_id', label: 'iOS Key ID set', passed: !!keyID, isBlocker: true })
    checks.push({ id: 'ios_issuer_id', label: 'iOS Issuer ID set', passed: !!issuerID, isBlocker: true })
    checks.push({ id: 'ios_team_id', label: 'iOS Team ID set', passed: !!teamID, isBlocker: true })
    checks.push({
      id: 'ios_p8',
      label: '.p8 key file exists',
      passed: !!p8Path && existsSync(p8Path),
      isBlocker: true,
      message: p8Path && !existsSync(p8Path) ? 'File not found at saved path' : undefined
    })
    checks.push({ id: 'ios_bundle_id', label: 'Bundle ID detected', passed: !!app.bundleID, isBlocker: true })
    checks.push({ id: 'tool_xcodebuild', label: 'xcodebuild available', passed: existsSync('/usr/bin/xcodebuild'), isBlocker: true })
    checks.push({ id: 'tool_flutter_ios', label: 'flutter available', passed: toolExists('flutter'), isBlocker: app.projectType === 'flutter' })
    checks.push({ id: 'tool_pod', label: 'CocoaPods available', passed: toolExists('pod'), isBlocker: app.projectType === 'flutter' })
  }

  if (androidNeeded) {
    const jsonPath = await getCredential(orgId, 'android_json_path')
    checks.push({
      id: 'android_json',
      label: 'Android service account JSON exists',
      passed: !!jsonPath && existsSync(jsonPath),
      isBlocker: true,
      message: jsonPath && !existsSync(jsonPath) ? 'File not found at saved path' : undefined
    })
    checks.push({ id: 'android_package', label: 'Package name detected', passed: !!app.packageName, isBlocker: true })
    checks.push({ id: 'tool_fastlane', label: 'fastlane available', passed: toolExists('fastlane'), isBlocker: true })
    checks.push({ id: 'tool_flutter_android', label: 'flutter available', passed: toolExists('flutter'), isBlocker: app.projectType === 'flutter' })
  }

  return checks
}
