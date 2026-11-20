// Single owner of provider IDs and default model IDs (SPEC 3.1, 6).
// Phase 1 holds the provider list only; adapters arrive with their phases.
import type { ProviderInfo } from '../../shared/schemas/queries'

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    jobs: ['image', 'layout', 'text'],
    available: true,
    secrets: ['gemini.apiKey'],
    defaultModels: {
      image: 'gemini-2.5-flash-image',
      layout: 'gemini-2.5-flash',
      text: 'gemini-2.5-flash',
    },
  },
  {
    id: 'fal-seedance',
    label: 'fal.ai Seedance',
    jobs: ['video'],
    available: true,
    secrets: ['fal.apiKey'],
    defaultModels: { video: 'bytedance/seedance-2.0/image-to-video' },
  },
  {
    id: 'firefly',
    label: 'Adobe Firefly',
    jobs: ['image'],
    available: false,
    secrets: ['firefly.clientId', 'firefly.clientSecret'],
    defaultModels: {},
  },
  {
    id: 's3',
    label: 'Amazon S3',
    jobs: ['storage'],
    available: true,
    secrets: ['s3.accessKeyId', 's3.secretAccessKey'],
    defaultModels: {},
  },
  {
    id: 'dropbox',
    label: 'Dropbox',
    jobs: ['storage'],
    available: true,
    secrets: ['dropbox.refreshToken'],
    defaultModels: {},
  },
  {
    id: 'azure-blob',
    label: 'Azure Blob Storage',
    jobs: ['storage'],
    available: false,
    secrets: [],
    defaultModels: {},
  },
  {
    id: 'jev',
    label: 'Jev',
    jobs: ['verification'],
    available: false,
    secrets: [],
    defaultModels: {},
  },
]

const FAKE: ProviderInfo = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'layout', 'text', 'video', 'storage', 'verification'],
  available: true,
  secrets: [],
  defaultModels: {},
}

export const DEFAULT_PROVIDERS = {
  image: 'gemini',
  layout: 'gemini',
  text: 'gemini',
  video: 'fal-seedance',
} as const

export function listProviders(env: Record<string, string | undefined>): ProviderInfo[] {
  return env.ADMAN_FAKE_PROVIDERS === '1' ? [...PROVIDERS, FAKE] : [...PROVIDERS]
}
