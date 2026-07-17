import { motion } from 'framer-motion'
import { Copy, FolderOpen, Clock, TrendingUp } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { timeAgo, formatDuration } from '../../lib/utils'
import { useBuildStore } from '../../stores/buildStore'
import { useOrgStore } from '../../stores/orgStore'
import { useEffect } from 'react'
import type { LinkedApp } from '../../../../shared/types/models'
import StoreStatusSection from './StoreStatusSection'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] as const } },
}

export default function OverviewTab({ app }: { app: LinkedApp }): JSX.Element {
  const { history, loadHistory } = useBuildStore()
  const { selectedOrgId } = useOrgStore()
  useEffect(() => { loadHistory(app.id) }, [app.id])

  const lastRun = history[0] ?? null
  const successCount = history.filter((r) => r.result === 'success').length
  const successRate = history.length > 0 ? Math.round((successCount / history.length) * 100) : null

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-6 overflow-auto content-start hide-scrollbar"
    >
      {/* ── Hero stat row ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Success rate */}
        <motion.div variants={fadeUp} className="glass-md rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/8 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
              <TrendingUp size={11} strokeWidth={2} className="text-emerald-400" />
              Success Rate
            </div>
            {successRate !== null && (
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                {successCount}/{history.length}
              </span>
            )}
          </div>

          {successRate !== null ? (
            <>
              <div
                className="tnum text-[38px] font-extrabold leading-none tracking-tight mb-3"
                style={{ color: successRate >= 80 ? '#34d399' : successRate >= 50 ? '#fbbf24' : '#f87171' }}
              >
                {successRate}
                <span className="text-[20px] font-bold opacity-60">%</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden bg-[var(--color-border)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${successRate}%` }}
                  transition={{ duration: 1.1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full relative overflow-hidden"
                  style={{
                    background: successRate >= 80 ? '#34d399' : successRate >= 50 ? '#fbbf24' : '#f87171',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer-wave_2s_infinite]" />
                </motion.div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-full border border-dashed border-[var(--color-border-strong)] flex items-center justify-center flex-shrink-0">
                <TrendingUp size={15} strokeWidth={1.8} className="text-[var(--color-text-muted)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] leading-tight">No data yet</div>
                <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-tight">Deploy to start tracking</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Latest deployment */}
        <motion.div variants={fadeUp} className="glass-md rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/8 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
            <Clock size={11} strokeWidth={2} className="text-indigo-400" />
            Latest Deploy
          </div>

          {lastRun ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ResultBadge result={lastRun.result} />
                {lastRun.durationSeconds && (
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)] glass-xs px-2 py-0.5 rounded-lg border border-[var(--color-border)]">
                    {formatDuration(lastRun.durationSeconds)}
                  </span>
                )}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {lastRun.platform}
                  <span className="mx-1.5 text-[var(--color-text-muted)]">·</span>
                  <span className="font-mono text-[var(--color-accent-bright)]">v{lastRun.version}</span>
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{timeAgo(lastRun.startedAt)}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-full border border-dashed border-[var(--color-border-strong)] flex items-center justify-center flex-shrink-0">
                <Clock size={15} strokeWidth={1.8} className="text-[var(--color-text-muted)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] leading-tight">No builds yet</div>
                <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-tight">Your latest deploy shows here</div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Project details card ───────────────────────── */}
      <motion.div variants={fadeUp} className="glass-md rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-32 bg-indigo-500/6 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-4 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          <h3 className="text-[11px] font-bold text-[var(--color-text-muted)] tracking-widest uppercase">
            Project Details
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5 mb-5">
          <Field label="Version" value={app.currentVersion} mono />
          <Field label="Type" value={app.projectType} />
          {app.bundleID    && <Field label="Bundle ID"  value={app.bundleID}    mono copyable />}
          {app.packageName && <Field label="Package"    value={app.packageName} mono copyable />}
          {app.xcodeSchemeName && <Field label="Scheme" value={app.xcodeSchemeName} mono />}
        </div>

        {/* Path row */}
        <div>
          <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Project Path
          </label>
          <div className="flex items-center gap-3 glass-xs rounded-xl px-3.5 py-3 border border-[var(--color-border)]">
            <span className="text-[var(--color-text-secondary)] font-mono text-[11px] truncate flex-1">{app.dirPath}</span>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => ipc.invoke('system:open-finder', { path: app.dirPath })}
              className="w-7 h-7 rounded-lg glass-sm flex items-center justify-center text-indigo-400 hover:text-indigo-300 flex-shrink-0 transition-colors"
              title="Reveal in Finder"
            >
              <FolderOpen size={13} strokeWidth={2} />
            </motion.button>
          </div>
        </div>

        {/* Recent builds mini-list */}
        {history.length > 0 && (
          <div className="mt-5">
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
              Recent Builds
            </label>
            <div className="flex flex-col gap-1.5">
              {history.slice(0, 3).map((run, i) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 px-3 py-2.5 glass-xs rounded-xl border border-[var(--color-border)]"
                >
                  <ResultDot result={run.result} />
                  <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">v{run.version}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] capitalize">{run.platform}</span>
                  <span className="ml-auto text-[11px] text-[var(--color-text-muted)]">{timeAgo(run.startedAt)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Store status ───────────────────────────────── */}
      {selectedOrgId && (app.packageName || app.bundleID) && (
        <motion.div variants={fadeUp}>
          <StoreStatusSection
            appId={app.id}
            orgId={selectedOrgId}
            hasAndroid={!!app.packageName}
            hasIOS={!!app.bundleID}
          />
        </motion.div>
      )}
    </motion.div>
  )
}

function Field({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 group">
      <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className={`truncate text-[13px] ${mono ? 'font-mono text-[var(--color-text-accent)]' : 'font-medium text-[var(--color-text-primary)]'}`}>
          {value}
        </span>
        {copyable && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigator.clipboard.writeText(value)}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 transition-all p-1.5 rounded-lg glass-xs hover:border-indigo-500/20 text-[var(--color-text-muted)] hover:text-indigo-400"
            title="Copy"
          >
            <Copy size={11} strokeWidth={2.5} />
          </motion.button>
        )}
      </div>
    </div>
  )
}

export function ResultBadge({ result }: { result: string }): JSX.Element {
  const map: Record<string, { color: string; bg: string; label: string; border: string }> = {
    success:   { color: '#34d399', bg: 'rgba(52,211,153,0.10)',  label: 'Success',   border: 'rgba(52,211,153,0.22)' },
    failed:    { color: '#f87171', bg: 'rgba(248,113,113,0.10)', label: 'Failed',    border: 'rgba(248,113,113,0.22)' },
    running:   { color: '#818cf8', bg: 'rgba(129,140,248,0.10)', label: 'Deploying', border: 'rgba(129,140,248,0.28)' },
    cancelled: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', label: 'Cancelled', border: 'rgba(100,116,139,0.16)' },
  }
  const s = map[result] ?? map.cancelled
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${result === 'running' ? 'pulse' : ''}`}
        style={{ background: s.color, boxShadow: result === 'running' ? `0 0 6px ${s.color}` : undefined }}
      />
      {s.label}
    </span>
  )
}

function ResultDot({ result }: { result: string }): JSX.Element {
  const colors: Record<string, string> = {
    success: '#34d399', failed: '#f87171', running: '#818cf8', cancelled: '#4a5268'
  }
  const c = colors[result] ?? colors.cancelled
  return (
    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
  )
}
