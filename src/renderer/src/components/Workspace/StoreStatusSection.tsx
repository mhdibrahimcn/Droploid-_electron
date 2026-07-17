import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Loader2, AlertCircle, Store, Smartphone } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { timeAgo } from '../../lib/utils'
import type { AppStoreStatus, TrackInfo, IOSStoreStatus } from '../../../../shared/types/models'

// ── Label maps ───────────────────────────────────────────────────────────────

const IOS_STATE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  READY_FOR_SALE:              { label: 'Live',          color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  DEVELOPER_RELEASED_FOR_SALE: { label: 'Dev Released',  color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  WAITING_FOR_REVIEW:          { label: 'Waiting Review',color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  IN_REVIEW:                   { label: 'In Review',     color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  PENDING_DEVELOPER_RELEASE:   { label: 'Pending Rel.',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  PROCESSING_FOR_APP_STORE:    { label: 'Processing',    color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  PREPARE_IN_PROGRESS:         { label: 'Preparing',     color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
  REPLACED_WITH_NEW_VERSION:   { label: 'Replaced',      color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
  REMOVED_FROM_SALE:           { label: 'Removed',       color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

const ANDROID_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  completed:  { label: 'Live',        color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  inProgress: { label: 'Rolling Out', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  halted:     { label: 'Paused',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  draft:      { label: 'Draft',       color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
  unknown:    { label: 'Unknown',     color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
}

const TF_STATE_MAP: Record<string, { label: string; color: string }> = {
  VALID:       { label: 'Ready',      color: '#34d399' },
  PROCESSING:  { label: 'Processing', color: '#818cf8' },
  FAILED:      { label: 'Failed',     color: '#f87171' },
  INVALID:     { label: 'Invalid',    color: '#f87171' },
}

const TRACK_ORDER = ['production', 'beta', 'alpha', 'internal']

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ label, color, bg }: { label: string; color: string; bg: string }): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide flex-shrink-0"
      style={{ color, background: bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

function AndroidStatus({ tracks }: { tracks: TrackInfo[] }): JSX.Element {
  const sorted = [...tracks].sort(
    (a, b) => TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track)
  )
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((t) => {
        const rel = t.releases[0]
        const stateInfo = rel ? (ANDROID_STATUS_MAP[rel.status] ?? ANDROID_STATUS_MAP.unknown) : ANDROID_STATUS_MAP.unknown
        const versionCode = rel?.versionCodes?.[0] ?? null
        const versionName = rel?.name ?? null
        return (
          <motion.div
            key={t.track}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center justify-between px-3 py-2.5 glass-xs rounded-xl border border-[var(--color-border)]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[11px] font-semibold text-[var(--color-text-primary)] capitalize min-w-[60px]">
                {t.track}
              </span>
              {versionName && (
                <span className="font-mono text-[11px] text-[var(--color-text-accent)]">
                  {versionName}
                </span>
              )}
              {versionCode && (
                <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  #{versionCode}
                </span>
              )}
              {rel?.userFraction !== undefined && rel.userFraction < 1 && (
                <span className="text-[10px] text-[var(--color-warning)] font-medium">
                  {Math.round(rel.userFraction * 100)}% rollout
                </span>
              )}
            </div>
            {rel ? (
              <StatusChip {...stateInfo} />
            ) : (
              <span className="text-[10px] text-[var(--color-text-muted)]">No release</span>
            )}
          </motion.div>
        )
      })}
      {sorted.length === 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] text-center py-2">No tracks found</p>
      )}
    </div>
  )
}

function IOSStatus({ status }: { status: IOSStoreStatus }): JSX.Element {
  const liveVersion = status.appStoreVersions[0]
  const liveInfo = liveVersion
    ? (IOS_STATE_MAP[liveVersion.state] ?? { label: liveVersion.state, color: '#64748b', bg: 'rgba(100,116,139,0.10)' })
    : null

  return (
    <div className="flex flex-col gap-2">
      {/* App Store version */}
      {liveVersion && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between px-3 py-2.5 glass-xs rounded-xl border border-[var(--color-border)]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-semibold text-[var(--color-text-primary)] min-w-[60px]">App Store</span>
            <span className="font-mono text-[11px] text-[var(--color-text-accent)]">v{liveVersion.versionString}</span>
            {liveVersion.createdDate && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {timeAgo(liveVersion.createdDate)}
              </span>
            )}
          </div>
          {liveInfo && <StatusChip {...liveInfo} />}
        </motion.div>
      )}

      {/* TestFlight builds */}
      {status.testFlightBuilds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest px-1 mt-1">
            TestFlight
          </label>
          {status.testFlightBuilds.slice(0, 5).map((b, i) => {
            const tfInfo = TF_STATE_MAP[b.processingState] ?? { label: b.processingState, color: '#64748b' }
            return (
              <motion.div
                key={`${b.version}-${b.buildNumber}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between px-3 py-2 glass-xs rounded-xl border border-[var(--color-border)]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[11px] text-[var(--color-text-accent)]">
                    {b.version ? `v${b.version}` : '—'}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">#{b.buildNumber}</span>
                  {b.uploadedDate && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {timeAgo(b.uploadedDate)}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold" style={{ color: tfInfo.color }}>
                  {tfInfo.label}
                </span>
              </motion.div>
            )
          })}
        </div>
      )}

      {!liveVersion && status.testFlightBuilds.length === 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] text-center py-2">No versions found</p>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function StoreStatusSection({ appId, orgId, hasAndroid, hasIOS }: {
  appId: string
  orgId: string
  hasAndroid: boolean
  hasIOS: boolean
}): JSX.Element {
  const [status, setStatus] = useState<AppStoreStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await ipc.invoke<AppStoreStatus>('app:store-status', { appId, orgId })
      setStatus(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch store status')
    } finally {
      setLoading(false)
    }
  }, [appId, orgId])

  useEffect(() => { load() }, [load])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
      className="glass-md rounded-2xl p-5 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-40 h-32 bg-violet-500/6 blur-3xl rounded-full pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
          <h3 className="text-[11px] font-bold text-[var(--color-text-muted)] tracking-widest uppercase">
            Store Status
          </h3>
        </div>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={load}
          disabled={loading}
          className="w-7 h-7 rounded-lg glass-sm flex items-center justify-center text-[var(--color-text-muted)] hover:text-violet-400 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          {loading
            ? <Loader2 size={12} className="animate-spin" />
            : <RefreshCw size={12} strokeWidth={2.5} />}
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {!status && !loading && !error && (
          <motion.button
            key="prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={load}
            className="w-full flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-violet-400 hover:border-violet-500/30 transition-all group"
          >
            <Store size={18} className="opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="text-[11px] font-medium">Check store status</span>
          </motion.button>
        )}

        {loading && !status && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 rounded-xl animate-pulse"
                style={{ background: 'var(--color-border-subtle)', opacity: 1 - i * 0.2 }}
              />
            ))}
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 px-3 py-3 rounded-xl text-[11px]"
            style={{ background: 'var(--color-error-dim)', border: '1px solid var(--color-error)', color: 'var(--color-error)' }}
          >
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </motion.div>
        )}

        {status && !loading && (
          <motion.div
            key="data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            {hasAndroid && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                  <Smartphone size={9} />
                  Google Play
                </label>
                {status.android
                  ? <AndroidStatus tracks={status.android} />
                  : <p className="text-[11px] text-[var(--color-text-muted)] px-1">No credentials configured</p>}
              </div>
            )}

            {hasIOS && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                  <Store size={9} />
                  App Store Connect
                </label>
                {status.ios
                  ? <IOSStatus status={status.ios} />
                  : <p className="text-[11px] text-[var(--color-text-muted)] px-1">No credentials configured</p>}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
