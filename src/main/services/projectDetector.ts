import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, basename, extname } from 'path'
import type { DetectedMetadata, ProjectType } from '../../shared/types/models'

function readFileSafe(p: string): string | null {
  try { return readFileSync(p, 'utf8') } catch { return null }
}

function detectProjectType(dir: string): ProjectType {
  if (existsSync(join(dir, 'pubspec.yaml'))) return 'flutter'
  const entries = readdirSync(dir).filter((e) => e.endsWith('.xcodeproj'))
  if (entries.length > 0) return 'nativeIOS'
  const gradle = join(dir, 'app', 'build.gradle')
  const gradleKts = join(dir, 'app', 'build.gradle.kts')
  if (existsSync(gradle) || existsSync(gradleKts)) return 'nativeAndroid'
  return 'flutter'
}

function extractFlutterVersion(dir: string): string {
  const yaml = readFileSafe(join(dir, 'pubspec.yaml'))
  if (!yaml) return '1.0.0+1'
  const m = yaml.match(/^version:\s*(.+)/m)
  return m ? m[1].trim() : '1.0.0+1'
}

function extractFlutterName(dir: string): string {
  const yaml = readFileSafe(join(dir, 'pubspec.yaml'))
  if (!yaml) return basename(dir)
  const m = yaml.match(/^name:\s*(.+)/m)
  return m ? m[1].trim() : basename(dir)
}

function extractBundleID(dir: string, type: ProjectType): string | undefined {
  let pbxPath: string
  if (type === 'flutter') {
    pbxPath = join(dir, 'ios', 'Runner.xcodeproj', 'project.pbxproj')
  } else {
    const xcodeproj = readdirSync(dir).find((e) => e.endsWith('.xcodeproj'))
    if (!xcodeproj) return undefined
    pbxPath = join(dir, xcodeproj, 'project.pbxproj')
  }
  const content = readFileSafe(pbxPath)
  if (!content) return undefined
  const m = content.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/)
  return m ? m[1].trim() : undefined
}

function extractMarketingVersion(dir: string, type: ProjectType): string | undefined {
  let pbxPath: string
  if (type === 'flutter') {
    pbxPath = join(dir, 'ios', 'Runner.xcodeproj', 'project.pbxproj')
  } else {
    const xcodeproj = readdirSync(dir).find((e) => e.endsWith('.xcodeproj'))
    if (!xcodeproj) return undefined
    pbxPath = join(dir, xcodeproj, 'project.pbxproj')
  }
  const content = readFileSafe(pbxPath)
  if (!content) return undefined
  const m = content.match(/MARKETING_VERSION\s*=\s*([^;]+);/)
  return m ? m[1].trim() : undefined
}

function extractPackageName(dir: string): string | undefined {
  const paths = [
    join(dir, 'android', 'app', 'build.gradle.kts'),
    join(dir, 'android', 'app', 'build.gradle'),
    join(dir, 'app', 'build.gradle.kts'),
    join(dir, 'app', 'build.gradle')
  ]
  for (const p of paths) {
    const content = readFileSafe(p)
    if (!content) continue
    const m = content.match(/applicationId\s*[=:]\s*["']([^"']+)["']/)
    if (m) return m[1].trim()
  }
  return undefined
}

function extractSchemeName(dir: string, type: ProjectType): string | undefined {
  let schemesDir: string
  if (type === 'flutter') {
    schemesDir = join(dir, 'ios', 'Runner.xcodeproj', 'xcshareddata', 'xcschemes')
  } else {
    const xcodeproj = readdirSync(dir).find((e) => e.endsWith('.xcodeproj'))
    if (!xcodeproj) return undefined
    schemesDir = join(dir, xcodeproj, 'xcshareddata', 'xcschemes')
  }
  try {
    const schemes = readdirSync(schemesDir).filter((e) => e.endsWith('.xcscheme'))
    return schemes.length > 0 ? schemes[0].replace('.xcscheme', '') : undefined
  } catch {
    return undefined
  }
}

function resolveAppIcon(dir: string, type: ProjectType): string | undefined {
  const candidates: string[] = []

  if (type === 'flutter' || type === 'nativeIOS') {
    const iconsetBase =
      type === 'flutter'
        ? join(dir, 'ios', 'Runner', 'Assets.xcassets', 'AppIcon.appiconset')
        : (() => {
            const xcodeproj = readdirSync(dir).find((e) => e.endsWith('.xcodeproj'))
            return xcodeproj
              ? join(dir, basename(xcodeproj, '.xcodeproj'), 'Assets.xcassets', 'AppIcon.appiconset')
              : ''
          })()

    if (iconsetBase && existsSync(iconsetBase)) {
      const icons = readdirSync(iconsetBase).filter((f) => f.endsWith('.png'))
      const preferred = icons.find((f) => f.includes('1024'))
      if (preferred) candidates.push(join(iconsetBase, preferred))
      if (icons.length > 0) candidates.push(join(iconsetBase, icons[0]))
    }
  }

  if (type === 'flutter' || type === 'nativeAndroid') {
    const densities = ['mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi', 'mipmap-hdpi', 'mipmap-mdpi']
    const resBase = type === 'flutter'
      ? join(dir, 'android', 'app', 'src', 'main', 'res')
      : join(dir, 'app', 'src', 'main', 'res')

    for (const density of densities) {
      for (const name of ['ic_launcher_round.png', 'ic_launcher.png']) {
        const p = join(resBase, density, name)
        if (existsSync(p)) { candidates.push(p); break }
      }
      if (candidates.length > 0) break
    }
  }

  return candidates.find((c) => existsSync(c))
}

export function detect(dir: string): DetectedMetadata {
  const type = detectProjectType(dir)

  let name = basename(dir)
  let version = '1.0.0+1'

  if (type === 'flutter') {
    name = extractFlutterName(dir)
    version = extractFlutterVersion(dir)
  } else if (type === 'nativeIOS') {
    const mv = extractMarketingVersion(dir, type)
    if (mv) version = mv
  }

  return {
    name,
    version,
    projectType: type,
    bundleID: (type === 'flutter' || type === 'nativeIOS') ? extractBundleID(dir, type) : undefined,
    packageName: (type === 'flutter' || type === 'nativeAndroid') ? extractPackageName(dir) : undefined,
    schemeName: (type === 'flutter' || type === 'nativeIOS') ? extractSchemeName(dir, type) : undefined,
    iconPath: resolveAppIcon(dir, type)
  }
}
