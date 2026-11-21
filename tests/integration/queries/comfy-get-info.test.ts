import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { WORKFLOW_IDS, type ComfyInfo } from '@/shared/schemas/queries/comfy'

let f: Fixture
let stand: StandIn | undefined
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = undefined
})

const info = async () => data<ComfyInfo>(await f.core.query('comfy.getInfo', {}, { actor: 'user' }))

describe('comfy.getInfo [SPEC 4.3, 6.10.10; FR-253, FR-263, FR-285]', () => {
  it('gives a null address before one is saved, and the shipped workflows', async () => {
    f = makeFixture()
    const result = await info()
    expect(result.address).toBeNull()
    expect(result.workflows.map((w) => w.id)).toEqual([...WORKFLOW_IDS])
  })

  it('gives the saved address in full to the user, and contacts nothing', async () => {
    f = makeFixture()
    stand = await startComfyStandIn()
    data(await f.user('comfy.setAddress', { address: stand.origin }))
    expect((await info()).address).toBe(stand.origin)
    expect(stand.seen).toEqual([])
  })

  it('describes each workflow with the fields of Section 4.3 and nothing more', async () => {
    f = makeFixture()
    const result = await info()
    for (const [i, w] of result.workflows.entries()) {
      const spec = WORKFLOWS[i]!
      const keys = [
        'id',
        'label',
        'job',
        'status',
        'model',
        'needs',
        'size',
        'licence',
        'leavesOnServer',
        'offered',
      ]
      if (spec.videoStart) keys.push('videoStart')
      if (spec.video) keys.push('video')
      expect(Object.keys(w).sort()).toEqual(keys.sort())
      expect(w).toMatchObject({
        label: spec.label,
        status: spec.status,
        needs: spec.needs,
        licence: spec.licence,
        leavesOnServer: spec.leavesOnServer,
      })
    }
    // The graph, the slots and the source stay in the main process.
    expect(JSON.stringify(result)).not.toContain('class_type')
  })

  it('gives the video limits so a window can tell the user the clip length [SPEC 6.10.7]', async () => {
    f = makeFixture()
    const video = (await info()).workflows.find((w) => w.id === 'h3-text-to-video')
    expect(video?.video?.maxMs).toBe(15_000)
  })

  it('lists every "left on the server" sentence once', async () => {
    f = makeFixture()
    const result = await info()
    const all = result.workflows.flatMap((w) => w.leavesOnServer)
    expect(new Set(result.leavesOnServer)).toEqual(new Set(all))
    expect(result.leavesOnServer.length).toBe(new Set(all).size)
    expect(result.leavesOnServer).toHaveLength(4)
  })

  it('refuses an agent with AGENT_DENIED and gives it no address', async () => {
    f = makeFixture()
    data(await f.user('comfy.setAddress', { address: 'http://192.168.1.20:8188' }))
    const result = await f.core.query('comfy.getInfo', {}, { actor: 'agent' })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(JSON.stringify(result)).not.toContain('192.168.1.20')
  })
})
