export type ProjectType = 'flutter' | 'nativeIOS' | 'nativeAndroid'
export type BuildPlatform = 'ios' | 'android' | 'both'
export type BuildResult = 'success' | 'failed' | 'cancelled' | 'running'
export type BuildTrigger = 'manual'
export type BumpKind = 'none' | 'buildOnly' | 'patch' | 'minor' | 'major'
export type ToolName = 'homebrew' | 'ruby' | 'fastlane' | 'python3' | 'googleApi' | 'cocoapods' | 'flutter' | 'xcode' | 'shorebird'
export type ToolState = 'checking' | 'found' | 'missing' | 'installing' | 'failed'
export type ReleaseStatus = 'draft' | 'inProgress' | 'halted' | 'completed' | 'unknown'
export type CheckpointState = 'pending' | 'running' | 'done' | 'failed'
export type LogLineKind = 'step' | 'output' | 'error' | 'success'

export interface Organisation {
  id: string
  name: string
  photoPath?: string
  iosKeyID?: string
  iosIssuerID?: string
  iosTeamID?: string
  androidJsonPath?: string
  createdAt: string
}

export interface LinkedApp {
  id: string
  organisationId: string
  dirPath: string
  name: string
  bundleID?: string
  packageName?: string
  currentVersion: string
  projectType: ProjectType
  xcodeSchemeName?: string
  iconPath?: string
  iconData?: string
  linkedAt: string
  lastDeployAt?: string
}

export interface BuildRun {
  id: string
  appId: string
  platform: BuildPlatform
  version: string
  track?: string
  startedAt: string
  endedAt?: string
  durationSeconds?: number
  result: BuildResult
  iosResult?: BuildResult
  androidResult?: BuildResult
  logPath: string
  trigger: BuildTrigger
}

export interface BuildCheckpoint {
  id: string
  label: string
  platform: 'ios' | 'android'
  state: CheckpointState
}

export interface LogLine {
  id: string
  kind: LogLineKind
  text: string
  platform: 'ios' | 'android'
}

export interface ToolStatus {
  name: ToolName
  state: ToolState
  version?: string
}

export interface TrackRelease {
  name?: string
  versionCodes: string[]
  status: ReleaseStatus
  userFraction?: number
}

export interface TrackInfo {
  track: string
  releases: TrackRelease[]
}

export interface PreflightCheck {
  id: string
  label: string
  passed: boolean
  isBlocker: boolean
  message?: string
}

export interface DetectedMetadata {
  name: string
  version: string
  projectType: ProjectType
  bundleID?: string
  packageName?: string
  schemeName?: string
  iconPath?: string
}

export interface IOSAppVersion {
  versionString: string
  state: string
  createdDate?: string
}

export interface IOSTestFlightBuild {
  buildNumber: string
  version: string
  uploadedDate?: string
  processingState: string
}

export interface IOSStoreStatus {
  appStoreVersions: IOSAppVersion[]
  testFlightBuilds: IOSTestFlightBuild[]
}

export interface AppStoreStatus {
  android?: TrackInfo[]
  ios?: IOSStoreStatus
  fetchedAt: string
}

export interface OrgCredentials {
  iosKeyID?: string
  iosIssuerID?: string
  iosTeamID?: string
  iosP8Path?: string
  androidJsonPath?: string
}
