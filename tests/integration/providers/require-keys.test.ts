import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { makeFixture, type Fixture } from '../core-fixture'
import { requireProviderKeys } from '../../../src/main/providers/require-keys'
import { createCommandBus } from '../../../src/main/commands/bus'
import { defineCommand } from '../../../src/main/commands/types'
import { AppError } from '../../../src/shared/schemas/result'

let f: Fixture
afterEach(() => f.cleanup())

function setup() {
  f = makeFixture({ env: { ADMAN_FAKE_PROVIDERS: '1' } })
  return f.core.deps
}

function caught(run: () => void): unknown {
  try {
    run()
  } catch (e) {
    return e
  }
  return undefined
}

describe('requireProviderKeys [SPEC 4.1 NEEDS_KEY, FR-171, correction 14]', () => {
  it('throws NEEDS_KEY naming only the provider when gemini has no key saved', () => {
    const deps = setup()
    const e = caught(() => requireProviderKeys(deps, 'gemini', 'generate images'))
    expect(e).toBeInstanceOf(AppError)
    expect((e as AppError).toBody()).toEqual({
      code: 'NEEDS_KEY',
      message: 'Add your Google Gemini key to generate images.',
      details: { provider: 'gemini' },
    })
  })

  it('passes for gemini once secret.set has saved gemini.apiKey', async () => {
    const deps = setup()
    expect(await f.user('secret.set', { name: 'gemini.apiKey', value: 'k-123456' })).toMatchObject({
      ok: true,
    })
    expect(() => requireProviderKeys(deps, 'gemini', 'generate images')).not.toThrow()
  })

  it('throws NEEDS_KEY for s3 when only one of its two secrets is saved', async () => {
    const deps = setup()
    await f.user('secret.set', { name: 's3.accessKeyId', value: 'AKIA0000' })
    const e = caught(() => requireProviderKeys(deps, 's3', 'publish'))
    expect((e as AppError).toBody()).toMatchObject({
      code: 'NEEDS_KEY',
      details: { provider: 's3' },
    })
  })

  it('passes for the fake provider, which needs no secret', () => {
    const deps = setup()
    expect(() => requireProviderKeys(deps, 'fake', 'generate images')).not.toThrow()
  })

  it('through the bus: returns NEEDS_KEY as a result, logs it, and succeeds after secret.set', async () => {
    const deps = setup()
    const guarded = defineCommand({
      name: 'test.generate',
      input: z.object({}),
      run() {
        requireProviderKeys(deps, 'gemini', 'generate images')
        return { data: 'done' }
      },
    })
    const bus = createCommandBus({
      handlers: [guarded],
      projects: deps.projects,
      undo: deps.undo,
      log: deps.log,
      emit: () => {},
      askPermission: async () => false,
    })
    const first = await bus.execute('test.generate', {}, { actor: 'user' })
    expect(first).toEqual({
      ok: false,
      error: {
        code: 'NEEDS_KEY',
        message: 'Add your Google Gemini key to generate images.',
        details: { provider: 'gemini' },
      },
    })
    const line = f
      .readLogs()
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((l) => l.name === 'test.generate')
    expect(line).toMatchObject({ level: 'warn', ok: false, errorKind: 'NEEDS_KEY' })
    await f.user('secret.set', { name: 'gemini.apiKey', value: 'k-123456' })
    expect(await bus.execute('test.generate', {}, { actor: 'user' })).toEqual({
      ok: true,
      data: 'done',
    })
  })
})
