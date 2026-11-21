import { describe, it, expect } from 'vitest'
import { adapterFor, adapterFrom } from '../../../../src/main/providers/adapters'
import type { ProviderAdapters } from '../../../../src/main/providers/types'
import type { ProviderInfo } from '../../../../src/shared/schemas/queries/app'
import type { Settings } from '../../../../src/shared/schemas/settings'

const gemini: ProviderInfo = {
  id: 'gemini',
  label: 'Google Gemini',
  jobs: ['image', 'text'],
  available: true,
  secrets: ['gemini.apiKey'],
  defaultModels: { image: 'image-model-x' },
}

const settings = { defaultProjectDir: '/w' } as unknown as Settings
const saved: Record<string, string> = { 'gemini.apiKey': 'made-up-test-value' }
const deps = {
  providers: [gemini],
  secrets: { get: (name: string) => saved[name] },
  settings: { get: () => settings },
}

describe('adapterFor [SPEC 6, step 0]', () => {
  it('builds the interface with a context that reads secrets, settings and the model', () => {
    const seen: unknown[] = []
    const table: Record<string, ProviderAdapters> = {
      gemini: {
        image: (ctx) => {
          seen.push(ctx.secret('gemini.apiKey'), ctx.settings(), ctx.model('image'))
          return {
            generate: async () => [],
            extend: async () => ({ png: new Uint8Array(), model: 'm' }),
          }
        },
      },
    }
    const image = adapterFrom(table, deps, 'gemini', 'image')
    expect(typeof image.generate).toBe('function')
    expect(seen).toEqual(['made-up-test-value', settings, 'image-model-x'])
  })

  it.each([
    ['a job the provider does not do', 'gemini', 'video'],
    ['an adapter not built yet', 'gemini', 'text'],
    ['an unknown provider', 'nobody', 'image'],
    ['local storage, which adapterFor does not give', 'local-storage', 'storage'],
  ] as const)('throws INVALID_INPUT with provider and job for %s', (_case, provider, job) => {
    const table: Record<string, ProviderAdapters> = { gemini: {} }
    expect(() => adapterFrom(table, deps, provider, job)).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT', details: { provider, job } }),
    )
  })

  it('uses the real provider folders: a job the provider does not do is INVALID_INPUT', () => {
    expect(() => adapterFor(deps, 'gemini', 'video')).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        details: { provider: 'gemini', job: 'video' },
      }),
    )
  })

  it('uses the real provider folders: local storage with storage is INVALID_INPUT [SPEC 14 H18]', () => {
    const localStorage: ProviderInfo = { ...gemini, id: 'local-storage', jobs: ['storage'] }
    const withLocal = { ...deps, providers: [gemini, localStorage] }
    expect(() => adapterFor(withLocal, 'local-storage', 'storage')).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        details: { provider: 'local-storage', job: 'storage' },
      }),
    )
  })
})
