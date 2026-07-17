import { motion } from 'framer-motion'
import { useUIStore, type WorkspaceTab } from '../../stores/uiStore'
import { cn } from '../../lib/utils'

const TABS: { id: WorkspaceTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'history',  label: 'History',  icon: '◎' },
  { id: 'release',  label: 'Release',  icon: '◈' },
]

export default function TabBar(): JSX.Element {
  const { activeTab, setTab } = useUIStore()

  return (
    <div className="flex items-center justify-start px-5 pb-3 pt-1 flex-shrink-0">
      {/* Segmented pill container */}
      <div className="flex items-center glass-xs rounded-2xl p-1 gap-0.5 relative">
        {TABS.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={cn(
              'relative px-4 py-1.5 rounded-xl text-[12px] font-semibold transition-colors duration-150 cursor-pointer z-10 app-no-drag',
              activeTab === tab.id
                ? 'text-[var(--color-text-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            )}
          >
            {/* Active thumb */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-thumb"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'rgba(99,102,241,0.18)',
                  border: '1px solid rgba(99,102,241,0.28)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 8px rgba(99,102,241,0.15)',
                }}
                initial={false}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              />
            )}
            <span className="relative z-10 tracking-wide">{tab.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
