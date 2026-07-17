import { spawnSync, spawn } from 'child_process'
import { homedir } from 'os'
import { kDroploidPATH, kRubyPATH } from '../utils/paths'
import type { ToolName, ToolStatus } from '../../shared/types/models'

const TOOL_DEFS: Record<ToolName, { cmd: string; args: string[]; versionArgs: string[]; installCmd?: string[]; rubyEnv?: boolean }> = {
  homebrew: {
    cmd: '/opt/homebrew/bin/brew',
    args: ['--version'],
    versionArgs: ['--version']
  },
  ruby: {
    cmd: 'ruby',
    args: ['--version'],
    versionArgs: ['--version'],
    installCmd: ['brew', 'install', 'ruby']
  },
  fastlane: {
    cmd: 'fastlane',
    args: ['--version'],
    versionArgs: ['--version'],
    installCmd: ['brew', 'install', 'fastlane'],
    rubyEnv: true
  },
  python3: {
    cmd: 'python3',
    args: ['--version'],
    versionArgs: ['--version'],
    installCmd: ['brew', 'install', 'python3']
  },
  googleApi: {
    cmd: 'python3',
    args: ['-c', 'import googleapiclient; print("installed")'],
    versionArgs: ['-c', 'import googleapiclient; print("installed")'],
    installCmd: ['python3', '-m', 'pip', 'install', '--upgrade', 'google-api-python-client', 'google-auth']
  },
  cocoapods: {
    cmd: 'pod',
    args: ['--version'],
    versionArgs: ['--version'],
    installCmd: ['brew', 'install', 'cocoapods'],
    rubyEnv: true
  },
  flutter: {
    cmd: 'flutter',
    args: ['--version', '--machine'],
    versionArgs: ['--version', '--machine']
  },
  xcode: {
    cmd: '/usr/bin/xcode-select',
    args: ['--print-path'],
    versionArgs: ['--print-path']
  },
  shorebird: {
    // shorebird installs to ~/.shorebird/bin; checkTool uses kDroploidPATH which omits it,
    // so call the absolute path. Optional tool — only needed for code-push builds/patches.
    cmd: `${homedir()}/.shorebird/bin/shorebird`,
    args: ['--version'],
    versionArgs: ['--version'],
    installCmd: ['bash', '-c', "curl --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash"]
  }
}

function toolEnv(rubyEnv?: boolean): NodeJS.ProcessEnv {
  return { ...process.env, PATH: rubyEnv ? kRubyPATH : kDroploidPATH }
}

function extractVersion(output: string, name: ToolName): string {
  const first = output.split('\n')[0].trim()
  if (name === 'flutter') {
    try {
      const json = JSON.parse(output)
      return json.flutterVersion ?? first
    } catch {
      return first
    }
  }
  if (name === 'googleApi') return 'installed'
  const m = first.match(/[\d]+\.[\d]+\.?[\d]*/)
  return m ? m[0] : first.slice(0, 40)
}

export async function checkTool(name: ToolName): Promise<ToolStatus> {
  const def = TOOL_DEFS[name]
  return new Promise((resolve) => {
    const child = spawn(def.cmd, def.versionArgs, {
      env: toolEnv(def.rubyEnv),
      stdio: 'pipe',
      shell: false
    })
    let out = ''
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.stderr?.on('data', (d) => { out += d.toString() })
    child.on('close', (code) => {
      if (code === 0 && out.trim()) {
        resolve({ name, state: 'found', version: extractVersion(out, name) })
      } else {
        resolve({ name, state: 'missing' })
      }
    })
    child.on('error', () => resolve({ name, state: 'missing' }))
  })
}

export async function checkAllTools(): Promise<ToolStatus[]> {
  return Promise.all((Object.keys(TOOL_DEFS) as ToolName[]).map(checkTool))
}

export async function installTool(
  name: ToolName,
  onLine?: (line: string) => void
): Promise<boolean> {
  const def = TOOL_DEFS[name]
  if (!def.installCmd) return false

  return new Promise((resolve) => {
    const [cmd, ...args] = def.installCmd!
    const child = spawn(cmd, args, {
      env: toolEnv(def.rubyEnv),
      stdio: 'pipe',
      shell: false
    })
    let buf = ''
    const flush = (chunk: Buffer) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      lines.forEach((l) => onLine?.(l.trim()))
    }
    child.stdout?.on('data', flush)
    child.stderr?.on('data', flush)
    child.on('close', (code) => {
      if (buf.trim()) onLine?.(buf.trim())
      resolve(code === 0)
    })
    child.on('error', () => resolve(false))
  })
}
