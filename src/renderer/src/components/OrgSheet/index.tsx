import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, UploadCloud, Activity, ShieldCheck, Key, Smartphone, FileJson, Info, ExternalLink, AlertTriangle, Pencil } from 'lucide-react';
import { useOrgStore } from '../../stores/orgStore';
import { useUiStore } from '../../stores/uiStore';
import { ipc } from '../../lib/ipc';

interface CredState {
  iosKeyID: string
  iosIssuerID: string
  iosTeamID: string
  iosP8Path: string
  androidJsonPath: string
}

type InfoPanel = 'ios' | 'android' | null

const IOS_STEPS = [
  { n: 1, title: 'Open App Store Connect', body: 'Go to appstoreconnect.apple.com and sign in with your Apple ID.' },
  { n: 2, title: 'Users and Access → Integrations', body: 'In the top menu click "Users and Access", then select the "Integrations" tab on the left sidebar.' },
  { n: 3, title: 'Generate an API Key', body: 'Click "App Store Connect API" → "+" button. Give it a name and set role to "App Manager" or "Admin".' },
  { n: 4, title: 'Copy Key ID & Issuer ID', body: 'After creation, copy the Key ID (10-character code) and the Issuer ID (UUID at the top of the page).' },
  { n: 5, title: 'Download the .p8 file', body: 'Click "Download API Key" — you only get one chance. Save the AuthKey_XXXXXXXXXX.p8 file somewhere safe.' },
  { n: 6, title: 'Team ID', body: 'Go to developer.apple.com → Account → Membership. Your Team ID is the 10-character code next to your team name.' },
]

const ANDROID_STEPS = [
  { n: 1, title: 'Open Google Play Console', body: 'Go to play.google.com/console and sign in with your Google account.' },
  { n: 2, title: 'Setup API Access', body: 'In the left sidebar click "Setup" → "API access". If prompted, link to a Google Cloud project.' },
  { n: 3, title: 'Create a Service Account', body: 'Click "Create new service account". Follow the Google Cloud Console link that appears.' },
  { n: 4, title: 'In Google Cloud Console', body: 'Click "+ Create Service Account". Give it a name, then on Step 2 assign the role "Service Account User".' },
  { n: 5, title: 'Generate a JSON key', body: 'Open the service account → "Keys" tab → "Add Key" → "Create new key" → choose JSON. A .json file will download.' },
  { n: 6, title: 'Grant Play Console access', body: 'Back in Play Console, find the new service account in the list and click "Grant access". Set permissions to "Release manager".' },
]

function InfoPopover({ type, onClose }: { type: InfoPanel; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const isIos = type === 'ios'
  const steps = isIos ? IOS_STEPS : ANDROID_STEPS
  const title = isIos ? 'How to get iOS credentials' : 'How to get Android JSON key'
  const accentCls = isIos ? 'text-accent-bright border-accent/30 bg-accent/10' : 'text-green-400 border-green-500/30 bg-green-500/10'
  const iconColor = isIos ? 'text-accent-bright' : 'text-green-400'
  const url = isIos ? 'appstoreconnect.apple.com' : 'play.google.com/console'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 right-0 top-8 z-50 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Info size={13} className={iconColor} />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{title}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--color-border)] text-text-muted hover:text-[var(--color-text-primary)] transition-colors">
          <X size={12} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-3">
            <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold border ${accentCls}`}>
              {s.n}
            </span>
            <div>
              <p className="text-xs font-medium text-[var(--color-text-primary)] leading-none mb-0.5">{s.title}</p>
              <p className="text-[11px] text-text-muted leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-[var(--color-border)] flex items-center gap-1.5">
          <ExternalLink size={10} className="text-text-muted" />
          <span className="text-[10px] text-text-muted font-mono">{url}</span>
        </div>
      </div>
    </motion.div>
  )
}

function DiscardDialog({ onDiscard, onContinue }: { onDiscard: () => void; onContinue: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-l-none"
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-72 bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Discard changes?</h3>
              <p className="text-[11px] text-text-muted mt-0.5">Unsaved data will be lost.</p>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--color-border)] hover:bg-[var(--color-border-strong)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] transition-colors"
          >
            Continue Editing
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 transition-colors"
          >
            Discard
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function OrgSheet() {
  const isOrgSheetOpen = useUiStore((s) => s.isOrgSheetOpen);
  const selectedOrgId = useUiStore((s) => s.selectedOrgId);
  const setOrgSheetOpen = useUiStore((s) => s.setOrgSheetOpen);
  const openOrgSheet = useUiStore((s) => s.openOrgSheet);
  const { organizations, create, update } = useOrgStore();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoPath, setPhotoPath] = useState<string | undefined>(undefined);
  const [creds, setCreds] = useState<CredState>({
    iosKeyID: '', iosIssuerID: '', iosTeamID: '', iosP8Path: '', androidJsonPath: ''
  });
  const [infoOpen, setInfoOpen] = useState<InfoPanel>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  const isDirty = isEditing
    ? true
    : (name.trim() !== '' || !!photoPath || Object.values(creds).some((v) => v !== ''));

  const tryClose = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      setOrgSheetOpen(false);
    }
  };

  const forceClose = () => {
    setShowDiscard(false);
    setJustCreatedId(null);
    setOrgSheetOpen(false);
  };

  useEffect(() => {
    if (!isOrgSheetOpen) {
      setShowDiscard(false);
      setJustCreatedId(null);
      return;
    }
    if (selectedOrgId) {
      const org = organizations.find((o) => o.id === selectedOrgId);
      if (org) {
        setIsEditing(true);
        setName(org.name);
        setDescription('');
        setPhotoPath(org.photoPath);
        Promise.all([
          ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_key_id' }),
          ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_issuer_id' }),
          ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_team_id' }),
          ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'ios_p8_path' }),
          ipc.invoke<string | null>('keychain:get', { orgId: selectedOrgId, field: 'android_json_path' }),
        ]).then(([iosKeyID, iosIssuerID, iosTeamID, iosP8Path, androidJsonPath]) => {
          setCreds({
            iosKeyID: iosKeyID ?? '',
            iosIssuerID: iosIssuerID ?? '',
            iosTeamID: iosTeamID ?? '',
            iosP8Path: iosP8Path ?? '',
            androidJsonPath: androidJsonPath ?? '',
          });
        });
      }
    } else {
      setIsEditing(false);
      setName('');
      setDescription('');
      setPhotoPath(undefined);
      setCreds({ iosKeyID: '', iosIssuerID: '', iosTeamID: '', iosP8Path: '', androidJsonPath: '' });
    }
    setInfoOpen(null);
  }, [selectedOrgId, isOrgSheetOpen, organizations]);

  const pickLogo = async () => {
    const path = await ipc.invoke<string | null>('system:pick-file', {
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (path) setPhotoPath(path);
  };

  const pickP8 = async () => {
    const path = await ipc.invoke<string | null>('system:pick-file', {
      filters: [{ name: 'API Key', extensions: ['p8'] }]
    });
    if (path) setCreds((c) => ({ ...c, iosP8Path: path }));
  };

  const pickAndroidJson = async () => {
    const path = await ipc.invoke<string | null>('system:pick-file', {
      filters: [{ name: 'Service Account JSON', extensions: ['json'] }]
    });
    if (path) setCreds((c) => ({ ...c, androidJsonPath: path }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const credentials = {
      iosKeyID: creds.iosKeyID || undefined,
      iosIssuerID: creds.iosIssuerID || undefined,
      iosTeamID: creds.iosTeamID || undefined,
      iosP8Path: creds.iosP8Path || undefined,
      androidJsonPath: creds.androidJsonPath || undefined,
    };
    if (isEditing && selectedOrgId) {
      await update(selectedOrgId, name, photoPath, credentials);
      setOrgSheetOpen(false);
    } else {
      const org = await create(name, photoPath, credentials);
      setJustCreatedId(org.id);
    }
  };

  const fileName = (p: string) => p.split('/').pop() ?? p;

  return (
    <AnimatePresence>
      {isOrgSheetOpen && (
        <>
          {/* Backdrop — intercept click to check dirty */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 app-no-drag"
            onClick={tryClose}
          />

          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[450px] bg-[var(--color-bg-base)] border-l border-[var(--color-border-strong)] z-50 flex flex-col shadow-2xl app-no-drag"
          >
            {/* Discard confirmation overlay */}
            <AnimatePresence>
              {showDiscard && (
                <DiscardDialog
                  onDiscard={forceClose}
                  onContinue={() => setShowDiscard(false)}
                />
              )}
            </AnimatePresence>

            {/* Success banner after create */}
            <AnimatePresence>
              {justCreatedId && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="absolute top-0 left-0 right-0 z-50 bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-medium text-emerald-300">Organization created!</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setJustCreatedId(null);
                        openOrgSheet(justCreatedId);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/20 transition-colors"
                    >
                      <Pencil size={11} />
                      Edit details
                    </button>
                    <button
                      onClick={() => { setJustCreatedId(null); setOrgSheetOpen(false); }}
                      className="p-1 rounded-md hover:bg-[var(--color-border)] text-text-muted hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className={`flex items-center justify-between p-6 pb-4 border-b border-[var(--color-border)] relative overflow-hidden transition-all ${justCreatedId ? 'mt-[52px]' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent opacity-50" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 glow-accent">
                  <Building2 size={20} className="text-accent-bright" />
                </div>
                <div>
                  <h2 className="text-xl font-medium text-[var(--color-text-primary)] tracking-tight">
                    {isEditing ? 'Edit Organization' : 'Create Organization'}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">Manage billing, team & settings</p>
                </div>
              </div>
              <button
                onClick={tryClose}
                className="relative z-10 p-2 rounded-full hover:bg-[var(--color-border)] text-text-muted hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-8">
              {/* Logo */}
              <div className="flex items-start gap-5">
                <button
                  type="button"
                  onClick={pickLogo}
                  className="h-20 w-20 rounded-2xl border border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center bg-[var(--color-bg-input)] text-text-muted hover:bg-[var(--color-border)] hover:border-accent/40 hover:text-accent-bright transition-all cursor-pointer group relative overflow-hidden flex-shrink-0"
                >
                  {photoPath ? (
                    <img src={`local-file://${photoPath}`} className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    <>
                      <UploadCloud size={24} className="mb-1 group-hover:-translate-y-1 transition-transform" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Upload</span>
                    </>
                  )}
                  <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                </button>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Organization Logo</h3>
                  <p className="text-xs text-text-muted mt-1 mb-3">Recommended 256×256px. JPG, PNG, WEBP.</p>
                  <button
                    type="button"
                    onClick={pickLogo}
                    className="px-3 py-1.5 bg-[var(--color-border)] hover:bg-[var(--color-border-strong)] rounded-md text-xs font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-strong)]"
                  >
                    {photoPath ? 'Change Image' : 'Select Image'}
                  </button>
                  {photoPath && (
                    <p className="text-[11px] text-text-muted mt-1.5 truncate max-w-[220px]">{fileName(photoPath)}</p>
                  )}
                </div>
              </div>

              <form id="org-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5 uppercase tracking-wider">
                    <Building2 size={12} /> Organization Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-strong)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5 uppercase tracking-wider">
                    <Activity size={12} /> Description
                    <span className="text-text-muted ml-auto font-normal lowercase tracking-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does your organization do?"
                    rows={2}
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-strong)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all resize-none"
                  />
                </div>

                {/* iOS Credentials */}
                <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
                  <div className="relative flex items-center gap-2 mb-1">
                    <Smartphone size={14} className="text-accent-bright" />
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">iOS Credentials</span>
                    <span className="text-[10px] text-text-muted">(App Store Connect API)</span>
                    <button
                      type="button"
                      onClick={() => setInfoOpen(infoOpen === 'ios' ? null : 'ios')}
                      className={`ml-auto p-1 rounded-md transition-colors ${infoOpen === 'ios' ? 'bg-accent/20 text-accent-bright' : 'text-text-muted hover:text-accent-bright hover:bg-accent/10'}`}
                      title="How to get iOS credentials"
                    >
                      <Info size={13} />
                    </button>
                    <AnimatePresence>
                      {infoOpen === 'ios' && (
                        <InfoPopover type="ios" onClose={() => setInfoOpen(null)} />
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider flex items-center gap-1">
                        <Key size={10} /> Key ID
                      </label>
                      <input
                        type="text"
                        value={creds.iosKeyID}
                        onChange={(e) => setCreds((c) => ({ ...c, iosKeyID: e.target.value }))}
                        placeholder="XXXXXXXXXX"
                        className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-accent/50 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Team ID</label>
                      <input
                        type="text"
                        value={creds.iosTeamID}
                        onChange={(e) => setCreds((c) => ({ ...c, iosTeamID: e.target.value }))}
                        placeholder="XXXXXXXXXX"
                        className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-accent/50 font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Issuer ID</label>
                    <input
                      type="text"
                      value={creds.iosIssuerID}
                      onChange={(e) => setCreds((c) => ({ ...c, iosIssuerID: e.target.value }))}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-accent/50 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">.p8 Auth Key File</label>
                    <button
                      type="button"
                      onClick={pickP8}
                      className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-xs text-left flex items-center gap-2 hover:border-[var(--color-border-strong)] transition-colors"
                    >
                      <Key size={11} className="text-text-muted flex-shrink-0" />
                      <span className={creds.iosP8Path ? 'text-[var(--color-text-primary)] font-mono truncate' : 'text-text-muted/50'}>
                        {creds.iosP8Path ? fileName(creds.iosP8Path) : 'Choose AuthKey_XXXXXXXX.p8…'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Android Credentials */}
                <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
                  <div className="relative flex items-center gap-2 mb-1">
                    <FileJson size={14} className="text-green-400" />
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Android Credentials</span>
                    <span className="text-[10px] text-text-muted">(Google Play)</span>
                    <button
                      type="button"
                      onClick={() => setInfoOpen(infoOpen === 'android' ? null : 'android')}
                      className={`ml-auto p-1 rounded-md transition-colors ${infoOpen === 'android' ? 'bg-green-500/20 text-green-400' : 'text-text-muted hover:text-green-400 hover:bg-green-500/10'}`}
                      title="How to get Android credentials"
                    >
                      <Info size={13} />
                    </button>
                    <AnimatePresence>
                      {infoOpen === 'android' && (
                        <InfoPopover type="android" onClose={() => setInfoOpen(null)} />
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Service Account JSON</label>
                    <button
                      type="button"
                      onClick={pickAndroidJson}
                      className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-xs text-left flex items-center gap-2 hover:border-[var(--color-border-strong)] transition-colors"
                    >
                      <FileJson size={11} className="text-text-muted flex-shrink-0" />
                      <span className={creds.androidJsonPath ? 'text-[var(--color-text-primary)] font-mono truncate' : 'text-text-muted/50'}>
                        {creds.androidJsonPath ? fileName(creds.androidJsonPath) : 'Choose service-account.json…'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex gap-3">
                    <ShieldCheck size={20} className="text-accent-bright shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-accent-bright">Secure Storage</h4>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        API keys and credentials are stored in macOS <strong>Keychain</strong> — never in plain text on disk.
                      </p>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-bg-base)] backdrop-blur-xl flex justify-between items-center">
              <button
                type="button"
                onClick={tryClose}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="org-form"
                disabled={!name.trim()}
                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-bright text-white disabled:opacity-50 disabled:hover:bg-accent transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              >
                {isEditing ? 'Save Changes' : 'Create Organization'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
