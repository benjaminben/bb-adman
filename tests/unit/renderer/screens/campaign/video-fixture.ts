// Answers for the video panel tests (SPEC 14 1.57 TP-6): a ComfyUI provider as the registry
// lists it, a comfy.getInfo reply with the prompt-only video workflow, and a provider list the
// test passes in (J-2: the list RV-1 makes, with fal-seedance not available).
import type { AppState, ProviderInfo } from '../../../../../src/shared/schemas/queries/app'
import type { ComfyInfo, WorkflowInfo } from '../../../../../src/shared/schemas/queries/comfy'
import type { JobRow } from '../../../../../src/shared/schemas/rows/job'
import { baseState } from '../../fake-api'
import { jobRow } from '../../stores/job-fixture'
import { campaignApi } from './campaign-fixture'

export const A9 = '01JD00000000000000000000A9'

export const COMFY: ProviderInfo = {
  id: 'comfyui',
  label: 'ComfyUI',
  jobs: ['image', 'video'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: true,
}

const base = baseState().providers
const SEEDANCE = base.find((p) => p.id === 'fal-seedance') as ProviderInfo

// The list once RV-1 is in: fal-seedance is not available.
export const AFTER_RV1: ProviderInfo[] = [
  ...base.filter((p) => p.id !== 'fal-seedance'),
  { ...SEEDANCE, available: false },
  COMFY,
]

export const PAID_VIDEO: ProviderInfo[] = [...base.filter((p) => p.id !== 'fal-seedance'), SEEDANCE]

const H3 = {
  id: 'h3-text-to-video',
  label: 'H3 text to video',
  job: 'video',
  videoStart: { firstFrame: false, references: false },
  status: 'trial',
  video: { fps: 24, maxMs: 15_000, frameStep: 17, frameOffset: 5 },
} as WorkflowInfo

const H3_FIRST_FRAME = {
  ...H3,
  id: 'h3-image-to-video',
  videoStart: { firstFrame: true, references: false },
  video: { fps: 24, maxMs: 30_000, frameStep: 17, frameOffset: 5 },
} as WorkflowInfo

export const INFO: ComfyInfo = {
  address: 'http://192.168.1.20:8188',
  workflows: [H3_FIRST_FRAME, H3],
  leavesOnServer: [],
}

export function videoApi(opts: { providers?: ProviderInfo[]; jobs?: JobRow[] } = {}) {
  const state: Partial<AppState> = { providers: opts.providers ?? AFTER_RV1 }
  const fake = campaignApi({ jobs: opts.jobs, state })
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO }))
  return fake
}

export function videoRow(over: Partial<JobRow> = {}): JobRow {
  return jobRow('J1', {
    kind: 'video_generation',
    slot: null,
    provider: 'comfyui',
    request: {
      prompt: 'A can rolls',
      durationMs: 2000,
      width: 1080,
      height: 1080,
      start: 'none',
      referenceAssetIds: [],
    },
    ...over,
  })
}

export const CLIP = {
  assetId: A9,
  width: 1080,
  height: 1080,
  durationMs: 2000,
  hasSound: false,
  details: 'pending',
}
