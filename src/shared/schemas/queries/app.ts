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

// SPEC 4.3 app.getState.
export type AppState = {
  settings: Settings
  recentProjects: RecentProject[]
  openProjects: OpenProjectSummary[]
  providers: ProviderInfo[]
  secrets: SecretSummary[]
}
