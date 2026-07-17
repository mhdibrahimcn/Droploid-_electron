import { useEffect, useRef } from 'react'
import type { LogLine } from '../../../../shared/types/models'

interface Props {
  lines: LogLine[]
}

const KIND_COLOR: Record<string, string> = {
  step: '#818cf8',
  output: '#7b88a8',
  error: '#f87171',
  success: '#34d399'
}

export default function TerminalPane({ lines }: Props): JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div
      className="h-full overflow-y-auto p-3 font-mono text-xs"
      style={{ background: '#05070f', color: 'var(--color-text-secondary)' }}
    >
      {lines.map((line) => (
        <div key={line.id} style={{ color: KIND_COLOR[line.kind] ?? KIND_COLOR.output }} className="leading-5 whitespace-pre-wrap break-all">
          {line.text}
        </div>
      ))}
      {lines.length === 0 && (
        <span className="text-[var(--color-text-muted)] italic">Waiting for output…</span>
      )}
      <div ref={endRef} />
    </div>
  )
}
