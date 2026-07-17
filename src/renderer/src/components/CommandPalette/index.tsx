import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useOrgStore } from '../../stores/orgStore'
import { useAppStore } from '../../stores/appStore'

interface Command {
  id: string
  label: string
  hint?: string
  shortcut?: string
  action: () => void
}

interface CommandGroup {
  id: string
  label: string
  commands: Command[]
}

export function CommandPalette(): JSX.Element {
  const { commandPaletteOpen, setCommandPalette, setDeployPanel, setSettings, openOrgSheet, setTab } = useUIStore()
  const { orgs, select: selectOrg } = useOrgStore()
  const { apps, select: selectApp } = useAppStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = () => setCommandPalette(false)

  const allGroups: CommandGroup[] = [
    {
      id: 'actions',
      label: 'Actions',
      commands: [
        { id: 'deploy', label: 'Deploy…', hint: 'Open deploy panel', shortcut: '⌘D', action: () => { setDeployPanel(true); close() } },
        { id: 'settings', label: 'Settings', hint: 'App preferences', shortcut: '⌘,', action: () => { setSettings(true); close() } },
        { id: 'new-org', label: 'New Organisation', hint: 'Create organisation', action: () => { openOrgSheet(); close() } }
      ]
    },
    {
      id: 'navigate',
      label: 'Go to',
      commands: [
        { id: 'tab-overview', label: 'Overview', action: () => { setTab('overview'); close() } },
        { id: 'tab-history', label: 'History', action: () => { setTab('history'); close() } },
        { id: 'tab-release', label: 'Release', action: () => { setTab('release'); close() } }
      ]
    },
    ...(apps.length > 0 ? [{
      id: 'apps',
      label: 'Apps',
      commands: apps.map((a) => ({ id: `app-${a.id}`, label: a.name, hint: 'Switch to app', action: () => { selectApp(a.id); close() } }))
    }] : []),
    ...(orgs.length > 0 ? [{
      id: 'orgs',
      label: 'Organisations',
      commands: orgs.map((o) => ({ id: `org-${o.id}`, label: o.name, hint: 'Switch org', action: () => { selectOrg(o.id); close() } }))
    }] : [])
  ]

  const filteredGroups = query.trim()
    ? allGroups
        .map((g) => ({
          ...g,
          commands: g.commands.filter(
            (c) => c.label.toLowerCase().includes(query.toLowerCase()) || c.hint?.toLowerCase().includes(query.toLowerCase())
          )
        }))
        .filter((g) => g.commands.length > 0)
    : allGroups

  const allFiltered = filteredGroups.flatMap((g) => g.commands)

  useEffect(() => { setSelectedIndex(0) }, [query])

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, allFiltered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        allFiltered[selectedIndex]?.action()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [allFiltered, selectedIndex])

  let flatIndex = 0

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
    <motion.div
      key="cmd-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={close}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-bg-overlay)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.1)'
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Search size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-placeholder)]"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <kbd
            className="text-xs px-1.5 py-0.5 rounded font-mono text-[var(--color-text-muted)] border flex-shrink-0"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-elevated)' }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filteredGroups.length === 0 ? (
            <div className="px-4 py-8 text-xs text-center text-[var(--color-text-muted)]">No results</div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id}>
                <div className="px-4 pt-2 pb-1 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                  {group.label}
                </div>
                {group.commands.map((cmd) => {
                  const idx = flatIndex++
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={cmd.action}
                      className="w-full flex items-center justify-between px-4 py-2 text-left relative transition-colors"
                      style={{ background: isSelected ? 'var(--color-bg-elevated)' : 'transparent' }}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="cmd-accent"
                          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
                          style={{ background: 'var(--color-accent)' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-sm truncate"
                          style={{ color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                        >
                          {cmd.label}
                        </span>
                        {cmd.hint && (
                          <span className="text-xs text-[var(--color-text-muted)] truncate">{cmd.hint}</span>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd
                          className="text-xs px-1.5 py-0.5 rounded font-mono text-[var(--color-text-muted)] border flex-shrink-0 ml-2"
                          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-base)' }}
                        >
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-xs text-[var(--color-text-muted)]">
            <kbd className="font-mono">↑↓</kbd> navigate · <kbd className="font-mono">↵</kbd> select
          </span>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
