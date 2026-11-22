// Single owner of provider IDs and default model IDs (SPEC 3.1, 6).
// Phase 1 holds the provider list only; adapters arrive with their phases.
// [1.24] local, cancel and serverText follow the table of SPEC 6.11.1.
import type { ProviderInfo } from '@/shared/schemas/queries/app'

// Not local, no way to stop a started request, no server text: every provider but the
// ones that say otherwise.
const REMOTE = { local: false, cancel: 'none', serverText: false } as const

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    jobs: ['image', 'layout', 'text'],
    available: true,
    secrets: ['gemini.apiKey'],
    defaultModels: {
      image: 'gemini-nano-banana-2.1',
      layout: 'gemini-3.5-flash-lite',
      text: 'gemini-3.5-flash-lite',
    },
    ...REMOTE,
  },
  {
    id: 'fal-seedance',
    label: 'fal.ai Seedance',
    jobs: ['video'],
    // P7-15: the adapter is built (P7-14). Runs are paid: a user start needs the paid confirm,
    // an agent start the fal tick (spec/agent-runs.md).
    available: true,
    secrets: ['fal.apiKey'],
    defaultModels: { video: 'bytedance/seedance-2.0/image-to-video' },
    ...REMOTE,
    cancel: 'may_finish',
  },
  // [1.35] SPEC 6.11.1: `available` is a build fact. True from CU-4, pictures; 'video' joined
  // `jobs` in CU-6a, a video from a prompt (14 1.53 G-9).
  {
    id: 'comfyui',
    label: 'ComfyUI',
    // P4-1: 'cutout' (spec/ai-jobs.md). No default provider is kept for cut-outs (OI-55).
    jobs: ['image', 'video', 'cutout'],
    // [1.35] CU-4: this build has the picture adapter.
    available: true,
    secrets: [],
    defaultModels: {},
    local: true,
    cancel: 'stops',
    serverText: true,
  },
  {
    id: 'firefly',
    label: 'Adobe Firefly',
    jobs: ['image'],
    available: false,
    secrets: ['firefly.clientId', 'firefly.clientSecret'],
    defaultModels: {},
    ...REMOTE,
  },
  {
    id: 's3',
    label: 'Amazon S3',
    jobs: ['storage'],
    available: true,
    secrets: ['s3.accessKeyId', 's3.secretAccessKey'],
    defaultModels: {},
    ...REMOTE,
  },
  {
    id: 'dropbox',
    label: 'Dropbox',
    jobs: ['storage'],
    available: true,
    secrets: ['dropbox.refreshToken'],
    defaultModels: {},
    ...REMOTE,
  },
  {
    id: 'azure-blob',
    label: 'Azure Blob Storage',
    jobs: ['storage'],
    available: false,
    secrets: [],
    defaultModels: {},
    ...REMOTE,
  },
  {
    id: 'jev',
    label: 'Jev',
    jobs: ['verification'],
    available: false,
    secrets: [],
    defaultModels: {},
    ...REMOTE,
  },
]

const FAKE: ProviderInfo = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'layout', 'text', 'video', 'cutout', 'storage', 'verification'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}

export const DEFAULT_PROVIDERS = {
  image: 'gemini',
  layout: 'gemini',
  text: 'gemini',
  // [1.58] J-2: the local provider, so no run is paid unless the user picks fal. A saved file is
  // not rewritten.
  video: 'comfyui',
} as const

export function listProviders(env: Record<string, string | undefined>): ProviderInfo[] {
  return env.ADMAN_FAKE_PROVIDERS === '1' ? [...PROVIDERS, FAKE] : [...PROVIDERS]
}
