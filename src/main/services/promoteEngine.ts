import { spawn } from 'child_process'
import { kDroploidPATH } from '../utils/paths'
import { stripAnsi } from '../utils/processRunner'

export async function promoteRelease(params: {
  packageName: string
  jsonKeyPath: string
  fromTrack: string
  toTrack: string
  onLine: (line: string) => void
}): Promise<void> {
  const { packageName, jsonKeyPath, fromTrack, toTrack, onLine } = params

  return new Promise((resolve, reject) => {
    const args = [
      'supply',
      '--track', fromTrack,
      '--track_promote_to', toTrack,
      '--package_name', packageName,
      '--json_key', jsonKeyPath,
      '--skip_upload_metadata',
      '--skip_upload_changelogs',
      '--skip_upload_images',
      '--skip_upload_screenshots'
    ]

    const child = spawn('fastlane', args, {
      env: { ...process.env, PATH: kDroploidPATH },
      stdio: 'pipe',
      shell: false
    })

    let buf = ''
    const flush = (chunk: Buffer) => {
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
      if (code === 0) resolve()
      else reject(new Error(`fastlane supply exited with code ${code}`))
    })
    child.on('error', reject)
  })
}
