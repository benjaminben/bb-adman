import { describe, it, expect } from 'vitest'
import { offeredWorkflow, pickWorkflow } from '@/main/providers/comfyui/workflows/offered'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import { toCustomSpec } from '@/main/providers/comfyui/custom/to-spec'
import { storedFrom } from './custom/stored'

const picture = toCustomSpec(storedFrom('picture', { id: 'custom-00000000000a' }))
const later = toCustomSpec(
  storedFrom('picture', { id: 'custom-00000000000b', addedAt: '2026-11-22T11:00:00.000Z' }),
)
const refs = toCustomSpec(storedFrom('two-refs', { id: 'custom-00000000000c' }))
const firstFrame = toCustomSpec(storedFrom('video-first-frame', { id: 'custom-00000000000d' }))
const ALL: readonly WorkflowSpec[] = [...WORKFLOWS, picture, later, refs, firstFrame]

const IMAGE = { job: 'image' } as const
const FRAME = { job: 'video', videoStart: { firstFrame: true, references: false } } as const
const PROMPT = { job: 'video', videoStart: { firstFrame: false, references: false } } as const
const EVERYONE = [
  { devTools: true, actor: 'user' },
  { devTools: false, actor: 'user' },
  { devTools: true, actor: 'agent' },
  { devTools: false, actor: 'agent' },
] as const

const as = (spec: WorkflowSpec, status: WorkflowSpec['status']): WorkflowSpec => ({
  ...spec,
  status,
})

describe('offeredWorkflow with a named workflow [D-104]', () => {
  it('gives a named custom workflow to the person and the agent, dev tools on or off', () => {
    for (const who of EVERYONE) {
      expect(offeredWorkflow(IMAGE, who, ALL, picture.id), JSON.stringify(who)).toBe(picture)
      expect(offeredWorkflow(FRAME, who, ALL, firstFrame.id)).toBe(firstFrame)
      expect(offeredWorkflow({ job: 'image_refs' }, who, ALL, refs.id)).toBe(refs)
    }
  })

  it('refuses an unknown ID and a named draft with comfy_workflow_not_found', () => {
    for (const who of EVERYONE) {
      expect(pickWorkflow(IMAGE, who, ALL, 'custom-ffffffffffff')).toEqual({
        refusal: 'comfy_workflow_not_found',
      })
      expect(pickWorkflow({ job: 'image_refs' }, who, ALL, 'moss-edit-references')).toEqual({
        refusal: 'comfy_workflow_not_found',
      })
    }
  })

  it('refuses a named trial with dev tools off, and gives it with dev tools on', () => {
    const list = [as(mossTextToImage, 'trial')]
    for (const actor of ['user', 'agent'] as const) {
      expect(pickWorkflow(IMAGE, { devTools: false, actor }, list, mossTextToImage.id)).toEqual({
        refusal: 'comfy_job_not_offered',
      })
      expect(offeredWorkflow(IMAGE, { devTools: true, actor }, list, mossTextToImage.id)?.id).toBe(
        mossTextToImage.id,
      )
    }
  })

  it('refuses a workflow of the wrong job or start with comfy_workflow_wrong_job', () => {
    const who = { devTools: false, actor: 'user' } as const
    const wrong = { refusal: 'comfy_workflow_wrong_job' }
    expect(pickWorkflow({ job: 'image_refs' }, who, ALL, picture.id)).toEqual(wrong)
    expect(pickWorkflow(PROMPT, who, ALL, firstFrame.id)).toEqual(wrong)
    expect(pickWorkflow(IMAGE, who, ALL, 'h3-text-to-video')).toEqual(wrong)
    expect(pickWorkflow(FRAME, who, ALL, 'h3-text-to-video')).toEqual(wrong)
  })

  it('gives a named shipped proven workflow to anyone', () => {
    for (const who of EVERYONE) {
      expect(offeredWorkflow(PROMPT, who, ALL, 'h3-text-to-video')?.id).toBe('h3-text-to-video')
    }
  })
})

describe('offeredWorkflow with nothing named [D-104]', () => {
  it('never lets a custom workflow displace a shipped default', () => {
    for (const who of EVERYONE) {
      expect(offeredWorkflow(IMAGE, who, ALL)?.id).toBe('moss-text-to-image')
      expect(offeredWorkflow(FRAME, who, ALL)?.id).toBe('h3-image-to-video')
    }
  })

  it('gives the oldest custom one that fits when no shipped one fits', () => {
    const shippedTrial = [as(mossTextToImage, 'trial'), picture, later]
    expect(offeredWorkflow(IMAGE, { devTools: false, actor: 'agent' }, shippedTrial)).toBe(picture)
    expect(offeredWorkflow(IMAGE, { devTools: true, actor: 'agent' }, shippedTrial)?.id).toBe(
      mossTextToImage.id,
    )
    expect(pickWorkflow(PROMPT, { devTools: false, actor: 'user' }, [picture])).toEqual({
      refusal: 'comfy_job_not_offered',
    })
  })
})
