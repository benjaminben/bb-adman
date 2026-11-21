import { describe, it, expect } from 'vitest'
import { adapters } from '../../../../src/main/providers/comfyui'
import { adapterFor } from '../../../../src/main/providers/adapters'
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
  it('exports an empty adapters object until CU-4 fills it', () => {
    expect(adapters).toEqual({})
  })

  it.each(['image', 'video'] as const)(
    'is joined in adapterFor: %s is INVALID_INPUT while not built',
    (job) => {
      expect(() => adapterFor(deps, 'comfyui', job)).toThrow(
        expect.objectContaining({ code: 'INVALID_INPUT', details: { provider: 'comfyui', job } }),
      )
    },
  )
})
