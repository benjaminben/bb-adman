// R3-2: the words that name the service and model of one job row.
import { describe, expect, it } from 'vitest'
import { rowModel, runName } from '@/renderer/ui/run-name/run-name'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { ProviderInfo } from '@/shared/schemas/queries/app'

type Named = Pick<ProviderInfo, 'id' | 'label' | 'defaultModels' | 'modelLabels'>

const providers: Named[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModels: { image: 'gemini-nano-banana-2.1' },
    modelLabels: { image: 'Nano Banana 2.1' },
  },
  { id: 'comfyui', label: 'ComfyUI', defaultModels: {}, modelLabels: {} },
]
const flow = (job: string, label: string, mainFile: string) => ({
  job,
  offered: true,
  model: { label, mainFile },
})
const INFO = {
  address: null,
  leavesOnServer: [],
  workflows: [
    flow('image', 'MOSS-Image', 'moss.safetensors'),
    flow('image_refs', 'FLUX 3 klein', 'flux.safetensors'),
    flow('cutout', 'BiRefNet', 'birefnet.pth'),
  ],
} as unknown as ComfyInfo

const row = (over: Partial<JobRow>) =>
  ({ kind: 'image_generation', provider: 'gemini', model: null, request: null, ...over }) as JobRow

describe('rowModel and runName [R3-2]', () => {
  it('names the registry model the row stored', () => {
    const r = row({ model: 'gemini-nano-banana-2.1' })
    expect(rowModel(r, providers, null)).toBe('Nano Banana 2.1')
    expect(runName(r, providers, null, 'The provider')).toBe('Google Gemini · Nano Banana 2.1')
  })

  it('names an unknown stored model by its ID', () => {
    expect(rowModel(row({ model: 'gemini-9' }), providers, null)).toBe('gemini-9')
  })

  it('names a ComfyUI row by the workflow its kind gets', () => {
    const comfy = { provider: 'comfyui', model: '' }
    expect(rowModel(row(comfy), providers, INFO)).toBe('MOSS-Image')
    const refs = row({ ...comfy, request: { referenceAssetIds: ['A1'] } })
    expect(rowModel(refs, providers, INFO)).toBe('FLUX 3 klein')
    expect(runName(row({ ...comfy, kind: 'cutout' }), providers, INFO, '')).toBe(
      'ComfyUI · BiRefNet',
    )
  })

  it('gives the plain provider when no model is known', () => {
    const comfy = row({ provider: 'comfyui', model: '' })
    expect(runName(comfy, providers, null, '')).toBe('ComfyUI')
    expect(runName(row({ provider: 's3', kind: 'publish' }), providers, null, '')).toBe('s3')
    expect(runName(row({ provider: null }), providers, null, 'The provider')).toBe('The provider')
  })
})
