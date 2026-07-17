import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelLeft, Zap } from 'lucide-react'
import { useOrgStore } from '../../stores/orgStore'
import { useAppStore } from '../../stores/appStore'
import { useUIStore } from '../../stores/uiStore'
import Sidebar from '../../components/Sidebar'
import TopBar from '../../components/Workspace/TopBar'
import TabBar from '../../components/Workspace/TabBar'
import OverviewTab from '../../components/Workspace/OverviewTab'
import HistoryTab from '../../components/Workspace/HistoryTab'
import ReleaseTab from '../../components/Workspace/ReleaseTab'
import { OrgDetailPage } from '../../components/OrgDetailPage'
import { useBuildStore } from '../../stores/buildStore'

export function Workspace(): JSX.Element {
  const { selectedOrgId } = useOrgStore()
  const { apps, selectedAppId, loadForOrg } = useAppStore()
  const { activeTab, orgDetailOpen, sidebarOpen, toggleSidebar } = useUIStore()
  const selectedApp = apps.find((a) => a.id === selectedAppId) ?? null

  useEffect(() => useBuildStore.getState().startListening(), [])

  useEffect(() => {
    if (selectedOrgId) loadForOrg(selectedOrgId)
  }, [selectedOrgId])

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') { e.preventDefault(); useUIStore.getState().setCommandPalette(true) }
      if (e.metaKey && e.key === 'b') { e.preventDefault(); useUIStore.getState().toggleSidebar() }
      if (e.metaKey && e.key === ',') { e.preventDefault(); useUIStore.getState().setSettings(true) }
      if (e.metaKey && e.key === 'd' && selectedApp) { e.preventDefault(); useUIStore.getState().setDeployPanel(true) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [selectedApp])

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--color-bg-base)' }}>
      {/* Global ambient blobs — same in both themes, opacity tuned per-theme via CSS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-80px] left-[20%] w-[500px] h-[500px] rounded-full blur-[160px]"
          style={{ background: 'rgba(99,102,241,0.07)' }} />
        <div className="absolute bottom-[-80px] right-[10%] w-[400px] h-[400px] rounded-full blur-[140px]"
          style={{ background: 'rgba(168,85,247,0.05)' }} />
        <div className="absolute top-[30%] left-[-100px] w-[300px] h-[300px] rounded-full blur-[120px]"
          style={{ background: 'rgba(59,130,246,0.04)' }} />
      </div>

      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 relative overflow-hidden">
        {/* Traffic-light drag zone */}
        <div className="app-drag h-11 flex-shrink-0 absolute top-0 left-0 right-0 z-10">
          {!sidebarOpen && (
            <motion.button
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={toggleSidebar}
              className="app-no-drag absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-xl glass-xs hover:bg-white/8 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all"
              title="Show sidebar (⌘B)"
            >
              <PanelLeft size={13} strokeWidth={1.8} />
            </motion.button>
          )}
        </div>

        {/* Content — offset below drag zone */}
        <div className="flex flex-col flex-1 min-h-0 pt-11 relative z-10">
          {orgDetailOpen && !selectedApp ? (
            <AnimatePresence mode="wait">
              <OrgDetailPage key={selectedOrgId ?? 'org'} />
            </AnimatePresence>
          ) : selectedApp ? (
            <div className="flex flex-col flex-1 min-h-0 px-5 pb-5">
              <TopBar app={selectedApp} />
              <TabBar />

              {/* Tab content — real glass over the ambient blobs (theme-aware) */}
              <div className="glass-surface flex-1 overflow-hidden rounded-2xl relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full overflow-auto hide-scrollbar"
                  >
                    {activeTab === 'overview' && <OverviewTab app={selectedApp} />}
                    {activeTab === 'history'  && <HistoryTab  appId={selectedApp.id} />}
                    {activeTab === 'release'  && <ReleaseTab  app={selectedApp} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <EmptyState orgId={selectedOrgId} />
          )}
        </div>
      </div>
    </div>
  )
}

export default Workspace

function EmptyState({ orgId }: { orgId: string | null }): JSX.Element {
  if (!orgId) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center flex-1 gap-5 relative"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-80 h-80 bg-indigo-500/8 rounded-full blur-3xl" />
        </div>

        <div className="float relative z-10">
          <div className="absolute inset-0 bg-indigo-500/15 blur-2xl rounded-3xl" />
          <div className="w-16 h-16 rounded-2xl glass-sm relative z-10 flex items-center justify-center"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 32px rgba(99,102,241,0.15)' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-bright)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        </div>

        <div className="text-center relative z-10 max-w-xs space-y-2">
          <h3 className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">No organization yet</h3>
          <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
            Create a workspace to start managing and deploying your mobile apps.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.04, boxShadow: '0 0 28px rgba(99,102,241,0.5)' }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          onClick={() => useUIStore.getState().openOrgSheet()}
          className="relative z-10 app-no-drag px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
          <span className="relative z-10">New Organization</span>
        </motion.button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(8px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center flex-1 gap-4"
    >
      <div className="float relative">
        <div className="absolute inset-0 bg-white/4 blur-xl rounded-2xl" />
        <div className="w-14 h-14 rounded-2xl glass-sm relative z-10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-[14px] font-bold text-[var(--color-text-primary)] tracking-tight">No app selected</h3>
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Pick an app from the sidebar or link a project folder.
        </p>
      </div>
    </motion.div>
  )
}
