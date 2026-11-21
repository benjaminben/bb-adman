// P4-9 (spec/ai-jobs.md "Cut-out"): comfy.check compares the cut-out workflow too. Its model
// file and node classes are listed by the app's own names when the server lacks them.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'

let f: Fixture
let stand: StandIn
afterEach(async () => {
  f.cleanup()
  await stand.close()
})

async function checked(): Promise<ComfyCheck> {
  f = makeFixture()
  data(await f.user('comfy.setAddress', { address: stand.origin }))
  return data<ComfyCheck>(await f.user('comfy.check', {}))
}

const cutoutOf = (result: ComfyCheck) => result.workflows.find((w) => w.id === 'birefnet-cutout')

describe('comfy.check and the cut-out workflow [P4-9]', () => {
  it('shows birefnet.safetensors in background_removal when the server lacks it', async () => {
    stand = await startComfyStandIn()
    const result = await checked()
    expect(cutoutOf(result)?.missing).toEqual([
      { what: 'model', name: 'birefnet.safetensors', folder: 'background_removal' },
    ])
    expect(stand.seen.map((r) => r.path)).toContain('/models/background_removal')
  })

  it('shows the background-removal node classes the server lacks', async () => {
    stand = await startComfyStandIn()
    stand.reply('GET /models/background_removal', { json: ['birefnet.safetensors'] })
    for (const name of ['LoadBackgroundRemovalModel', 'RemoveBackground']) {
      stand.reply(`GET /object_info/${name}`, { status: 404, json: {} })
    }
    const result = await checked()
    expect(cutoutOf(result)?.missing).toEqual([
      { what: 'node', name: 'LoadBackgroundRemovalModel' },
      { what: 'node', name: 'RemoveBackground' },
    ])
  })

  it('shows it complete when the server has the model and every node', async () => {
    stand = await startComfyStandIn()
    stand.reply('GET /models/background_removal', { json: ['birefnet.safetensors'] })
    expect(cutoutOf(await checked())?.missing).toEqual([])
  })
})
