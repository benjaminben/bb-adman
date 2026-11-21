import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/comfyui'
import { adapterFor } from '@/main/providers/adapters'
import { listProviders } from '@/main/providers/registry'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { Settings } from '@/shared/schemas/settings'

const comfyui: ProviderInfo = {
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

const deps = {
  providers: [comfyui],
  secrets: { get: () => undefined },
  settings: { get: () => ({}) as unknown as Settings },
}

describe('the comfyui provider folder [SPEC 6, 14 CU-0]', () => {
  it('exports an adapters object that holds the image and video adapters', () => {
    expect(Object.keys(adapters)).toEqual(['image', 'video', 'cutout'])
  })

  it.each(['video'] as const)(
    'is joined in adapterFor: %s builds the five VideoProvider functions',
    (job) => {
      expect(Object.keys(adapterFor(deps, 'comfyui', job))).toEqual([
        'start',
        'check',
        'fetchResult',
        'cancel',
        'runSize',
      ])
    },
  )
})

describe('the comfyui registry row [SPEC 6.11.1 1.35, 14 CU-6a]', () => {
  it("adds 'video' to its jobs", () => {
    const row = listProviders({}).find((p) => p.id === 'comfyui')
    expect(row?.jobs).toEqual(['image', 'video', 'cutout'])
  })

  it("lists 'cutout' for ComfyUI and the fake provider only [P4-1]", () => {
    const rows = listProviders({ ADMAN_FAKE_PROVIDERS: '1' })
    const cutout = rows.filter((p) => p.jobs.includes('cutout')).map((p) => p.id)
    expect(cutout).toEqual(['comfyui', 'fake'])
  })
})
