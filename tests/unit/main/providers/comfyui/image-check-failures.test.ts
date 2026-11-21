import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type Reply, type StandIn } from '../../../../helpers/comfy-stand-in'
import { comfyContext, fakeTiming, requestLines } from '../../../../helpers/comfy-run'
import { comfyImage } from '../../../../../src/main/providers/comfyui/image'
import { createServerChecks } from '../../../../../src/main/providers/comfyui/needs'
import { ProviderFailure } from '../../../../../src/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

async function failureOf(mcpPort?: number) {
  const { timing } = fakeTiming()
  const ctx = comfyContext(() => stand.origin, mcpPort ?? 1)
  const provider = comfyImage(ctx, { timing, checks: createServerChecks() })
  const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
  const e = await provider.generate(input).catch((error: unknown) => error)
  if (!(e instanceof ProviderFailure)) throw new Error('Not a ProviderFailure')
  return e.error
}

describe('the check rows of 6.10.9 from a stand-in answer, before anything else is sent', () => {
  it.each<[string, Reply, string, string]>([
    ['no answer', { vanish: true }, 'offline', 'no_answer'],
    ['a 401', { status: 401, json: {} }, 'other', 'sign_in_needed'],
    ['a 403', { status: 403, json: {} }, 'other', 'sign_in_needed'],
    ['a redirect', { status: 302, headers: { location: '/x' } }, 'other', 'redirect_refused'],
    ['another shape', { json: [] }, 'other', 'not_comfyui'],
  ])('%s gives kind %s, reason %s', async (_name, reply, kind, reason) => {
    stand = await startComfyStandIn()
    stand.reply('GET /system_stats', reply)
    expect(await failureOf()).toMatchObject({ kind, reason })
    expect(requestLines(stand)).toEqual(['GET /system_stats'])
  })

  it('the app own port as the address gives address_refused, and nothing is sent', async () => {
    stand = await startComfyStandIn()
    expect(await failureOf(stand.port)).toMatchObject({ kind: 'other', reason: 'address_refused' })
    expect(stand.seen).toEqual([])
  })
})
