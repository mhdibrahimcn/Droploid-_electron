import type {
  Organisation,
  LinkedApp,
  BuildRun,
  BuildPlatform,
  BumpKind,
  ToolStatus,
  TrackInfo,
  PreflightCheck,
  DetectedMetadata,
  OrgCredentials,
  BuildCheckpoint,
  LogLine
} from './models'

// Main→Renderer push events
export interface IPCEvents {
  'build:log-line': LogLine
  'build:checkpoint': BuildCheckpoint
  'build:complete': { runId: string; result: import('./models').BuildResult; iosResult?: import('./models').BuildResult; androidResult?: import('./models').BuildResult }
  'tools:status-update': ToolStatus
  'promote:log-line': { text: string }
  'promote:complete': { success: boolean; error?: string }
}

// Renderer→Main invoke channels
export interface IPCInvokeMap {
  // org
  'org:list': [void, Organisation[]]
  'org:create': [{ name: string; photoPath?: string; credentials: OrgCredentials }, Organisation]
  'org:update': [{ id: string; name?: string; photoPath?: string; credentials?: OrgCredentials }, Organisation]
  'org:delete': [{ id: string }, void]

  // app
  'app:list': [{ orgId: string }, LinkedApp[]]
  'app:link': [{ orgId: string; dirPath: string }, LinkedApp]
  'app:unlink': [{ id: string }, void]
  'app:detect': [{ dirPath: string }, DetectedMetadata]

  // build
  'build:start': [{ appId: string; platform: BuildPlatform; bumpKind: BumpKind; track: string; rollout?: number; releaseNotes?: string; useShorebird?: boolean }, { runId: string }]
  'build:cancel': [{ runId: string }, void]
  // Shorebird OTA patch (standalone, no store upload). Streams over 'build:log-line'.
  'build:shorebird-patch': [{ appId: string; platform: BuildPlatform }, { runId: string; ios?: boolean; android?: boolean }]
  'build:history': [{ appId: string }, BuildRun[]]
  'build:preflight': [{ appId: string; orgId: string; platform: BuildPlatform }, PreflightCheck[]]
  'build:tracks': [{ packageName: string; jsonKeyPath: string }, TrackInfo[]]
  'build:promote': [{ packageName: string; jsonKeyPath: string; fromTrack: string; toTrack: string }, void]

  // tools
  'tools:check': [void, ToolStatus[]]
  'tools:install': [{ name: string }, void]
  'tools:repair': [void, void]

  // keychain
  'keychain:set': [{ orgId: string; field: string; value: string }, void]
  'keychain:get': [{ orgId: string; field: string }, string | null]
  'keychain:delete-org': [{ orgId: string }, void]

  // system
  'system:pick-folder': [void, string | null]
  'system:pick-file': [{ filters?: { name: string; extensions: string[] }[] }, string | null]
  'system:open-finder': [{ path: string }, void]
  'system:notify': [{ title: string; body: string }, void]

  // store
  'store:get': [{ key: string }, unknown]
  'store:set': [{ key: string; value: unknown }, void]
}

export type IPCChannel = keyof IPCInvokeMap
export type IPCEventChannel = keyof IPCEvents
