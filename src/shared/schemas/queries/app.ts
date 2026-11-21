import type { Settings, RecentProject } from '@/shared/schemas/settings'
import type { SecretName, SecretSummary } from '@/shared/schemas/secrets'
import type { OpenProjectSummary } from '@/shared/schemas/project'

// SPEC 6 ProviderInfo, as the window receives it.
export type ProviderJob =
  'image' | 'layout' | 'text' | 'video' | 'cutout' | 'storage' | 'verification'
export type ProviderInfo = {
  id: string
  label: string
  jobs: ProviderJob[]
  available: boolean
  secrets: SecretName[]
  defaultModels: Record<string, string>
  // [1.24] SPEC 6.11.1: local runs are never counted in paid_calls; how a started run can be
  // stopped; whether the server's own words may be shown on request (ComfyUI only).
  local: boolean
  cancel: ProviderCancel
  serverText: boolean
}
export type ProviderCancel = 'stops' | 'may_finish' | 'none'

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

// [1.24] SPEC 6.10.9: the reasons, beside the kinds. The window picks the sentence by reason
// when one is set, otherwise by kind.
export const PROVIDER_ERROR_REASONS = [
  'address_needed',
  'no_answer',
  'not_comfyui',
  'sign_in_needed',
  'redirect_refused',
  'certificate',
  'address_refused',
  'missing_items',
  'server_refused',
  'out_of_memory',
  'run_failed',
  'server_stopped',
  'lost_contact',
  'too_long',
  'address_changed',
  'bad_result',
  'clip_has_sound',
  // P4-1 (spec/ai-jobs.md, OI-68): a job that failed after it was queued, for a local cause.
  'key_missing',
  'picture_missing',
  'picture_too_large',
  'picture_changed',
  'assets_folder_missing',
  'assets_not_writable',
  'results_not_added',
  'target_gone',
] as const
export type ProviderErrorReason = (typeof PROVIDER_ERROR_REASONS)[number]

export type MissingItem = {
  what: 'model' | 'node' | 'version' | 'add_on'
  name: string
  folder?: string
}

export type ProviderError = {
  kind: ProviderErrorKind
  reason?: ProviderErrorReason
  detail: string
  missing?: MissingItem[]
}

// SPEC 4.3 app.getState.
export type AppState = {
  settings: Settings
  recentProjects: RecentProject[]
  openProjects: OpenProjectSummary[]
  providers: ProviderInfo[]
  secrets: SecretSummary[]
  devTools: boolean // hand-test tools on (SPEC 13, ADMAN_DEV_TOOLS)
}
