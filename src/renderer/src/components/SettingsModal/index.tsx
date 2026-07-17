import { useState } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '../../stores/uiStore'
import { useToolStore } from '../../stores/toolStore'
import { ipc } from '../../lib/ipc'
import { cn } from '../../lib/utils'

const TOOL_LABELS: Record<string, string> = {
  homebrew: 'Homebrew', ruby: 'Ruby', fastlane: 'Fastlane', python3: 'Python 3',
  googleApi: 'Google API Client', cocoapods: 'CocoaPods', flutter: 'Flutter', xcode: 'Xcode CLI',
  shorebird: 'Shorebird'
}

export function SettingsModal(): JSX.Element {
  const { settingsOpen, setSettings } = useUIStore()
  const { tools, install, repairAll, checking } = useToolStore()
  const [tab, setTab] = useState<'general' | 'tools'>('general')
  const [userName, setUserName] = useState('')
  const [retention, setRetention] = useState(90)

  return (
    <AnimatePresence>
      {settingsOpen && (
    <motion.div
      key="settings-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={() => setSettings(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--color-bg-overlay)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'inset 0 1px 0 var(--glass-highlight), 0 32px 64px -16px rgba(0,0,0,0.55)',
          maxHeight: '80vh',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">Settings</h2>
          <button onClick={() => setSettings(false)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {(['general', 'tools'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-5 py-2.5 text-xs font-medium capitalize border-b-2 -mb-px transition-colors', tab === t ? 'text-[var(--color-text-accent)] border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]')}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'general' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Display name</label>
                <input value={userName} onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none transition-all focus:ring-2 focus:ring-[var(--color-accent-ring)] focus:border-[var(--color-accent)]"
                  style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Log retention</label>
                <div className="flex flex-wrap gap-2">
                  {[7, 14, 30, 60, 90, 180].map((d) => (
                    <button key={d} onClick={() => setRetention(d)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer', retention === d ? 'border-[var(--color-accent-ring)] bg-[var(--color-accent-dim)] text-[var(--color-text-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]')}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === 'tools' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--color-text-muted)]">Development tools status</span>
                <button onClick={repairAll} disabled={checking}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all hover:opacity-90"
                  style={{ background: 'var(--color-accent)' }}>
                  {checking ? 'Repairing…' : 'Repair All'}
                </button>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                {tools.map((t, i) => (
                  <div key={t.name} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < tools.length - 1 ? '1px solid var(--color-border)' : undefined, background: 'var(--color-bg-elevated)' }}>
                    <div>
                      <div className="text-xs text-[var(--color-text-primary)]">{TOOL_LABELS[t.name]}</div>
                      {t.version && <div className="text-xs text-[var(--color-text-muted)] font-mono">{t.version.split('\n')[0].slice(0, 40)}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {t.state === 'found' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />}
                      {t.state === 'missing' && (
                        <button onClick={() => install(t.name)} className="text-xs px-2.5 py-1 rounded text-white" style={{ background: 'var(--color-accent)' }}>Install</button>
                      )}
                      {t.state === 'installing' && <span className="text-xs text-[var(--color-warning)] pulse">Installing…</span>}
                      {t.state === 'failed' && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-error)]" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t flex justify-end" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={async () => {
            await ipc.invoke('store:set', { key: 'user_name', value: userName })
            await ipc.invoke('store:set', { key: 'log_retention_days', value: retention })
            setSettings(false)
          }} className="px-4 py-2 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--color-accent)' }}>
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SettingsModal
