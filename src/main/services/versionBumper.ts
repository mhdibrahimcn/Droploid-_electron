import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { BumpKind } from '../../shared/types/models'

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  build: number
}

export function parseVersion(version: string): ParsedVersion {
  const [semver, buildStr] = version.split('+')
  const parts = (semver || '1.0.0').split('.').map(Number)
  return {
    major: parts[0] ?? 1,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    build: parseInt(buildStr ?? '1', 10) || 1
  }
}

export function formatVersion(v: ParsedVersion): string {
  return `${v.major}.${v.minor}.${v.patch}+${v.build}`
}

export function bump(current: string, kind: BumpKind): string {
  const v = parseVersion(current)
  switch (kind) {
    case 'none':
      return current
    case 'buildOnly':
      return formatVersion({ ...v, build: v.build + 1 })
    case 'patch':
      return formatVersion({ ...v, patch: v.patch + 1, build: v.build + 1 })
    case 'minor':
      return formatVersion({ ...v, minor: v.minor + 1, patch: 0, build: v.build + 1 })
    case 'major':
      return formatVersion({ major: v.major + 1, minor: 0, patch: 0, build: v.build + 1 })
  }
}

export function writeToPubspec(dirPath: string, newVersion: string): void {
  const yamlPath = join(dirPath, 'pubspec.yaml')
  const content = readFileSync(yamlPath, 'utf8')
  const updated = content.replace(/^version:\s*.+$/m, `version: ${newVersion}`)
  writeFileSync(yamlPath, updated, 'utf8')
}
