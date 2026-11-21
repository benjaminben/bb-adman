import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { data } from '../core-fixture'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { Actor } from '@/shared/schemas/events'

let f: ComfyFixture
afterEach(() => f.cleanup())

const ask = (actor: Actor) => f.core.query('comfy.getInfo', {}, { actor })
const workflows = async () => data<ComfyInfo>(await ask('user')).workflows

// One group per job, and for video one per start pair.
const group = (w: WorkflowInfo) =>
  `${w.job}/${w.videoStart?.firstFrame ?? '-'}/${w.videoStart?.references ?? '-'}`

describe('comfy.getInfo marks the workflow a run gets [S2-4, D-088]', () => {
  it('offers no trial workflow with the hand-test tools off', async () => {
    f = await makeComfyFixture({ devTools: false })
    const list = await workflows()
    expect(list.filter((w) => w.status === 'trial').length).toBeGreaterThan(0)
    expect(list.map((w) => w.offered)).toEqual(list.map(() => false))
  })

  it('offers exactly one workflow per job and per video start pair with the tools on', async () => {
    f = await makeComfyFixture({ devTools: true })
    const list = await workflows()
    const offered = list.filter((w) => w.offered)
    expect(offered.map((w) => w.id)).toEqual([
      'moss-text-to-image',
      'h3-text-to-video',
      'h3-image-to-video',
      'h3-reference-to-video',
      'flux3-klein-edit-references',
      'birefnet-cutout',
    ])
    expect(new Set(offered.map(group)).size).toBe(offered.length)
    expect(offered.every((w) => w.status !== 'draft')).toBe(true)
  })

  it('still refuses an agent with AGENT_DENIED', async () => {
    f = await makeComfyFixture({ devTools: true })
    expect(await ask('agent')).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
  })
})
