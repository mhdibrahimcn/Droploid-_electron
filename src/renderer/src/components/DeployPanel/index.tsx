import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, Check, Zap, UploadCloud } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useBuildStore } from '../../stores/buildStore'
import { useOrgStore } from '../../stores/orgStore'
import { useAppStore } from '../../stores/appStore'
import { useDeployWizardStore } from '../../stores/deployWizardStore'
import { ipc } from '../../lib/ipc'
import { bump } from '../../lib/version'
import { cn } from '../../lib/utils'
import type { LinkedApp, BuildPlatform, BumpKind, PreflightCheck } from '../../../../shared/types/models'

type Step = 'preflight' | 'version' | 'platform' | 'confirm'

const STEPS: { id: Step; label: string }[] = [
  { id: 'preflight', label: 'Checks' },
  { id: 'version',   label: 'Version' },
  { id: 'platform',  label: 'Platform' },
  { id: 'confirm',   label: 'Confirm' },
]

export function DeployPanel(): JSX.Element {
  const { deployPanelOpen, setDeployPanel, setTab, openOrgSheet } = useUIStore()
  const app = useAppStore((s) => s.apps.find((a) => a.id === s.selectedAppId) ?? null)
  const { setActiveRun, startPatch, finishPatch } = useBuildStore()
  const { selectedOrgId } = useOrgStore()

  const {
    step, setStep,
    preflight, setPreflight,
    bumpKind, setBumpKind,
    platform, setPlatform,
    track, setTrack,
    rollout, setRollout,
    releaseNotes, setReleaseNotes,
    useShorebird, setUseShorebird,
    deploying, setDeploying,
    reset,
  } = useDeployWizardStore()

  const blockers = preflight.filter((c) => !c.passed && c.isBlocker)

  const loadPreflight = async () => {
    if (!app || !selectedOrgId) return
    const checks = await ipc.invoke<PreflightCheck[]>('build:preflight', { appId: app.id, orgId: selectedOrgId, platform })
    setPreflight(checks)
  }

  useEffect(() => {
    if (deployPanelOpen) {
      reset()
      loadPreflight()
    }
  }, [deployPanelOpen])

  const handleDeploy = async () => {
    if (!app || !selectedOrgId) return
    setDeploying(true)
    try {
      const { runId, checkpoints: initialCps } = await ipc.invoke<{ runId: string; checkpoints: import('../../../../shared/types/models').BuildCheckpoint[] }>('build:start', {
        appId: app.id,
        orgId: selectedOrgId,
        platform,
        bumpKind,
        track,
        rollout: track === 'production' ? rollout : undefined,
        releaseNotes: releaseNotes.trim() || undefined,
        useShorebird,
      })
      setActiveRun(runId, initialCps)
      setDeployPanel(false)
      setTab('release')
    } finally {
      setDeploying(false)
    }
  }

  // Shorebird OTA patch — one-shot, skips the wizard. Patches the latest release in place.
  const handleShorebirdPatch = async () => {
    if (!app) return
    startPatch(platform)
    setDeployPanel(false)
    setTab('release')
    try {
      const res = await ipc.invoke<{ runId: string; ios?: boolean; android?: boolean }>('build:shorebird-patch', {
        appId: app.id,
        platform,
      })
      finishPatch(res.ios, res.android)
    } catch {
      // Mark the platforms we attempted as failed so the release tab reflects the outcome.
      finishPatch(platform === 'android' ? undefined : false, platform === 'ios' ? undefined : false)
    }
  }

  const handleFix = async (checkId: string) => {
    if (['ios_key_id', 'ios_issuer_id', 'ios_team_id'].includes(checkId) && selectedOrgId) {
      setDeployPanel(false)
      openOrgSheet(selectedOrgId)
      return
    }
    if (checkId === 'ios_p8' && selectedOrgId) {
      const path = await ipc.invoke<string | null>('system:pick-file', { filters: [{ name: 'API Key', extensions: ['p8'] }] })
      if (path) {
        await ipc.invoke('keychain:set', { orgId: selectedOrgId, field: 'ios_p8_path', value: path })
        loadPreflight()
      }
      return
    }
    if (checkId === 'android_json' && selectedOrgId) {
      const path = await ipc.invoke<string | null>('system:pick-file', { filters: [{ name: 'Service Account JSON', extensions: ['json'] }] })
      if (path) {
        await ipc.invoke('keychain:set', { orgId: selectedOrgId, field: 'android_json_path', value: path })
        loadPreflight()
      }
    }
  }

  if (!app) return <></>

  const stepIdx = STEPS.findIndex((s) => s.id === step)
  const prevStep = (): void => {
    const map: Record<Step, Step> = { confirm: 'platform', platform: 'version', version: 'preflight', preflight: 'preflight' }
    setStep(map[step])
  }
  const nextStep = (): void => {
    const map: Record<Step, Step> = { preflight: 'version', version: 'platform', platform: 'confirm', confirm: 'confirm' }
    setStep(map[step])
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {deployPanelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeployPanel(false)}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {deployPanelOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-96 z-50 flex flex-col glass-panel overflow-hidden"
          >
            {/* Ambient glow inside panel */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/8 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/6 blur-[60px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--color-border)] flex-shrink-0 relative z-10">
              <div>
                <h2 className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">Deploy</h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 font-medium">{app.name}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setDeployPanel(false)}
                className="w-7 h-7 rounded-xl glass-xs flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={13} strokeWidth={2} />
              </motion.button>
            </div>

            {/* Step progress */}
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0 relative z-10">
              <div className="flex items-center gap-0">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <motion.div
                        animate={{
                          background: i < stepIdx
                            ? 'rgba(52,211,153,0.15)'
                            : i === stepIdx
                            ? 'rgba(99,102,241,0.18)'
                            : 'var(--color-border-subtle)',
                          boxShadow: i === stepIdx
                            ? '0 0 0 2px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
                            : 'none',
                        }}
                        transition={{ duration: 0.3 }}
                        className="w-6 h-6 rounded-full flex items-center justify-center border"
                        style={{
                          borderColor: i < stepIdx
                            ? 'rgba(52,211,153,0.3)'
                            : i === stepIdx
                            ? 'rgba(99,102,241,0.4)'
                            : 'var(--color-border)',
                        }}
                      >
                        {i < stepIdx ? (
                          <Check size={10} color="#34d399" strokeWidth={2.5} />
                        ) : (
                          <span
                            className="font-mono font-bold"
                            style={{
                              fontSize: 9,
                              color: i === stepIdx ? '#818cf8' : 'var(--color-text-muted)',
                            }}
                          >
                            {i + 1}
                          </span>
                        )}
                      </motion.div>
                      <span
                        className={cn(
                          'text-[9px] font-bold uppercase tracking-wider transition-colors',
                          i === stepIdx ? 'text-[var(--color-text-accent)]' : i < stepIdx ? 'text-emerald-400' : 'text-[var(--color-text-muted)]'
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <motion.div
                        animate={{ background: i < stepIdx ? '#34d399' : 'var(--color-border)' }}
                        transition={{ duration: 0.5 }}
                        className="flex-1 h-px mx-2 mb-5 rounded-full"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 relative z-10 hide-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 14, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: -14, filter: 'blur(4px)' }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {step === 'preflight' && <PreflightStep checks={preflight} blockers={blockers} onFix={handleFix} />}
                  {step === 'version'   && <VersionStep app={app} bumpKind={bumpKind} setBumpKind={setBumpKind} />}
                  {step === 'platform'  && (
                    <PlatformStep
                      app={app}
                      platform={platform} setPlatform={setPlatform}
                      track={track} setTrack={setTrack}
                      rollout={rollout} setRollout={setRollout}
                      releaseNotes={releaseNotes} setReleaseNotes={setReleaseNotes}
                      useShorebird={useShorebird} setUseShorebird={setUseShorebird}
                      onShorebirdPatch={handleShorebirdPatch}
                    />
                  )}
                  {step === 'confirm' && <ConfirmStep app={app} platform={platform} bumpKind={bumpKind} track={track} rollout={rollout} useShorebird={useShorebird} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--color-border)] flex gap-3 flex-shrink-0 relative z-10">
              {step !== 'preflight' && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={prevStep}
                  className="flex-1 py-2.5 rounded-2xl text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] glass-xs hover:bg-[var(--color-border)] border border-[var(--color-border)] transition-all cursor-pointer"
                >
                  Back
                </motion.button>
              )}

              {step === 'confirm' ? (
                <motion.button
                  whileHover={!deploying && blockers.length === 0 ? { scale: 1.03, boxShadow: '0 0 28px rgba(99,102,241,0.55)' } : {}}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  onClick={handleDeploy}
                  disabled={deploying || blockers.length > 0}
                  className="flex-1 py-2.5 rounded-2xl text-[12px] font-bold text-white disabled:opacity-40 cursor-pointer relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                  {deploying ? (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <motion.svg
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </motion.svg>
                      Starting…
                    </span>
                  ) : (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Zap size={13} strokeWidth={2.5} fill="currentColor" />
                      Launch Deploy
                    </span>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={!(step === 'preflight' && blockers.length > 0) ? { scale: 1.03 } : {}}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  onClick={nextStep}
                  disabled={step === 'preflight' && blockers.length > 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-bold text-white disabled:opacity-40 cursor-pointer relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                  <span className="relative z-10">Continue</span>
                  <ChevronRight size={13} strokeWidth={2.5} className="relative z-10" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ─── Step Components ────────────────────────────── */

const staggerList = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}
const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const } },
}

const FIX_LABELS: Record<string, string> = {
  ios_key_id:    'Edit Credentials',
  ios_issuer_id: 'Edit Credentials',
  ios_team_id:   'Edit Credentials',
  ios_p8:        'Pick .p8 File',
  android_json:  'Pick JSON',
}

const TOOL_HINTS: Record<string, string> = {
  tool_flutter_ios:     'brew install --cask flutter',
  tool_flutter_android: 'brew install --cask flutter',
  tool_pod:             'brew install cocoapods',
  tool_fastlane:        'brew install fastlane',
  tool_xcodebuild:      'Install Xcode from the App Store',
}

function PreflightStep({ checks, blockers, onFix }: {
  checks: PreflightCheck[]
  blockers: PreflightCheck[]
  onFix: (checkId: string) => void
}): JSX.Element {
  if (checks.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-[var(--color-text-muted)]">
        <motion.svg
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </motion.svg>
        Running preflight checks…
      </div>
    )
  }

  return (
    <motion.div variants={staggerList} initial="hidden" animate="show" className="flex flex-col gap-2.5">
      {blockers.length > 0 && (
        <motion.div
          variants={staggerItem}
          className="rounded-xl px-3.5 py-3 text-[11px] font-semibold"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.22)', color: '#f87171' }}
        >
          {blockers.length} blocker{blockers.length > 1 ? 's' : ''} must be resolved before deploying
        </motion.div>
      )}

      {checks.map((c) => {
        const hasFix = !c.passed && !!FIX_LABELS[c.id]
        const toolHint = !c.passed && TOOL_HINTS[c.id]
        return (
          <motion.div key={c.id} variants={staggerItem} className="flex items-start gap-3 glass-xs rounded-xl px-3.5 py-3 border border-[var(--color-border)]">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{
                background: c.passed
                  ? 'rgba(52,211,153,0.12)'
                  : c.isBlocker
                  ? 'rgba(248,113,113,0.12)'
                  : 'rgba(251,191,36,0.12)',
                border: `1px solid ${c.passed ? 'rgba(52,211,153,0.25)' : c.isBlocker ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`,
              }}
            >
              {c.passed
                ? <Check size={9} color="#34d399" strokeWidth={3} />
                : <span style={{ color: c.isBlocker ? '#f87171' : '#fbbf24', fontSize: 10, fontWeight: 800 }}>!</span>
              }
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-[var(--color-text-primary)] font-medium">{c.label}</span>
                {hasFix && (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onFix(c.id)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: '#818cf8',
                    }}
                  >
                    {FIX_LABELS[c.id]}
                  </motion.button>
                )}
              </div>
              {c.message && (
                <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{c.message}</div>
              )}
              {toolHint && (
                <div
                  className="mt-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[10px] leading-none"
                  style={{ background: 'rgba(0,0,0,0.3)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.15)' }}
                >
                  {toolHint}
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

function VersionStep({ app, bumpKind, setBumpKind }: { app: LinkedApp; bumpKind: BumpKind; setBumpKind: (k: BumpKind) => void }): JSX.Element {
  const options: { kind: BumpKind; label: string; desc: string }[] = [
    { kind: 'none',       label: 'No change',         desc: 'Keep current version' },
    { kind: 'buildOnly',  label: 'Build number only',  desc: 'e.g. 1.2.3+42 → 1.2.3+43' },
    { kind: 'patch',      label: 'Patch',              desc: 'Bug fixes' },
    { kind: 'minor',      label: 'Minor',              desc: 'New features' },
    { kind: 'major',      label: 'Major',              desc: 'Breaking changes' },
  ]

  return (
    <motion.div variants={staggerList} initial="hidden" animate="show" className="flex flex-col gap-2.5">
      <motion.div variants={staggerItem} className="glass-xs rounded-xl px-3.5 py-3 border border-[var(--color-border)] mb-1">
        <span className="text-[11px] text-[var(--color-text-muted)]">Current version: </span>
        <span className="font-mono text-[12px] font-bold text-[var(--color-text-accent)]">{app.currentVersion}</span>
      </motion.div>

      {options.map((o) => {
        const preview = bump(app.currentVersion, o.kind)
        const selected = bumpKind === o.kind
        return (
          <motion.button
            key={o.kind}
            variants={staggerItem}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => setBumpKind(o.kind)}
            className={cn(
              'flex items-center justify-between px-3.5 py-3 rounded-2xl border text-left cursor-pointer transition-all',
              selected ? 'glass-accent' : 'glass-xs border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-border)]'
            )}
          >
            <div>
              <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {o.label}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{o.desc}</div>
            </div>
            <span className={cn('text-[11px] font-mono font-bold', selected ? 'text-[var(--color-accent-bright)]' : 'text-[var(--color-text-muted)]')}>
              {preview}
            </span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}

function PlatformStep({ app, platform, setPlatform, track, setTrack, rollout, setRollout, releaseNotes, setReleaseNotes, useShorebird, setUseShorebird, onShorebirdPatch }: {
  app: LinkedApp; platform: BuildPlatform; setPlatform: (p: BuildPlatform) => void
  track: string; setTrack: (t: string) => void
  rollout: number; setRollout: (v: number) => void
  releaseNotes: string; setReleaseNotes: (v: string) => void
  useShorebird: boolean; setUseShorebird: (v: boolean) => void
  onShorebirdPatch: () => void
}): JSX.Element {
  const showIOS     = app.projectType === 'flutter' || app.projectType === 'nativeIOS'
  const showAndroid = app.projectType === 'flutter' || app.projectType === 'nativeAndroid'
  const showCodePush = app.projectType === 'flutter' // Shorebird code-push is Flutter-only
  const tracks      = ['internal', 'alpha', 'beta', 'production']

  const PLAT_CONFIG: Partial<Record<BuildPlatform, { label: string; emoji: string }>> = {
    ios:     { label: 'iOS',           emoji: '' },
    android: { label: 'Android',       emoji: '' },
    both:    { label: 'iOS + Android', emoji: '' },
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Platform picker */}
      <div>
        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Platform</label>
        <div className="grid grid-cols-3 gap-2">
          {(['ios', 'android', 'both'] as BuildPlatform[]).map((p) => {
            if (p === 'ios'     && !showIOS)     return null
            if (p === 'android' && !showAndroid) return null
            const cfg = PLAT_CONFIG[p]!
            return (
              <motion.button
                key={p}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setPlatform(p)}
                className={cn(
                  'py-3 rounded-2xl text-[11px] font-bold border transition-all',
                  platform === p
                    ? 'glass-accent text-[var(--color-text-accent)]'
                    : 'glass-xs border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                )}
              >
                <div className="text-[16px] mb-1">{cfg.emoji || (p === 'ios' ? '🍎' : p === 'android' ? '🤖' : '📱')}</div>
                {cfg.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Code Push (Shorebird) */}
      {showCodePush && (
        <div>
          <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Code Push</label>
          <div className="glass-xs rounded-2xl border border-[var(--color-border)] p-3.5 flex flex-col gap-3.5">
            {/* Toggle row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">Build with Shorebird</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                  Patchable release — enables OTA code-push patches later.
                </div>
              </div>
              <GlassSwitch checked={useShorebird} onChange={setUseShorebird} label="Build with Shorebird patchable release" />
            </div>

            {/* Secondary OTA patch action */}
            <div className="pt-3 border-t border-[var(--color-border)]">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                onClick={onShorebirdPatch}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors"
                style={{
                  background: 'rgba(99,102,241,0.10)',
                  border: '1px solid rgba(99,102,241,0.24)',
                  color: '#818cf8',
                }}
              >
                <UploadCloud size={13} strokeWidth={2.5} />
                Push OTA Patch to latest release
              </motion.button>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-relaxed px-0.5">
                One-shot — skips the wizard and patches the current release in place. No store upload.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Android track */}
      {(platform === 'android' || platform === 'both') && (
        <div>
          <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Android track</label>
          <div className="flex glass-xs rounded-2xl overflow-hidden border border-[var(--color-border)] p-1 gap-1">
            {tracks.map((t) => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTrack(t)}
                className={cn(
                  'flex-1 py-2 text-[10px] font-bold rounded-xl transition-all capitalize',
                  track === t
                    ? 'text-[var(--color-text-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                )}
                style={track === t ? {
                  background: 'rgba(99,102,241,0.18)',
                  border: '1px solid rgba(99,102,241,0.28)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                } : {}}
              >
                {t}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Staged rollout */}
      {track === 'production' && (
        <div>
          <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
            Staged rollout — <span className="text-[var(--color-text-accent)]">{Math.round(rollout * 100)}%</span>
          </label>
          <input
            type="range" min={1} max={100}
            value={Math.round(rollout * 100)}
            onChange={(e) => setRollout(parseInt(e.target.value, 10) / 100)}
            className="w-full accent-indigo-500"
          />
        </div>
      )}

      {/* Release notes */}
      <div>
        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-2">
          Release notes <span className="normal-case font-normal opacity-60">(optional)</span>
        </label>
        <textarea
          value={releaseNotes}
          onChange={(e) => setReleaseNotes(e.target.value)}
          rows={4}
          placeholder="What's new in this release?"
          className="w-full px-3.5 py-3 rounded-2xl text-[12px] resize-none outline-none transition-all glass-xs border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20"
          style={{ background: 'var(--color-bg-input)', backdropFilter: 'blur(20px)' }}
        />
      </div>
    </div>
  )
}

/* Glass pill switch — matches the platform picker's glass-accent language. */
function GlassSwitch({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string
}): JSX.Element {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      whileTap={{ scale: 0.94 }}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full flex-shrink-0 cursor-pointer border transition-colors"
      style={{
        background: checked ? 'rgba(99,102,241,0.28)' : 'var(--color-border-subtle)',
        borderColor: checked ? 'rgba(99,102,241,0.45)' : 'var(--color-border)',
        boxShadow: checked ? 'inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
      }}
    >
      <span className="absolute inset-0 flex items-center px-1">
        <motion.span
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="w-4 h-4 rounded-full block"
          style={{
            background: checked ? '#fff' : 'var(--color-text-muted)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        />
      </span>
    </motion.button>
  )
}

function ConfirmStep({ app, platform, bumpKind, track, rollout, useShorebird }: {
  app: LinkedApp; platform: BuildPlatform; bumpKind: BumpKind; track: string; rollout: number; useShorebird: boolean
}): JSX.Element {
  const newVersion = bump(app.currentVersion, bumpKind)
  const rows: [string, string][] = [
    ['App',      app.name],
    ['Version',  newVersion !== app.currentVersion ? `${app.currentVersion} → ${newVersion}` : app.currentVersion],
    ['Platform', platform === 'both' ? 'iOS + Android' : platform === 'ios' ? 'iOS' : 'Android'],
    ['Builder',  useShorebird ? 'Shorebird (patchable)' : 'Standard'],
    ...(platform !== 'ios' ? [['Track', track] as [string, string]] : []),
    ...(track === 'production' ? [['Rollout', `${Math.round(rollout * 100)}%`] as [string, string]] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-xs rounded-2xl overflow-hidden border border-[var(--color-border)]">
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className="flex items-center justify-between px-4 py-3.5 text-[12px]"
            style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : undefined }}
          >
            <span className="text-[var(--color-text-muted)] font-medium">{k}</span>
            <span className="text-[var(--color-text-primary)] font-semibold">{v}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed px-0.5">
        This starts the build pipeline. The process cannot be undone once file uploads begin.
      </p>
    </div>
  )
}

export default DeployPanel
