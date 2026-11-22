import { describe, it, expect } from 'vitest'
import { adapterFor } from '@/main/providers/adapters'
import { listProviders } from '@/main/providers/registry'
import type { Settings } from '@/shared/schemas/settings'

// The real registry rows, fake provider included, and the real provider folders.
const saved: Record<string, string> = {
  'gemini.apiKey': 'made-up-test-value',
  'firefly.clientId': 'made-up-client-id',
  'firefly.clientSecret': 'made-up-client-secret',
  'fal.apiKey': 'made-up-fal-value',
}
const deps = {
  providers: listProviders({ ADMAN_FAKE_PROVIDERS: '1' }),
  secrets: { get: (name: string) => saved[name] },
  settings: { get: () => ({}) as Settings },
}

describe('adapterFor refuses a provider that is not available [P4-6]', () => {
  it.each([['firefly', 'image']] as const)('%s with %s gives INVALID_INPUT', (provider, job) => {
    expect(() => adapterFor(deps, provider, job)).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: 'That provider cannot do this yet.',
        details: { provider, job },
      }),
    )
  })

  it('finds the Firefly image adapter once the row says available, so the refusal is the row', () => {
    const available = deps.providers.map((p) =>
      p.id === 'firefly' ? { ...p, available: true } : p,
    )
    const image = adapterFor({ ...deps, providers: available }, 'firefly', 'image')
    expect(typeof image.generate).toBe('function')
  })

  it.each([
    ['gemini', 'image'],
    ['fake', 'image'],
  ] as const)('%s with %s still resolves', (provider, job) => {
    expect(typeof adapterFor(deps, provider, job).generate).toBe('function')
  })
})
