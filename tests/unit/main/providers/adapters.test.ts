import { describe, it, expect } from 'vitest'
import { adapterFor, adapterFrom } from '../../../../src/main/providers/adapters'
import type { ProviderAdapters, StorageProvider } from '../../../../src/main/providers/types'
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

const storage: StorageProvider = {
  exists: async () => false,
  read: async () => new Uint8Array(),
  write: async () => undefined,
  list: async () => [],
  remove: async () => undefined,
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
  ] as const)('throws INVALID_INPUT with provider and job for %s', (_case, provider, job) => {
    const table: Record<string, ProviderAdapters> = { gemini: {} }
    expect(() => adapterFrom(table, deps, provider, job)).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT', details: { provider, job } }),
    )
  })

  it('reaches the local storage folder, which is not in the provider list', () => {
    const table: Record<string, ProviderAdapters> = { 'local-storage': { storage: () => storage } }
    expect(adapterFrom(table, deps, 'local-storage', 'storage')).toBe(storage)
  })

  it('throws INVALID_INPUT for every provider today: no adapter is built in step 0', () => {
    expect(() => adapterFor(deps, 'gemini', 'image')).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        details: { provider: 'gemini', job: 'image' },
      }),
    )
  })
})
