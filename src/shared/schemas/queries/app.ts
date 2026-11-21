import type { Settings, RecentProject } from '../settings'
import type { SecretName, SecretSummary } from '../secrets'
import type { OpenProjectSummary } from '../project'

// SPEC 6 ProviderInfo, as the window receives it.
export type ProviderJob = 'image' | 'layout' | 'text' | 'video' | 'storage' | 'verification'
export type ProviderInfo = {
  id: string
  label: string
  jobs: ProviderJob[]
  available: boolean
  secrets: SecretName[]
  defaultModels: Record<string, string>
}

// SPEC 6 ProviderError: the error kind and the raw text for the log.
export const PROVIDER_ERROR_KINDS = [
  'bad_key',
  'quota',
  'refused',
  'timeout',
  'offline',
  'other',
] as const
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number]
export type ProviderError = { kind: ProviderErrorKind; detail: string }

// SPEC 4.3 app.getState.
export type AppState = {
  settings: Settings
  recentProjects: RecentProject[]
  openProjects: OpenProjectSummary[]
  providers: ProviderInfo[]
  secrets: SecretSummary[]
  devTools: boolean // hand-test tools on (SPEC 13, ADMAN_DEV_TOOLS)
}
