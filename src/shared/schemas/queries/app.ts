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
  // R3-2: the name a person reads for each job's model, beside defaultModels. Absent or empty
  // where the provider has no fixed model (ComfyUI's comes from its workflow).
  modelLabels?: Partial<Record<ProviderJob, string>>
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
  // P4-1 (spec/ai-jobs.md, OI-68): a job that failed after it was queued, for a local cause.
  'key_missing',
  'picture_missing',
  'picture_too_large',
  'picture_changed',
  'assets_folder_missing',
  'assets_not_writable',
  'results_not_added',
  'target_gone',
  // P7-16: a background start's first frame could not be drawn.
  'background_not_drawn',
  // P9-1 (spec/phases/phase-09.md "Publishing"): the publish job's reasons.
  'dropbox_signed_out',
  'export_not_built',
  'export_failed',
  'work_folder_unsafe',
  // P9-10: two files of one publish would share a published name.
  'publish_paths_clash',
  // D-104: a queued run's custom workflow was removed before its turn.
  'workflow_gone',
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
  // D-104 (CW-7): for a custom workflow `missing` is empty and this is how many items it lacks.
  missingCount?: number
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
