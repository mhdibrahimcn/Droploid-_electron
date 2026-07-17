import { describe, it, expect } from 'vitest'
import { bump } from '../version'

describe('renderer bump()', () => {
  const base = '2.1.5+8'

  it('none — unchanged', () => expect(bump(base, 'none')).toBe(base))
  it('buildOnly — only build increments', () => expect(bump(base, 'buildOnly')).toBe('2.1.5+9'))
  it('patch — patch + build increment', () => expect(bump(base, 'patch')).toBe('2.1.6+9'))
  it('minor — minor increments, patch resets', () => expect(bump(base, 'minor')).toBe('2.2.0+9'))
  it('major — major increments, minor+patch reset', () => expect(bump(base, 'major')).toBe('3.0.0+9'))

  it('handles version without build number', () => {
    expect(bump('1.0.0', 'buildOnly')).toBe('1.0.0+2')
  })

  it('handles version 0.0.1+1', () => {
    expect(bump('0.0.1+1', 'patch')).toBe('0.0.2+2')
    expect(bump('0.0.1+1', 'major')).toBe('1.0.0+2')
  })
})
