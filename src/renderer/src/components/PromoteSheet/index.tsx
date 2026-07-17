import { useEffect } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '../../stores/uiStore'
import { useOrgStore } from '../../stores/orgStore'
import { useAppStore } from '../../stores/appStore'
import { usePromoteStore } from '../../stores/promoteStore'
import { ipc } from '../../lib/ipc'
import TerminalPane from '../TerminalPane'
import type { LogLine } from '../../../../shared/types/models'

const TRACK_LADDER = ['internal', 'alpha', 'beta', 'production']

function trackLabel(name: string, tracks: { track: string; releases: { name?: string; versionCodes: string[] }[] }[]): string {
  const rel = tracks.find((t) => t.track === name)?.releases[0]
  if (!rel) return name
  const parts: string[] = [name]
  if (rel.name) parts.push(rel.name)
  if (rel.versionCodes[0]) parts.push(`#${rel.versionCodes[0]}`)
  return parts.join('  ·  ')
}

export function PromoteSheet(): JSX.Element {
  const { promoteSheetOpen, setPromoteSheet } = useUIStore()
  const { selectedOrgId } = useOrgStore()
  const app = useAppStore((s) => s.apps.find((a) => a.id === s.selectedAppId) ?? null)

  const {
    tracks, setTracks,
    fromTrack, setFromTrack,
    toTrack, setToTrack,
    loading, setLoading,
    promoting, setPromoting,
    done, setDone,
    logs, appendLog,
    reset,
  } = usePromoteStore()

  useEffect(() => {
    if (!promoteSheetOpen) return

    reset()

    const load = async () => {
      if (!selectedOrgId) { setLoading(false); return }
      const jsonPath = await ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'android_json_path' })
      if (!jsonPath || !app?.packageName) { setLoading(false); return }
      try {
        const t = await ipc.invoke<typeof tracks>('build:tracks', { packageName: app.packageName, jsonKeyPath: jsonPath })
        setTracks(t)
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()

    const off = ipc.on('promote:log-line', (...args) => {
      const { text } = args[0] as { text: string }
      appendLog({ id: `${Date.now()}`, kind: 'output', text, platform: 'android' } as LogLine)
    })
    const offDone = ipc.on('promote:complete', () => {
      setDone(true)
      setPromoting(false)
    })
    return () => { off(); offDone() }
  }, [promoteSheetOpen])

  const existingTracks = tracks.map((t) => t.track)
  const fromOptions = existingTracks.filter((t) => t !== 'production')
  const toOptions = TRACK_LADDER.filter((t) => {
    if (!fromTrack) return false
    const fi = TRACK_LADDER.indexOf(fromTrack)
    const ti = TRACK_LADDER.indexOf(t)
    return ti > fi && existingTracks.includes(t)
  })

  const handleClose = () => {
    reset()
    setPromoteSheet(false)
  }

  const handlePromote = async () => {
    if (!selectedOrgId || !fromTrack || !toTrack || !app?.packageName) return
    const jsonPath = await ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'android_json_path' })
    if (!jsonPath) return
    setPromoting(true)
    try {
      await ipc.invoke('build:promote', { packageName: app.packageName, jsonKeyPath: jsonPath, fromTrack, toTrack })
    } catch {
      setPromoting(false)
    }
  }

  if (!app) return <></>

  return (
    <AnimatePresence>
      {promoteSheetOpen && (
        <motion.div
          key="promote-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl flex flex-col"
            style={{ background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border)', maxHeight: '80vh' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Promote Release</h2>
              <button onClick={handleClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"><X size={14} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {loading ? (
                <div className="text-xs text-[var(--color-text-muted)]">Loading tracks…</div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-[var(--color-text-muted)] mb-2 block">From track</label>
                      <select value={fromTrack} onChange={(e) => { setFromTrack(e.target.value); setToTrack('') }}
                        className="w-full px-3 py-2 rounded-lg text-xs outline-none capitalize"
                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                        <option value="">Select track</option>
                        {fromOptions.map((t) => <option key={t} value={t}>{trackLabel(t, tracks)}</option>)}
                      </select>
                    </div>
                    <ArrowRight size={16} className="text-[var(--color-text-muted)] mt-5 flex-shrink-0" />
                    <div className="flex-1">
                      <label className="text-xs text-[var(--color-text-muted)] mb-2 block">To track</label>
                      <select value={toTrack} onChange={(e) => setToTrack(e.target.value)} disabled={!fromTrack}
                        className="w-full px-3 py-2 rounded-lg text-xs outline-none capitalize disabled:opacity-40"
                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                        <option value="">Select Track</option>
                        {toOptions.map((t) => <option key={t} value={t}>{trackLabel(t, tracks)}</option>)}
                      </select>
                    </div>
                  </div>

                  {(promoting || done) && (
                    <div className="rounded-xl overflow-hidden h-48" style={{ border: '1px solid var(--color-border)' }}>
                      <TerminalPane lines={logs} />
                    </div>
                  )}

                  {done && (
                    <div className="text-xs text-[var(--color-success)] font-medium">Promotion complete!</div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={handleClose} className="px-4 py-2 rounded-lg text-xs border text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]" style={{ borderColor: 'var(--color-border)' }}>
                {done ? 'Close' : 'Cancel'}
              </button>
              {!done && (
                <button onClick={handlePromote} disabled={!fromTrack || !toTrack || promoting}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                  style={{ background: 'var(--color-accent)' }}>
                  {promoting ? 'Promoting…' : 'Promote'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PromoteSheet
