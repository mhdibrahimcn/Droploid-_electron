import { create } from 'zustand'
import type { BuildPlatform, BumpKind, PreflightCheck } from '../../../shared/types/models'

type DeployStep = 'preflight' | 'version' | 'platform' | 'confirm'

interface DeployWizardState {
  step: DeployStep
  preflight: PreflightCheck[]
  bumpKind: BumpKind
  platform: BuildPlatform
  track: string
  rollout: number
  releaseNotes: string
  useShorebird: boolean
  deploying: boolean

  setStep: (s: DeployStep) => void
  setPreflight: (checks: PreflightCheck[]) => void
  setBumpKind: (k: BumpKind) => void
  setPlatform: (p: BuildPlatform) => void
  setTrack: (t: string) => void
  setRollout: (v: number) => void
  setReleaseNotes: (v: string) => void
  setUseShorebird: (v: boolean) => void
  setDeploying: (v: boolean) => void
  reset: () => void
}

const initialState = {
  step: 'preflight' as DeployStep,
  preflight: [] as PreflightCheck[],
  bumpKind: 'buildOnly' as BumpKind,
  platform: 'both' as BuildPlatform,
  track: 'internal',
  rollout: 0.1,
  releaseNotes: '',
  useShorebird: false,
  deploying: false,
}

export const useDeployWizardStore = create<DeployWizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setPreflight: (preflight) => set({ preflight }),
  setBumpKind: (bumpKind) => set({ bumpKind }),
  setPlatform: (platform) => set({ platform }),
  setTrack: (track) => set({ track }),
  setRollout: (rollout) => set({ rollout }),
  setReleaseNotes: (releaseNotes) => set({ releaseNotes }),
  setUseShorebird: (useShorebird) => set({ useShorebird }),
  setDeploying: (deploying) => set({ deploying }),
  reset: () => set(initialState),
}))
