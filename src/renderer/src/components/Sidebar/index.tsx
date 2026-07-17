import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Settings, ChevronDown, PanelLeft, Trash2, Link, Sun, Moon } from 'lucide-react'
import { useRef } from 'react'
import { useOrgStore } from '../../stores/orgStore'
import { useAppStore } from '../../stores/appStore'
import { useUIStore } from '../../stores/uiStore'
import { ipc } from '../../lib/ipc'
import { cn, nameColor, initials } from '../../lib/utils'
import type { LinkedApp } from '../../../../shared/types/models'

export default function Sidebar(): JSX.Element {
  const { sidebarOpen, toggleSidebar, setSettings, openOrgSheet } = useUIStore()

  return (
    <AnimatePresence initial={false}>
      {sidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 252, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="glass-sidebar flex flex-col flex-shrink-0 overflow-hidden relative"
        >
          {/* Ambient top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-32 bg-indigo-500/8 blur-[60px] rounded-full pointer-events-none" />

          {/* Org switcher */}
          <OrgSwitcher onNew={() => openOrgSheet()} />

          {/* App list */}
          <AppList />

          {/* Footer */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-[var(--color-border)] flex items-center justify-between relative z-10">
            <button
              onClick={() => setSettings(true)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-all app-no-drag"
            >
              <Settings size={13} strokeWidth={1.8} />
              <span className="font-medium">Settings</span>
            </button>

            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-all app-no-drag"
                title="Collapse sidebar (⌘B)"
              >
                <PanelLeft size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function OrgSwitcher({ onNew }: { onNew: () => void }): JSX.Element {
  const { orgs, selectedOrgId, select } = useOrgStore()
  const { openOrgDetail, closeOrgDetail, orgDetailOpen } = useUIStore()
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId)

  return (
    <div className="px-3 pt-11 pb-2 relative z-10">
      {/* Workspace header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
          Workspace
        </span>
        <div className="flex items-center gap-1">
          {orgs.filter((o) => o.id !== selectedOrgId).slice(0, 3).map((o) => (
            <motion.button
              key={o.id}
              whileHover={{ scale: 1.18, opacity: 1 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              onClick={() => select(o.id)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold opacity-40 ring-1 ring-[var(--color-border-strong)] hover:ring-[var(--color-border-strong)] hover:opacity-90 app-no-drag"
              style={{ background: nameColor(o.name), color: '#fff' }}
              title={o.name}
            >
              {initials(o.name).slice(0, 1)}
            </motion.button>
          ))}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            onClick={onNew}
            className="w-5 h-5 rounded-full glass-xs flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-indigo-500/15 app-no-drag"
            title="New organization"
          >
            <Plus size={10} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>

      {/* Org pill */}
      {selectedOrg ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          onClick={() => orgDetailOpen ? closeOrgDetail() : openOrgDetail()}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all app-no-drag group',
            orgDetailOpen ? 'glass-accent' : 'hover:bg-[var(--color-border)]'
          )}
        >
          <OrgAvatar org={selectedOrg} size={30} />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-bold text-[var(--color-text-primary)] truncate leading-tight group-hover:text-[var(--color-text-accent)] transition-colors">
              {selectedOrg.name}
            </div>
          </div>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className={cn(
              'text-[var(--color-text-muted)] flex-shrink-0 transition-all duration-200',
              orgDetailOpen ? 'rotate-180 text-indigo-300' : 'group-hover:text-[var(--color-text-primary)]'
            )}
          />
        </motion.button>
      ) : (
        <div className="px-1 py-2 text-[12px] text-[var(--color-text-muted)]">
          No workspace selected
        </div>
      )}
    </div>
  )
}

function AppList(): JSX.Element {
  const { apps, selectedAppId, select, link } = useAppStore()
  const { selectedOrgId } = useOrgStore()
  const { closeOrgDetail } = useUIStore()

  const handleLink = async () => {
    const dir = await ipc.invoke<string | null>('system:pick-folder')
    if (dir && selectedOrgId) {
      await link(selectedOrgId, dir)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-1 hide-scrollbar relative z-10">
      {/* Section header */}
      <div className="flex items-center justify-between px-1 py-2 mb-0.5">
        <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
          Applications
        </span>
        {selectedOrgId && (
          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            onClick={handleLink}
            className="w-5 h-5 rounded-lg glass-xs flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-all app-no-drag"
            title="Link app folder"
          >
            <Plus size={11} strokeWidth={2.5} />
          </motion.button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="mx-1 mt-2 px-3 py-4 rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
            Select or create an<br />organisation first
          </p>
        </div>
      ) : (
        <>
          {apps.map((app) => (
            <AppRow
              key={app.id}
              app={app}
              selected={app.id === selectedAppId}
              onSelect={() => { select(app.id); closeOrgDetail() }}
            />
          ))}

          {apps.length === 0 && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLink}
              className="w-full mt-1 flex items-center gap-3 px-3 py-3.5 rounded-2xl border border-dashed border-[var(--color-border)] hover:border-indigo-500/25 hover:bg-indigo-500/5 text-[var(--color-text-muted)] hover:text-indigo-300 transition-all app-no-drag group"
            >
              <div className="w-9 h-9 rounded-[9px] glass-xs flex items-center justify-center flex-shrink-0 group-hover:border-indigo-500/20 transition-colors">
                <Link size={14} strokeWidth={1.8} />
              </div>
              <span className="text-xs font-medium">Link app folder…</span>
            </motion.button>
          )}
        </>
      )}
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  flutter: '#54c5f8',
  nativeIOS: '#a78bfa',
  nativeAndroid: '#4ade80',
}

function AppRow({ app, selected, onSelect }: { app: LinkedApp; selected: boolean; onSelect: () => void }): JSX.Element {
  const { unlink } = useAppStore()
  const typeColor = TYPE_COLORS[app.projectType] ?? '#818cf8'

  function handleUnlink(e: React.MouseEvent): void {
    e.stopPropagation()
    if (window.confirm(`Unlink "${app.name}"? This won't delete any files.`)) {
      unlink(app.id)
    }
  }

  return (
    <motion.button
      whileHover={!selected ? { x: 1 } : {}}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-2.5 py-2.5 rounded-2xl text-left transition-all app-no-drag group relative mb-0.5 cursor-pointer',
        selected ? '' : 'hover:bg-[var(--color-border)]'
      )}
    >
      {/* Active glass bg */}
      {selected && (
        <motion.div
          layoutId="sidebar-active-app"
          className="absolute inset-0 rounded-2xl glass-accent pointer-events-none"
          initial={false}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}

      {/* Left accent bar */}
      {selected && (
        <motion.div
          layoutId="sidebar-accent-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full pointer-events-none"
          style={{ background: 'var(--color-accent-bright)', boxShadow: '0 0 10px rgba(129,140,248,0.7)' }}
          initial={false}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}

      {/* App icon — 44px App Store style */}
      <div className="relative z-10 flex-shrink-0 w-9 h-9">
        {app.iconData ? (
          <img
            src={app.iconData}
            className="w-full h-full rounded-[9px] object-cover shadow-md"
            style={{ boxShadow: selected ? `0 2px 12px ${typeColor}30` : undefined }}
          />
        ) : (
          <div
            className="w-full h-full rounded-[9px] flex items-center justify-center text-[14px] font-bold shadow-md relative overflow-hidden"
            style={{ background: nameColor(app.name), color: '#fff' }}
          >
            {/* Shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            <span className="relative z-10">{initials(app.name).slice(0, 1)}</span>
          </div>
        )}
        {/* Type dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-bg-base)]"
          style={{ background: typeColor }}
        />
      </div>

      {/* App info */}
      <div className="relative z-10 flex flex-col flex-1 min-w-0 justify-center">
        <span className={cn(
          'text-[13px] font-semibold truncate leading-snug tracking-tight',
          'text-[var(--color-text-primary)]'
        )}>
          {app.name}
        </span>
        <span className={cn(
          'text-[11px] font-mono truncate leading-snug mt-0.5',
          selected ? 'text-[var(--color-text-accent)]/60' : 'text-[var(--color-text-muted)]'
        )}>
          {app.bundleID ?? app.packageName ?? app.projectType}
        </span>
      </div>

      {/* Unlink button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleUnlink}
        className="relative z-10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10"
        title="Unlink app"
      >
        <Trash2 size={12} strokeWidth={2} />
      </motion.button>
    </motion.button>
  )
}

function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useUIStore()
  const btnRef = useRef<HTMLButtonElement>(null)
  const isDark = theme === 'dark'

  const handleToggle = () => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      toggleTheme(rect.left + rect.width / 2, rect.top + rect.height / 2)
    } else {
      toggleTheme()
    }
  }

  return (
    <motion.button
      ref={btnRef}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      onClick={handleToggle}
      className="relative p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors app-no-drag overflow-hidden"
      title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="block"
          >
            <Sun size={13} strokeWidth={1.8} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate: 90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="block"
          >
            <Moon size={13} strokeWidth={1.8} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function OrgAvatar({ org, size }: { org: { name: string; photoPath?: string }; size: number }): JSX.Element {
  if (org.photoPath) {
    return (
      <img
        src={`local-file://${org.photoPath}`}
        className="rounded-xl object-cover flex-shrink-0 shadow-sm"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-xl flex items-center justify-center font-bold flex-shrink-0 relative overflow-hidden shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.42, background: nameColor(org.name), color: '#fff' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
      <span className="relative z-10">{initials(org.name).slice(0, 1)}</span>
    </div>
  )
}
