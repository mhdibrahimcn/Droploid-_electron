import { describe, it, expect } from 'vitest'
import { parseVersion, formatVersion, bump } from '../versionBumper'

describe('parseVersion', () => {
  it('parses full semver+build', () => {
    expect(parseVersion('1.2.3+45')).toEqual({ major: 1, minor: 2, patch: 3, build: 45 })
  })
  it('falls back to defaults on empty string', () => {
    expect(parseVersion('')).toEqual({ major: 1, minor: 0, patch: 0, build: 1 })
  })
  it('handles missing build number', () => {
    const v = parseVersion('2.0.0')
    expect(v.build).toBe(1)
  })
})

describe('formatVersion', () => {
  it('formats correctly', () => {
    expect(formatVersion({ major: 1, minor: 2, patch: 3, build: 10 })).toBe('1.2.3+10')
  })
})

describe('bump', () => {
  const base = '1.2.3+10'

  it('none — returns same string', () => {
    expect(bump(base, 'none')).toBe(base)
  })

  it('buildOnly — increments build only', () => {
    expect(bump(base, 'buildOnly')).toBe('1.2.3+11')
  })

  it('patch — increments patch + build, keeps minor/major', () => {
    expect(bump(base, 'patch')).toBe('1.2.4+11')
  })

  it('minor — increments minor + build, resets patch', () => {
    expect(bump(base, 'minor')).toBe('1.3.0+11')
  })

  it('major — increments major + build, resets minor+patch', () => {
    expect(bump(base, 'major')).toBe('2.0.0+11')
  })

  it('handles version without build number', () => {
    expect(bump('1.0.0', 'buildOnly')).toBe('1.0.0+2')
  })
})
