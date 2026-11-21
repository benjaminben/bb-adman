import { describe, it, expect } from 'vitest'
import { offeredWorkflow } from '../../../../../src/main/providers/comfyui/workflows/offered'
import { WORKFLOWS } from '../../../../../src/main/providers/comfyui/workflows'
import type { WorkflowSpec } from '../../../../../src/main/providers/comfyui/workflows/types'
import { mossTextToImage } from '../../../../../src/main/providers/comfyui/workflows/moss'
import {
  h3ImageToVideo,
  h3TextToVideo,
} from '../../../../../src/main/providers/comfyui/workflows/h3'

const as = (spec: WorkflowSpec, status: WorkflowSpec['status']): WorkflowSpec => ({
  ...spec,
  status,
})

const IMAGE = { job: 'image' } as const
const USER_DEV = { devTools: true, actor: 'user' } as const

describe('offeredWorkflow: which workflow a run gets [SPEC 6.10.11, 14 1.41]', () => {
  it('never offers a draft, hand-test tools or not', () => {
    const drafts = WORKFLOWS.filter((w) => w.status === 'draft')
    expect(drafts.map((w) => w.id)).toEqual(['moss-edit-references', 'moss-extend'])
    for (const draft of drafts) {
      const choice = { job: draft.job, ...(draft.videoStart && { videoStart: draft.videoStart }) }
      // The choice fits this workflow: as a trial it would be offered.
      expect(offeredWorkflow(choice, USER_DEV, [as(draft, 'trial')])?.id, draft.id).toBe(draft.id)
      expect(offeredWorkflow(choice, USER_DEV, WORKFLOWS)?.id, draft.id).not.toBe(draft.id)
      expect(offeredWorkflow(choice, USER_DEV, drafts), draft.id).toBeNull()
    }
    expect(offeredWorkflow(IMAGE, USER_DEV, [as(mossTextToImage, 'draft')])).toBeNull()
  })

  it('refuses a trial workflow with dev tools off', () => {
    const list = [as(mossTextToImage, 'trial')]
    expect(offeredWorkflow(IMAGE, { devTools: false, actor: 'user' }, list)).toBeNull()
  })

  it('refuses a trial workflow to an agent, even with dev tools on', () => {
    const list = [as(mossTextToImage, 'trial')]
    expect(offeredWorkflow(IMAGE, { devTools: true, actor: 'agent' }, list)).toBeNull()
  })

  it('offers a trial workflow to the user with dev tools on', () => {
    const list = [as(mossTextToImage, 'trial')]
    expect(offeredWorkflow(IMAGE, USER_DEV, list)?.id).toBe('moss-text-to-image')
  })

  it('offers a proven workflow to anyone, and takes it before a trial one', () => {
    const trial = { ...as(mossTextToImage, 'trial'), label: 'trial copy' }
    const proven = as(mossTextToImage, 'proven')
    expect(offeredWorkflow(IMAGE, USER_DEV, [trial, proven])).toBe(proven)
    expect(offeredWorkflow(IMAGE, { devTools: false, actor: 'agent' }, [proven])).toBe(proven)
  })

  it('matches a video run by its start kind [FR-286]', () => {
    const list = [as(h3TextToVideo, 'proven'), as(h3ImageToVideo, 'proven')]
    const who = { devTools: false, actor: 'user' } as const
    const firstFrame = {
      job: 'video',
      videoStart: { firstFrame: true, references: false },
    } as const
    const none = { job: 'video', videoStart: { firstFrame: false, references: false } } as const
    const both = { job: 'video', videoStart: { firstFrame: true, references: true } } as const
    expect(offeredWorkflow(firstFrame, who, list)?.id).toBe('h3-image-to-video')
    expect(offeredWorkflow(none, who, list)?.id).toBe('h3-text-to-video')
    expect(offeredWorkflow(both, who, list)).toBeNull()
  })

  it('offers the shipped trial picture workflow to the user with dev tools on [14 1.46]', () => {
    expect(offeredWorkflow(IMAGE, USER_DEV)?.id).toBe('moss-text-to-image')
    expect(offeredWorkflow(IMAGE, { devTools: false, actor: 'user' })).toBeNull()
    const none = { job: 'video', videoStart: { firstFrame: false, references: false } } as const
    expect(offeredWorkflow(none, USER_DEV)?.id).toBe('h3-text-to-video')
  })

  it('does not give a picture workflow for another job', () => {
    const list = [as(mossTextToImage, 'proven')]
    expect(offeredWorkflow({ job: 'image_refs' }, USER_DEV, list)).toBeNull()
  })
})
