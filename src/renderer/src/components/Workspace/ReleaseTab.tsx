import { motion } from 'framer-motion'
import { useBuildStore } from '../../stores/buildStore'
import { useUIStore } from '../../stores/uiStore'
import { ResultBadge } from './OverviewTab'
import TerminalPane from '../TerminalPane'
import type { LinkedApp, BuildCheckpoint } from '../../../../shared/types/models'
import { Check, X, Loader2, ArrowUpDown, Zap } from 'lucide-react'

export default function ReleaseTab({ app }: { app: LinkedApp }): JSX.Element {
  const { isRunning, checkpoints, iosLogs, androidLogs, iosResult, androidResult } = useBuildStore()
  const { setDeployPanel, setPromoteSheet } = useUIStore()

  if (!isRunning && !iosResult && !androidResult) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex flex-col items-center justify-center h-full gap-5 px-8"
      >
        {/* Floating icon */}
        <div className="float relative">
          <div className="absolute inset-0 bg-indigo-500/15 blur-2xl rounded-3xl" />
          <div className="w-16 h-16 rounded-2xl glass-sm flex items-center justify-center relative z-10"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(99,102,241,0.15)' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-bright)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
              <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M15 12v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <p className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">No active deployment</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">Start a deploy or promote a release to a new track</p>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(99,102,241,0.45)' }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            onClick={() => setDeployPanel(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-bold text-white relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <Zap size={13} strokeWidth={2.5} fill="currentColor" className="relative z-10" />
            <span className="relative z-10">Deploy</span>
          </motion.button>

          {(app.projectType === 'flutter' || app.projectType === 'nativeAndroid') && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPromoteSheet(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[12px] font-semibold text-[var(--color-text-secondary)] glass-xs hover:text-[var(--color-text-primary)] border border-[var(--color-border)] transition-all"
            >
              <ArrowUpDown size={13} strokeWidth={2} />
              Promote
            </motion.button>
          )}
        </div>
      </motion.div>
    )
  }

  const iosCps     = checkpoints.filter((c) => c.platform === 'ios')
  const androidCps = checkpoints.filter((c) => c.platform === 'android')
  const doneCount  = checkpoints.filter((c) => c.state === 'done' || c.state === 'failed').length
  const progress   = checkpoints.length > 0 ? doneCount / checkpoints.length : 0
  const overallFailed = iosResult === 'failed' || androidResult === 'failed'
  const barColor   = isRunning ? '#6366f1' : overallFailed ? '#f87171' : '#34d399'

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="h-0.5 flex-shrink-0 relative overflow-hidden bg-[var(--color-border-subtle)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="h-full absolute left-0 top-0 rounded-full"
          style={{ background: barColor, boxShadow: `0 0 8px ${barColor}60` }}
        />
        {isRunning && (
          <motion.div
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            className="absolute top-0 bottom-0 w-1/4"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }}
          />
        )}
      </div>

      <div className="flex flex-1 overflow-hidden divide-x divide-[var(--color-border)]">
        {iosCps.length > 0 && (
          <BuildPane title="iOS" checkpoints={iosCps} logs={iosLogs} result={iosResult} />
        )}
        {androidCps.length > 0 && (
          <BuildPane title="Android" checkpoints={androidCps} logs={androidLogs} result={androidResult} />
        )}
      </div>
    </div>
  )
}

function BuildPane({ title, checkpoints, logs, result }: {
  title: string
  checkpoints: BuildCheckpoint[]
  logs: import('../../../../shared/types/models').LogLine[]
  result: import('../../../../shared/types/models').BuildResult | null
}): JSX.Element {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-[var(--color-border)]">
        <span className="text-[12px] font-bold text-[var(--color-text-primary)] tracking-wide">{title}</span>
        {result && <ResultBadge result={result} />}
      </div>

      {/* Checkpoint timeline */}
      <div className="px-4 pt-3.5 pb-2 flex-shrink-0 border-b border-[var(--color-border)]">
        {checkpoints.map((cp, i) => (
          <motion.div
            key={cp.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
            className="flex items-start gap-2.5 relative"
          >
            <div className="flex flex-col items-center flex-shrink-0">
              <CheckpointIcon state={cp.state} />
              {i < checkpoints.length - 1 && (
                <div
                  className="w-px transition-colors duration-500"
                  style={{
                    height: 14,
                    marginTop: 2,
                    marginBottom: 2,
                    background: cp.state === 'done'
                      ? '#34d399'
                      : cp.state === 'failed'
                      ? '#f87171'
                      : 'var(--color-border)',
                  }}
                />
              )}
            </div>
            <span
              className={`text-[11px] pt-0.5 pb-3 leading-none font-medium ${
                cp.state === 'running' ? 'text-[var(--color-text-primary)]'
                : cp.state === 'done'   ? 'text-[var(--color-text-muted)]'
                : cp.state === 'failed' ? 'text-red-400'
                : 'text-[var(--color-text-muted)] opacity-50'
              }`}
            >
              {cp.label}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <TerminalPane lines={logs} />
      </div>
    </div>
  )
}

function CheckpointIcon({ state }: { state: BuildCheckpoint['state'] }): JSX.Element {
  if (state === 'done') {
    return (
      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
        <Check size={8} color="#34d399" strokeWidth={3} />
      </div>
    )
  }
  if (state === 'running') {
    return <Loader2 size={15} className="text-[var(--color-accent-bright)] animate-spin flex-shrink-0" />
  }
  if (state === 'failed') {
    return (
      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
        <X size={8} color="#f87171" strokeWidth={3} />
      </div>
    )
  }
  return (
    <div className="w-4 h-4 rounded-full flex-shrink-0"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-border-subtle)' }} />
  )
}
