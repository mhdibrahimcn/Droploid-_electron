import { describe, it, expect, vi } from 'vitest'

// paths.ts imports `electron` (app.getPath) at module load — unavailable under vitest.
vi.mock('../../utils/paths', () => ({ kDroploidPATH: '/usr/local/bin' }))

import {
  shorebirdAndroidReleaseArgs,
  shorebirdIOSReleaseArgs,
  shorebirdPatchArgs,
  shorebirdEnv,
  kShorebirdPATH
} from '../shorebird'

describe('shorebirdAndroidReleaseArgs', () => {
  it('builds a patchable aab release', () => {
    const args = shorebirdAndroidReleaseArgs()
    expect(args.slice(0, 3)).toEqual(['release', '--platforms', 'android'])
    expect(args).toContain('--artifact')
    expect(args).toContain('aab')
    expect(args).toContain('--obfuscate')
    expect(args).toContain('--split-debug-info=build/debug-info')
  })

  it('pins the flutter version when provided', () => {
    expect(shorebirdAndroidReleaseArgs({ flutterVersion: '3.41.6' })).toContain('--flutter-version=3.41.6')
  })

  it('omits the flutter-version flag when unset', () => {
    expect(shorebirdAndroidReleaseArgs().some((a) => a.startsWith('--flutter-version'))).toBe(false)
  })
})

describe('shorebirdIOSReleaseArgs', () => {
  it('passes the export options plist through', () => {
    const args = shorebirdIOSReleaseArgs('/tmp/export.plist')
    expect(args.slice(0, 3)).toEqual(['release', '--platforms', 'ios'])
    expect(args).toContain('--export-options-plist')
    expect(args[args.indexOf('--export-options-plist') + 1]).toBe('/tmp/export.plist')
  })

  it('pins the flutter version before the plist flag', () => {
    const args = shorebirdIOSReleaseArgs('/tmp/e.plist', { flutterVersion: '3.41.6' })
    expect(args).toContain('--flutter-version=3.41.6')
  })
})

describe('shorebirdPatchArgs', () => {
  it('targets the latest release for the given platform', () => {
    expect(shorebirdPatchArgs('android')).toEqual(['patch', '--platforms', 'android', '--release-version=latest'])
    expect(shorebirdPatchArgs('ios')).toEqual(['patch', '--platforms', 'ios', '--release-version=latest'])
  })
})

describe('shorebirdEnv', () => {
  it('sets CI=true to skip the interactive confirm and puts shorebird on PATH', () => {
    const env = shorebirdEnv()
    expect(env.CI).toBe('true')
    expect(env.PATH).toBe(kShorebirdPATH)
    expect(kShorebirdPATH).toContain('.shorebird/bin')
  })
})
