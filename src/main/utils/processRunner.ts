import { spawn, SpawnOptions } from 'child_process'
import { kDroploidPATH } from './paths'

export interface RunOptions {
  cwd?: string
  env?: Record<string, string>
  useRubyPath?: boolean
  onLine?: (line: string) => void
}

export interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

// strips common ANSI escape codes
export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '').replace(/\x1B\][^\x07]*\x07/g, '')
}

export async function runCommand(
  cmd: string,
  args: string[],
  opts: RunOptions = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: opts.useRubyPath
        ? `${opts.env?.PATH ?? kDroploidPATH}`
        : kDroploidPATH,
      ...(opts.env ?? {})
    }

    const spawnOpts: SpawnOptions = {
      cwd: opts.cwd,
      env,
      shell: false
    }

    const child = spawn(cmd, args, spawnOpts)
    let stdout = ''
    let stderr = ''
    let buffer = ''

    const processChunk = (chunk: Buffer, isStderr: boolean): void => {
      const text = chunk.toString('utf8')
      if (isStderr) stderr += text
      else stdout += text

      buffer += text
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const clean = stripAnsi(line.trimEnd())
        if (clean && opts.onLine) opts.onLine(clean)
      }
    }

    child.stdout?.on('data', (chunk) => processChunk(chunk, false))
    child.stderr?.on('data', (chunk) => processChunk(chunk, true))

    child.on('error', reject)
    child.on('close', (code) => {
      if (buffer.trim() && opts.onLine) opts.onLine(stripAnsi(buffer.trim()))
      resolve({ exitCode: code ?? 1, stdout, stderr })
    })
  })
}

export async function which(name: string): Promise<string | null> {
  try {
    const result = await runCommand('/usr/bin/which', [name])
    return result.exitCode === 0 ? result.stdout.trim() : null
  } catch {
    return null
  }
}
