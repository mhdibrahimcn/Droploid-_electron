import Store from 'electron-store'
import type { Organisation, LinkedApp, BuildRun } from '../../shared/types/models'

interface StoreSchema {
  setup_complete: boolean
  user_name: string
  log_retention_days: number
  organisations: Organisation[]
  apps: LinkedApp[]
  build_runs: BuildRun[]
}

const defaults: StoreSchema = {
  setup_complete: false,
  user_name: '',
  log_retention_days: 90,
  organisations: [],
  apps: [],
  build_runs: []
}

export const store = new Store<StoreSchema>({ defaults })

export function pruneOldBuildRuns(): void {
  const days = store.get('log_retention_days', 90)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const runs = store.get('build_runs', [])
  store.set(
    'build_runs',
    runs.filter((r) => new Date(r.startedAt).getTime() > cutoff)
  )
}
