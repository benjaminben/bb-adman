import { describe, it, expect } from 'vitest'
import { fillWorkflow } from '@/main/providers/comfyui/fill'
import { h3ImageToVideo, h3TextToVideo } from '@/main/providers/comfyui/workflows/h3'
import { AGENT_DRAFT, H3_FIRST_RUN_SIZE, H3_VIDEO } from '@/main/providers/comfyui/workflows/common'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'

const PROMPT_ID = '0b7e8f52-5d1c-4c1e-9a3e-2f6f1d9b7c10'

describe('h3-image-to-video as proven [SPEC 14 1.54 P-4, comfy-workflows/h3-video-first-frame.json]', () => {
  it('is proven, with the slots of the notes: node 5, node 6 noise_seed, node 15 image, node 14', () => {
    expect(h3ImageToVideo.status).toBe('proven')
    expect(h3ImageToVideo.slots).toEqual({
      prompt: { node: '5', input: 'prompt' },
      seed: [{ node: '6', input: 'noise_seed' }],
      width: { node: '5', input: 'width' },
      height: { node: '5', input: 'height' },
      frames: { node: '5', input: 'length' },
      firstFrame: { node: '15', input: 'image' },
      outputPrefix: { node: '14', input: 'filename_prefix' },
      outputNode: '14',
    })
  })

  it('wires the LoadImage into the first_frame input of MiniMaxH3ImageToVideo', () => {
    expect(h3ImageToVideo.graph['15']?.class_type).toBe('LoadImage')
    expect(h3ImageToVideo.graph['5']?.class_type).toBe('MiniMaxH3ImageToVideo')
    expect(h3ImageToVideo.graph['5']?.inputs.first_frame).toEqual(['15', 0])
  })

  it("needs the text workflow's node classes plus LoadImage, and no other model file", () => {
    expect([...h3ImageToVideo.needs.nodeClasses].sort()).toEqual(
      [...h3TextToVideo.needs.nodeClasses, 'LoadImage'].sort(),
    )
    expect(h3ImageToVideo.needs.models).toEqual(h3TextToVideo.needs.models)
    expect(h3ImageToVideo.needs.minComfyVersion).toBe(h3TextToVideo.needs.minComfyVersion)
  })

  it('runs at the first-run size with the H3 timing, and records the full size', () => {
    expect(h3ImageToVideo.size).toBe(H3_FIRST_RUN_SIZE)
    expect(h3ImageToVideo.video).toBe(H3_VIDEO)
    expect(h3ImageToVideo.source.changes).toContain(
      'first-run size; full size is { multiple: 32, minPixels: 589824, maxPixels: 1048576 }',
    )
  })

  it('bumps the version by one and says what was taken from the draft', () => {
    expect(h3ImageToVideo.version).toBe(2)
    expect(h3ImageToVideo.source.exportedFrom).toBe(AGENT_DRAFT)
    expect(h3ImageToVideo.source.template).toMatch(/h3-video-first-frame\.json/)
  })

  it('fills the first frame, the frames and the output prefix adman/{promptId}', () => {
    const g = fillWorkflow(h3ImageToVideo, {
      prompt: 'p',
      width: 576,
      height: 576,
      frames: 56,
      firstFrame: 'adman/adman-0123456789abcdef.png',
      promptId: PROMPT_ID,
    })
    expect(g['15']?.inputs.image).toBe('adman/adman-0123456789abcdef.png')
    expect(g['5']?.inputs).toMatchObject({ prompt: 'p', width: 576, height: 576, length: 56 })
    expect(g['14']?.inputs.filename_prefix).toBe(`adman/${PROMPT_ID}`)
  })
})

describe('the videoStart filter with two video workflows [SPEC 14 1.54 P-4 condition]', () => {
  const who = { devTools: true, actor: 'user' } as const

  it('picks h3-text-to-video only for no first frame and no references', () => {
    const none = { job: 'video', videoStart: { firstFrame: false, references: false } } as const
    // The first-frame workflow first, so the pick fails if the videoStart filter is lost.
    expect(offeredWorkflow(none, who, [h3ImageToVideo, h3TextToVideo])?.id).toBe('h3-text-to-video')
  })

  it('offers h3-image-to-video for a first frame to either actor, tools or not [D-103]', () => {
    const frame = { job: 'video', videoStart: { firstFrame: true, references: false } } as const
    expect(offeredWorkflow(frame, who)?.id).toBe('h3-image-to-video')
    expect(offeredWorkflow(frame, { devTools: false, actor: 'user' })?.id).toBe('h3-image-to-video')
    expect(offeredWorkflow(frame, { devTools: true, actor: 'agent' })?.id).toBe('h3-image-to-video')
    expect(offeredWorkflow(frame, { devTools: false, actor: 'agent' })?.id).toBe(
      'h3-image-to-video',
    )
    // [D-080] as a trial it would go to either actor only with dev tools on.
    const trial = [{ ...h3ImageToVideo, status: 'trial' as const }]
    expect(offeredWorkflow(frame, { devTools: true, actor: 'agent' }, trial)?.id).toBe(
      'h3-image-to-video',
    )
    expect(offeredWorkflow(frame, { devTools: false, actor: 'agent' }, trial)).toBeNull()
  })
})
