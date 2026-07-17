import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock all side-effectful imports before importing buildEngine
vi.mock('../store', () => ({ store: { get: vi.fn(() => []), set: vi.fn() } }))
vi.mock('../keychain', () => ({ getCredential: vi.fn(() => Promise.resolve('')) }))
vi.mock('../versionBumper', () => ({ bump: vi.fn((v: string) => v), writeToPubspec: vi.fn() }))
vi.mock('../../utils/paths', () => ({
  kDroploidPATH: '/usr/local/bin',
  kRubyPATH: '/usr/local/bin',
  kArchiveCacheDir: '/tmp/droploid-test',
  kLogsDir: '/tmp/droploid-logs',
}))

import { getInitialCheckpoints } from '../buildEngine'

describe('getInitialCheckpoints', () => {
  it('ios platform → 6 ios checkpoints', () => {
    const cps = getInitialCheckpoints('ios')
    expect(cps).toHaveLength(6)
    expect(cps.every((c) => c.platform === 'ios')).toBe(true)
    expect(cps.every((c) => c.state === 'pending')).toBe(true)
  })

  it('android platform → 2 android checkpoints', () => {
    const cps = getInitialCheckpoints('android')
    expect(cps).toHaveLength(2)
    expect(cps.every((c) => c.platform === 'android')).toBe(true)
  })

  it('both → 6 ios + 2 android', () => {
    const cps = getInitialCheckpoints('both')
    expect(cps).toHaveLength(8)
    expect(cps.filter((c) => c.platform === 'ios')).toHaveLength(6)
    expect(cps.filter((c) => c.platform === 'android')).toHaveLength(2)
  })

  it('each checkpoint has a unique id', () => {
    const cps = getInitialCheckpoints('both')
    const ids = new Set(cps.map((c) => c.id))
    expect(ids.size).toBe(cps.length)
  })

  it('checkpoint labels match expected steps', () => {
    const cps = getInitialCheckpoints('ios')
    const labels = cps.map((c) => c.label)
    expect(labels).toContain('Flutter build iOS')
    expect(labels).toContain('Upload to App Store')
  })

  it('shorebird ios → 3 collapsed checkpoints (release + validate + upload)', () => {
    const cps = getInitialCheckpoints('ios', true)
    expect(cps.map((c) => c.label)).toEqual(['Shorebird release iOS', 'Validate IPA', 'Upload to App Store'])
  })

  it('shorebird android → release label swapped, upload kept', () => {
    const cps = getInitialCheckpoints('android', true)
    expect(cps.map((c) => c.label)).toEqual(['Shorebird release appbundle', 'Upload via fastlane'])
  })

  it('shorebird both → 3 ios + 2 android', () => {
    const cps = getInitialCheckpoints('both', true)
    expect(cps.filter((c) => c.platform === 'ios')).toHaveLength(3)
    expect(cps.filter((c) => c.platform === 'android')).toHaveLength(2)
  })

  it('defaults to the non-shorebird step set (backward compatible)', () => {
    expect(getInitialCheckpoints('ios')).toHaveLength(6)
  })
})
