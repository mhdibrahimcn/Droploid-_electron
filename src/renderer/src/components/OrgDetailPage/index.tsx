import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, CheckCircle2, XCircle, Key, Smartphone, FileJson, AlertCircle, Rocket } from 'lucide-react'
import { useOrgStore } from '../../stores/orgStore'
import { useUIStore } from '../../stores/uiStore'
import { ipc } from '../../lib/ipc'
import { nameColor, initials } from '../../lib/utils'

interface CredStatus {
  iosKeyID: boolean
  iosIssuerID: boolean
  iosTeamID: boolean
  iosP8Path: boolean
  androidJsonPath: boolean
  loading: boolean
}

const cardStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
}
const cardItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const } }
}
const rowStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } }
}
const rowItem = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const } }
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <motion.div variants={rowItem} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-xs text-text-secondary">{label}</span>
      <AnimatePresence mode="wait">
        {ok ? (
          <motion.div
            key="ok"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex items-center gap-1.5"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-medium">Set</span>
          </motion.div>
        ) : (
          <motion.div
            key="missing"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex items-center gap-1.5"
          >
            <XCircle size={13} className="text-red-400/70" />
            <span className="text-[11px] text-red-400/70 font-medium">Missing</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function OrgDetailPage() {
  const { orgs, selectedOrgId } = useOrgStore()
  const { openOrgSheet } = useUIStore()
  const org = orgs.find((o) => o.id === selectedOrgId) ?? null

  const [creds, setCreds] = useState<CredStatus>({
    iosKeyID: false, iosIssuerID: false, iosTeamID: false,
    iosP8Path: false, androidJsonPath: false, loading: true
  })

  useEffect(() => {
    if (!selectedOrgId) return
    setCreds((c) => ({ ...c, loading: true }))
    Promise.all([
      ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_key_id' }),
      ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_issuer_id' }),
      ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_team_id' }),
      ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_p8_path' }),
      ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'android_json_path' }),
    ]).then(([iosKeyID, iosIssuerID, iosTeamID, iosP8Path, androidJsonPath]) => {
      setCreds({
        iosKeyID: !!iosKeyID,
        iosIssuerID: !!iosIssuerID,
        iosTeamID: !!iosTeamID,
        iosP8Path: !!iosP8Path,
        androidJsonPath: !!androidJsonPath,
        loading: false,
      })
    })
  }, [selectedOrgId])

  if (!org) return null

  const iosReady = creds.iosKeyID && creds.iosIssuerID && creds.iosTeamID && creds.iosP8Path
  const androidReady = creds.androidJsonPath

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="h-full overflow-y-auto px-8 py-8"
    >
      <motion.div variants={cardStagger} initial="hidden" animate="show" className="max-w-xl mx-auto space-y-6">
        {/* Org header */}
        <motion.div variants={cardItem} className="flex items-center gap-5">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex-shrink-0"
          >
            {org.photoPath ? (
              <img
                src={`local-file://${org.photoPath}`}
                className="w-16 h-16 rounded-2xl object-cover border border-[var(--color-border-strong)] shadow-lg"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg border border-[var(--color-border-strong)]"
                style={{ background: nameColor(org.name), color: '#fff' }}
              >
                {initials(org.name).slice(0, 1)}
              </div>
            )}
          </motion.div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight truncate">{org.name}</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Created {new Date(org.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            onClick={() => openOrgSheet(org.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-border)] hover:bg-[var(--color-border-strong)] border border-[var(--color-border-strong)] text-xs font-medium text-[var(--color-text-primary)] flex-shrink-0 cursor-pointer"
          >
            <Pencil size={12} />
            Edit
          </motion.button>
        </motion.div>

        {/* Deploy readiness banner */}
        <AnimatePresence>
          {!creds.loading && (iosReady || androidReady) && (
            <motion.div
              variants={cardItem}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
            >
              <Rocket size={15} className="text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-300">
                Ready to deploy on{' '}
                <strong>{[iosReady && 'iOS', androidReady && 'Android'].filter(Boolean).join(' & ')}</strong>
              </p>
            </motion.div>
          )}
          {!creds.loading && !iosReady && !androidReady && (
            <motion.div
              variants={cardItem}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20"
            >
              <AlertCircle size={15} className="text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-yellow-300">
                Add credentials below to enable deployments.{' '}
                <button onClick={() => openOrgSheet(org.id)} className="underline underline-offset-2 hover:text-yellow-200 transition-colors cursor-pointer">
                  Edit organization →
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* iOS credentials card */}
        <motion.div variants={cardItem} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-border-subtle)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Smartphone size={14} className="text-accent-bright" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">iOS</p>
                <p className="text-[10px] text-text-muted">App Store Connect API</p>
              </div>
            </div>
            <motion.div
              animate={{
                backgroundColor: creds.loading ? 'rgba(255,255,255,0.05)' : iosReady ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
              }}
              transition={{ duration: 0.3 }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${iosReady ? 'text-emerald-400 border border-emerald-500/20' : 'text-red-400 border border-red-500/20'}`}
            >
              {creds.loading ? '…' : iosReady ? 'Ready' : 'Incomplete'}
            </motion.div>
          </div>
          <motion.div variants={rowStagger} initial="hidden" animate="show" className="px-5 py-1">
            <StatusRow label="Key ID" ok={creds.iosKeyID} />
            <StatusRow label="Issuer ID" ok={creds.iosIssuerID} />
            <StatusRow label="Team ID" ok={creds.iosTeamID} />
            <StatusRow label=".p8 Auth Key file" ok={creds.iosP8Path} />
          </motion.div>
          {!iosReady && !creds.loading && (
            <div className="px-5 pb-4 pt-1">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => openOrgSheet(org.id)}
                className="w-full py-2 rounded-xl text-xs font-medium text-accent-bright border border-accent/20 hover:bg-accent/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Key size={11} />
                Add iOS credentials
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Android credentials card */}
        <motion.div variants={cardItem} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-border-subtle)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <FileJson size={14} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Android</p>
                <p className="text-[10px] text-text-muted">Google Play Service Account</p>
              </div>
            </div>
            <motion.div
              animate={{
                backgroundColor: creds.loading ? 'rgba(255,255,255,0.05)' : androidReady ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
              }}
              transition={{ duration: 0.3 }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${androidReady ? 'text-emerald-400 border border-emerald-500/20' : 'text-red-400 border border-red-500/20'}`}
            >
              {creds.loading ? '…' : androidReady ? 'Ready' : 'Incomplete'}
            </motion.div>
          </div>
          <motion.div variants={rowStagger} initial="hidden" animate="show" className="px-5 py-1">
            <StatusRow label="Service Account JSON" ok={creds.androidJsonPath} />
          </motion.div>
          {!androidReady && !creds.loading && (
            <div className="px-5 pb-4 pt-1">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={() => openOrgSheet(org.id)}
                className="w-full py-2 rounded-xl text-xs font-medium text-green-400 border border-green-500/20 hover:bg-green-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileJson size={11} />
                Add Android credentials
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
