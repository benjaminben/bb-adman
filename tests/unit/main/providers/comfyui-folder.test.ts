import { describe, it, expect } from 'vitest'
import { adapters } from '../../../../src/main/providers/comfyui'
import { adapterFor } from '../../../../src/main/providers/adapters'
import { listProviders } from '../../../../src/main/providers/registry'
import type { ProviderInfo } from '../../../../src/shared/schemas/queries/app'
import type { Settings } from '../../../../src/shared/schemas/settings'

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
    expect(Object.keys(adapters)).toEqual(['image', 'video'])
  })

  it.each(['video'] as const)(
    'is joined in adapterFor: %s builds the four VideoProvider functions',
    (job) => {
      expect(Object.keys(adapterFor(deps, 'comfyui', job))).toEqual([
        'start',
        'check',
        'fetchResult',
        'cancel',
      ])
    },
  )
})

describe('the comfyui registry row [SPEC 6.11.1 1.35, 14 CU-6a]', () => {
  it("adds 'video' to its jobs", () => {
    const row = listProviders({}).find((p) => p.id === 'comfyui')
    expect(row?.jobs).toEqual(['image', 'video'])
  })
})
