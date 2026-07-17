import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useToolStore } from '../../stores/toolStore'
import { useAppStore } from '../../stores/appStore'
import type { ToolStatus } from '../../../../shared/types/models'

const TOOL_LABELS: Record<string, string> = {
  homebrew: 'Homebrew',
  ruby: 'Ruby',
  fastlane: 'Fastlane',
  python3: 'Python 3',
  googleApi: 'Google API Client',
  cocoapods: 'CocoaPods',
  flutter: 'Flutter',
  xcode: 'Xcode CLI'
}

const STEPS = ['Welcome', 'Detect', 'Install', 'Verify', 'Done'] as const
type Step = (typeof STEPS)[number]

const btn = {
  whileTap: { scale: 0.96 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 25 }
}

const toolsContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } }
}
const toolItem = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const } }
}

export function SetupWizard(): JSX.Element {
  const navigate = useNavigate()
  const { markSetupComplete } = useAppStore()
  const [step, setStep] = useState<Step>('Welcome')
  const { tools, checking, checkAll, repairAll } = useToolStore()
  const hasBlocker = tools.some((t) => t.name === 'homebrew' && t.state === 'missing')

  useEffect(() => {
    if (step === 'Detect') checkAll().then(() => setStep('Install'))
    if (step === 'Verify') checkAll().then(() => setStep('Done'))
  }, [step])

  const handleComplete = async () => {
    await markSetupComplete()
    navigate('/workspace')
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-12" style={{ background: 'var(--color-bg-base)' }}>
      <div className="app-drag fixed top-0 left-0 right-0 h-10" />

      {/* Step progress dots */}
      <div className="flex items-center gap-2 mt-8">
        {STEPS.map((s, i) => {
          const done = STEPS.indexOf(step) > i
          const active = s === step
          return (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                animate={{
                  scale: active ? 1.4 : done ? 1.1 : 1,
                  backgroundColor: active
                    ? 'var(--color-accent)'
                    : done
                    ? 'var(--color-success)'
                    : 'var(--color-text-muted)'
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-2 h-2 rounded-full"
              />
              {i < STEPS.length - 1 && (
                <motion.div
                  className="w-8 h-px"
                  animate={{ backgroundColor: done ? 'var(--color-success)' : 'var(--color-border)' }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </div>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg"
        >
          {step === 'Welcome' && <WelcomeStep onNext={() => setStep('Detect')} />}
          {(step === 'Detect' || step === 'Install') && (
            <InstallStep tools={tools} checking={checking} hasBlocker={hasBlocker} onRepair={repairAll} onNext={() => setStep('Verify')} />
          )}
          {step === 'Verify' && (
            <div className="flex flex-col items-center gap-4 text-center py-8">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={28} className="text-[var(--color-accent)]" />
              </motion.div>
              <p className="text-sm text-[var(--color-text-secondary)]">Verifying installation…</p>
            </div>
          )}
          {step === 'Done' && <DoneStep tools={tools} onComplete={handleComplete} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default SetupWizard

function WelcomeStep({ onNext }: { onNext: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
        className="relative"
      >
        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-2xl" />
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10"
          style={{ background: 'var(--color-accent-dim)', border: '1px solid var(--color-border-strong)' }}
        >
          <Rocket size={28} className="text-[var(--color-accent-bright)]" />
        </div>
      </motion.div>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Welcome to Droploid</h1>
        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
          Deploy Flutter and native iOS/Android apps without touching a terminal.<br />
          Let's set up your environment first.
        </p>
      </div>
      <motion.button
        {...btn}
        whileHover={{ scale: 1.03, boxShadow: '0 0 18px rgba(99,102,241,0.4)' }}
        onClick={onNext}
        className="px-6 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
        style={{ background: 'var(--color-accent)' }}
      >
        Get Started
      </motion.button>
    </div>
  )
}

function InstallStep({ tools, checking, hasBlocker, onRepair, onNext }: {
  tools: ToolStatus[]
  checking: boolean
  hasBlocker: boolean
  onRepair: () => Promise<void>
  onNext: () => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Development Tools</h2>
      <AnimatePresence>
        {hasBlocker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 rounded-lg text-sm overflow-hidden"
            style={{ background: 'var(--color-error-dim)', border: '1px solid var(--color-error)', color: 'var(--color-error)' }}
          >
            Homebrew is required but not installed. Install it from <span className="font-mono text-xs">brew.sh</span> then click Repair.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
        {tools.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-[var(--color-text-muted)] text-sm">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Loader2 size={14} />
            </motion.div>
            Scanning…
          </div>
        ) : (
          <motion.div variants={toolsContainer} initial="hidden" animate="show">
            {tools.map((t, i) => (
              <motion.div
                key={t.name}
                variants={toolItem}
                className={`flex items-center justify-between px-4 py-3 ${i < tools.length - 1 ? 'border-b' : ''}`}
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="text-sm text-[var(--color-text-primary)]">{TOOL_LABELS[t.name]}</span>
                <ToolBadge status={t} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <div className="flex gap-3">
        <motion.button
          {...btn}
          whileHover={{ scale: 1.02 }}
          onClick={onRepair}
          disabled={checking}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 cursor-pointer"
          style={{ background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={13} />
              </motion.div>
              Repairing…
            </span>
          ) : 'Repair All'}
        </motion.button>
        <motion.button
          {...btn}
          whileHover={{ scale: 1.02, boxShadow: '0 0 14px rgba(99,102,241,0.35)' }}
          onClick={onNext}
          disabled={hasBlocker}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 cursor-pointer"
          style={{ background: 'var(--color-accent)' }}
        >
          Continue
        </motion.button>
      </div>
    </div>
  )
}

function DoneStep({ tools, onComplete }: { tools: ToolStatus[]; onComplete: () => Promise<void> }): JSX.Element {
  const missing = tools.filter((t) => t.state === 'missing')
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
      >
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-full blur-xl"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ background: 'var(--color-success)' }}
          />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center relative z-10"
            style={{ background: 'var(--color-success-dim)', border: '1px solid var(--color-success)' }}
          >
            <CheckCircle size={28} className="text-[var(--color-success)]" />
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Ready to deploy</h2>
        {missing.length > 0 && (
          <p className="text-[var(--color-text-secondary)] text-sm">
            {missing.length} optional tool{missing.length > 1 ? 's' : ''} missing — install later from Settings.
          </p>
        )}
      </motion.div>
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        {...btn}
        whileHover={{ scale: 1.04, boxShadow: '0 0 20px rgba(99,102,241,0.45)' }}
        onClick={onComplete}
        className="px-8 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
        style={{ background: 'var(--color-accent)' }}
      >
        Open Droploid
      </motion.button>
    </div>
  )
}

function ToolBadge({ status }: { status: ToolStatus }): JSX.Element {
  if (status.state === 'checking') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Loader2 size={11} />
        </motion.div>
        Checking…
      </span>
    )
  }
  if (status.state === 'installing') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Loader2 size={11} />
        </motion.div>
        Installing…
      </span>
    )
  }
  if (status.state === 'found') {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-1.5"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"
        />
        <span className="text-xs text-[var(--color-text-secondary)] font-mono">{status.version?.split('\n')[0].slice(0, 30)}</span>
      </motion.div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-error)]" />
      <span className="text-xs text-[var(--color-error)]">Missing</span>
    </div>
  )
}
