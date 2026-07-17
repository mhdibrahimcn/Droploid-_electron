import type { BumpKind } from '../../../shared/types/models'

function parse(v: string): { major: number; minor: number; patch: number; build: number } {
  const [semver, buildStr] = v.split('+')
  const parts = (semver || '1.0.0').split('.').map(Number)
  return { major: parts[0] ?? 1, minor: parts[1] ?? 0, patch: parts[2] ?? 0, build: parseInt(buildStr ?? '1', 10) || 1 }
}

export function bump(current: string, kind: BumpKind): string {
  const v = parse(current)
  switch (kind) {
    case 'none': return current
    case 'buildOnly': return `${v.major}.${v.minor}.${v.patch}+${v.build + 1}`
    case 'patch': return `${v.major}.${v.minor}.${v.patch + 1}+${v.build + 1}`
    case 'minor': return `${v.major}.${v.minor + 1}.0+${v.build + 1}`
    case 'major': return `${v.major + 1}.0.0+${v.build + 1}`
  }
}
