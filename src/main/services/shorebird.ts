// Shorebird code-push integration — mirrors the `shorebird release` / `shorebird patch`
// flows from deploy.sh. Command builders are kept pure (no spawning) so they're unit-testable;
// runShorebirdPatch is the only side-effectful export.
import { spawn, ChildProcess } from 'child_process'
import { homedir } from 'os'
import { kDroploidPATH } from '../utils/paths'
import { stripAnsi } from '../utils/processRunner'

// shorebird installs to ~/.shorebird/bin — non-login shells don't have it on PATH.
export const kShorebirdPATH = `${homedir()}/.shorebird/bin:${kDroploidPATH}`

export interface ShorebirdReleaseOpts {
  // Pin Shorebird to the Flutter the project builds with locally. Shorebird otherwise
  // defaults to its newest stable, which can break packages that extend framework classes
  // (see deploy.sh note re: phosphor_flutter + IconData). Patches inherit this from the release.
  flutterVersion?: string
}

// `shorebird release --platforms android --artifact aab ...` — patchable AAB at the same
// path flutter build appbundle produces, so the upload step downstream is unchanged.
export function shorebirdAndroidReleaseArgs(opts: ShorebirdReleaseOpts = {}): string[] {
  return [
    'release',
    '--platforms',
    'android',
    ...(opts.flutterVersion ? [`--flutter-version=${opts.flutterVersion}`] : []),
    '--artifact',
    'aab',
    '--obfuscate',
    '--split-debug-info=build/debug-info'
  ]
}

// `shorebird release --platforms ios --export-options-plist <plist>` — drives flutter build ipa
// (its own pod install + archive) and signs via the provided ExportOptions.plist. IPA → build/ios/ipa.
export function shorebirdIOSReleaseArgs(exportPlistPath: string, opts: ShorebirdReleaseOpts = {}): string[] {
  return [
    'release',
    '--platforms',
    'ios',
    ...(opts.flutterVersion ? [`--flutter-version=${opts.flutterVersion}`] : []),
    '--export-options-plist',
    exportPlistPath
  ]
}

// `shorebird patch --platforms <p> --release-version=latest` — OTA patch to the most
// recently updated release. Only works on a build made with `shorebird release`.
export function shorebirdPatchArgs(platform: 'ios' | 'android'): string[] {
  return ['patch', '--platforms', platform, '--release-version=latest']
}

// CI=true skips Shorebird's interactive confirm (would hang a backgrounded/piped run).
export function shorebirdEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: kShorebirdPATH, CI: 'true' }
}

// Minimal cooperative-cancel token. ActiveBuild in buildEngine is structurally compatible,
// so it can be passed straight through — the spawned child is registered synchronously so
// cancelBuild can kill it mid-run.
export interface CancelToken {
  cancelled: boolean
  children: ChildProcess[]
}

// Run an OTA patch, streaming stripped log lines. Resolves with the exit code
// (99 if cancelled via token.cancelled). Standalone flow — no store upload.
export function runShorebirdPatch(
  platform: 'ios' | 'android',
  cwd: string,
  onLine: (line: string) => void,
  token?: CancelToken
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('shorebird', shorebirdPatchArgs(platform), {
      cwd,
      env: shorebirdEnv(),
      stdio: 'pipe',
      shell: false
    })
    token?.children.push(child)
    let buf = ''
    const flush = (chunk: Buffer): void => {
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
      resolve(token?.cancelled ? 99 : (code ?? 1))
    })
    child.on('error', (e) => {
      onLine(`Error: ${e.message}`)
      resolve(1)
    })
  })
}
