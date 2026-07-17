import { describe, it, expect, vi } from 'vitest'

vi.mock('../paths', () => ({
  kDroploidPATH: '/usr/local/bin',
  kRubyPATH: '/usr/local/bin',
  kArchiveCacheDir: '/tmp',
  kLogsDir: '/tmp',
  kUserDataDir: '/tmp',
  kOrgPhotosDir: '/tmp',
}))

import { stripAnsi } from '../processRunner'

describe('stripAnsi', () => {
  it('strips color codes', () => {
    expect(stripAnsi('\x1B[32mGreen text\x1B[0m')).toBe('Green text')
  })

  it('strips cursor movement codes', () => {
    expect(stripAnsi('\x1B[2Khello')).toBe('hello')
  })

  it('strips OSC sequences (terminal title)', () => {
    expect(stripAnsi('\x1B]0;My Title\x07plain')).toBe('plain')
  })

  it('leaves plain strings unchanged', () => {
    expect(stripAnsi('no escape codes here')).toBe('no escape codes here')
  })

  it('strips multiple codes in one string', () => {
    const raw = '\x1B[1m\x1B[33mWARN\x1B[0m something happened'
    expect(stripAnsi(raw)).toBe('WARN something happened')
  })

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('')
  })
})
