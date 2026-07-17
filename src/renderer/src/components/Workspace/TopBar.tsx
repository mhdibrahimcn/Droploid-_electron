import { motion, AnimatePresence } from 'framer-motion'
import { FolderOpen, Rocket, ArrowUpDown, PanelLeft, Zap } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import { useUIStore } from '../../stores/uiStore'
import { useOrgStore } from '../../stores/orgStore'
import { nameColor, initials } from '../../lib/utils'
import type { LinkedApp } from '../../../../shared/types/models'

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  flutter:       { label: 'Flutter',  color: '#54c5f8', bg: 'rgba(84,197,248,0.12)' },
  nativeIOS:     { label: 'iOS',      color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  nativeAndroid: { label: 'Android',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
}

const btn = {
  whileHover: { scale: 1.03 },
  whileTap:   { scale: 0.94 },
  transition: { type: 'spring', stiffness: 420, damping: 26 },
}

export default function TopBar({ app }: { app: LinkedApp }): JSX.Element {
  const { sidebarOpen, toggleSidebar, setDeployPanel, setPromoteSheet } = useUIStore()
  const { orgs, selectedOrgId } = useOrgStore()
  const org = orgs.find((o) => o.id === selectedOrgId)
  const cfg = TYPE_CONFIG[app.projectType] ?? TYPE_CONFIG.flutter

  return (
    <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 relative">
      {/* Subtle gradient separator at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'var(--color-border)' }} />

      {/* Sidebar toggle — appears when sidebar is closed */}
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            {...btn}
            onClick={toggleSidebar}
            className="p-2 rounded-xl glass-xs hover:bg-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer flex-shrink-0"
          >
            <PanelLeft size={14} strokeWidth={1.8} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* App icon */}
      <motion.div
        key={app.id}
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex-shrink-0 relative"
      >
        {app.iconData ? (
          <img
            src={app.iconData}
            className="w-9 h-9 rounded-[10px] object-cover shadow-md"
            style={{ boxShadow: `0 2px 14px ${cfg.color}30` }}
          />
        ) : (
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[15px] font-bold text-white shadow-md relative overflow-hidden"
            style={{ background: nameColor(app.name) }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
            <span className="relative z-10">{app.name[0]?.toUpperCase()}</span>
          </div>
        )}
      </motion.div>

      {/* App name + metadata */}
      <motion.div
        key={app.id + '-meta'}
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: 0.04 }}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[14px] font-bold text-[var(--color-text-primary)] truncate tracking-tight leading-none">
            {app.name}
          </h1>
          {/* Platform badge */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide flex-shrink-0"
            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
          >
            {cfg.label}
          </span>
          {/* Org breadcrumb */}
          {org && (
            <span className="text-[11px] text-[var(--color-text-muted)] truncate hidden sm:block font-medium">
              {org.name}
            </span>
          )}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] truncate font-mono mt-0.5">
          {app.currentVersion}
          {(app.bundleID ?? app.packageName) && (
            <span className="text-[var(--color-text-muted)]/60 mx-1">·</span>
          )}
          {app.bundleID ?? app.packageName ?? ''}
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Open in Finder */}
        <motion.button
          {...btn}
          onClick={() => ipc.invoke('system:open-finder', { path: app.dirPath })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-[var(--color-text-secondary)] glass-xs hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)] transition-all border border-[var(--color-border)] cursor-pointer"
          title="Open in Finder"
        >
          <FolderOpen size={12} strokeWidth={2} />
          <span className="hidden sm:inline">Finder</span>
        </motion.button>

        {/* Promote — only for Android-capable apps */}
        {(app.projectType === 'flutter' || app.projectType === 'nativeAndroid') && (
          <motion.button
            {...btn}
            onClick={() => setPromoteSheet(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-[var(--color-text-secondary)] glass-xs hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)] transition-all border border-[var(--color-border)] cursor-pointer"
          >
            <ArrowUpDown size={12} strokeWidth={2} />
            <span className="hidden sm:inline">Promote</span>
          </motion.button>
        )}

        {/* Deploy — primary CTA */}
        <motion.button
          whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(99,102,241,0.5), 0 0 8px rgba(99,102,241,0.3)' }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          onClick={() => setDeployPanel(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white cursor-pointer relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 0 14px rgba(99,102,241,0.30), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
          title="Deploy (⌘D)"
        >
          {/* Inner shine */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
          <motion.div
            animate={{ rotate: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2.5 }}
            className="relative z-10"
          >
            <Zap size={13} strokeWidth={2.5} fill="currentColor" />
          </motion.div>
          <span className="relative z-10">Deploy</span>
        </motion.button>
      </div>
    </div>
  )
}
