import { describe, it, expect } from 'vitest'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'

const PROVEN = [
  'moss-text-to-image',
  'h3-text-to-video',
  'h3-image-to-video',
  'h3-reference-to-video',
  'flux3-klein-edit-references',
  'birefnet-cutout',
]

const start = (firstFrame: boolean, references: boolean) =>
  ({ job: 'video', videoStart: { firstFrame, references } }) as const

describe('the shipped workflows the stakeholder approved [D-103]', () => {
  it('marks the six run workflows proven and keeps the two stand-ins draft', () => {
    const status = Object.fromEntries(WORKFLOWS.map((w) => [w.id, w.status]))
    for (const id of PROVEN) expect(status[id], id).toBe('proven')
    expect(status['moss-edit-references']).toBe('draft')
    expect(status['moss-extend']).toBe('draft')
    expect(WORKFLOWS).toHaveLength(8)
  })

  it('keeps needs.checkedWith empty, as the server version was not recorded', () => {
    for (const w of WORKFLOWS) expect(w.needs.checkedWith, w.id).toBe('')
  })

  for (const actor of ['user', 'agent'] as const) {
    it(`offers every run job to the ${actor} without the hand-test tools, but not extend`, () => {
      const who = { devTools: false, actor }
      expect(offeredWorkflow({ job: 'image' }, who)?.id).toBe('moss-text-to-image')
      expect(offeredWorkflow({ job: 'image_refs' }, who)?.id).toBe('flux3-klein-edit-references')
      expect(offeredWorkflow(start(false, false), who)?.id).toBe('h3-text-to-video')
      expect(offeredWorkflow(start(true, false), who)?.id).toBe('h3-image-to-video')
      expect(offeredWorkflow(start(false, true), who)?.id).toBe('h3-reference-to-video')
      expect(offeredWorkflow({ job: 'cutout' }, who)?.id).toBe('birefnet-cutout')
      expect(offeredWorkflow({ job: 'extend' }, who)).toBeNull()
      expect(offeredWorkflow({ job: 'extend' }, { devTools: true, actor })).toBeNull()
    })
  }
})
