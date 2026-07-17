import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useBuildStore } from '../../stores/buildStore'
import { timeAgo, formatDuration } from '../../lib/utils'
import { ResultBadge } from './OverviewTab'
import { ClipboardList } from 'lucide-react'

const RESULT_COLOR: Record<string, string> = {
  success:   '#34d399',
  failed:    '#f87171',
  running:   '#818cf8',
  cancelled: '#4a5268',
}

export default function HistoryTab({ appId }: { appId: string }): JSX.Element {
  const { history, historyLoading, loadHistory } = useBuildStore()
  useEffect(() => { loadHistory(appId) }, [appId])

  if (historyLoading) {
    return (
      <div className="p-6 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.06 }}
            className="h-14 rounded-2xl shimmer-block"
          />
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex flex-col items-center justify-center h-full min-h-48 gap-3.5 px-8"
      >
        <div className="float w-14 h-14 rounded-2xl glass-sm flex items-center justify-center">
          <ClipboardList size={20} strokeWidth={1.5} className="text-[var(--color-text-muted)]" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[14px] font-bold text-[var(--color-text-primary)] tracking-tight">No build history</p>
          <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
            Deploys you run will appear here with version, platform and duration.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-2 hide-scrollbar">
      {history.map((run, i) => (
        <motion.div
          key={run.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.045, duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="glass-xs border border-[var(--color-border)] rounded-2xl px-4 py-3.5 flex items-center gap-4 hover:bg-[var(--color-border)] transition-colors group relative overflow-hidden cursor-default"
        >
          {/* Left color accent */}
          <div
            className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full opacity-60 group-hover:opacity-100 transition-opacity"
            style={{ background: RESULT_COLOR[run.result] ?? RESULT_COLOR.cancelled }}
          />

          {/* Result badge */}
          <div className="flex-shrink-0">
            <ResultBadge result={run.result} />
          </div>

          {/* Version + platform */}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-mono text-[12px] font-semibold text-[var(--color-text-primary)]">
              v{run.version}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] capitalize mt-0.5">
              {run.platform}
              {run.track && <span className="ml-1.5 opacity-70">· {run.track}</span>}
            </span>
          </div>

          {/* Duration */}
          <div className="flex-shrink-0 text-right hidden sm:block">
            {run.durationSeconds ? (
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] glass-xs px-2 py-1 rounded-lg border border-[var(--color-border)]">
                {formatDuration(run.durationSeconds)}
              </span>
            ) : (
              <span className="text-[11px] text-[var(--color-text-muted)]">—</span>
            )}
          </div>

          {/* Time ago */}
          <div className="flex-shrink-0 text-right min-w-[70px]">
            <span className="text-[11px] text-[var(--color-text-muted)]">{timeAgo(run.startedAt)}</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
