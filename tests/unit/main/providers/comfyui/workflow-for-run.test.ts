// CW-7 (from the CW-3 review; spec/comfyui-custom.md "Which workflow a run gets", "Removed
// before its turn"): the workflow a ComfyUI run gets in the adapter. A named ID not on this
// computer, or a draft's, is workflow_gone before anything is sent, for each video start too;
// a run that names no workflow never gets a custom one.
import { describe, it, expect, afterEach } from 'vitest'
import { workflowForRun } from '@/main/providers/comfyui/image'
import { comfyVideo } from '@/main/providers/comfyui/video'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { mossEditReferences, mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import { h3TextToVideo } from '@/main/providers/comfyui/workflows/h3'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { ProviderFailure } from '@/main/providers/types'
import { greyPng } from '@/main/providers/fake/png'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import { comfyContext, fakeTiming } from '../../../../helpers/comfy-run'

const GONE = 'custom-ffffffffffff'

const STARTS = [
  { firstFrame: false, references: false },
  { firstFrame: true, references: false },
  { firstFrame: false, references: true },
]

const customPicture: WorkflowSpec = {
  ...mossTextToImage,
  id: 'custom-0123456789ab',
  status: 'custom',
}

function reasonOf(run: () => unknown): string | undefined {
  try {
    run()
  } catch (e) {
    if (e instanceof ProviderFailure) return e.error.reason
    throw e
  }
  return 'no failure'
}

describe('workflowForRun with a named ID [CW-7]', () => {
  it.each(STARTS)('is workflow_gone for an ID not on this computer, video start %o', (start) => {
    expect(reasonOf(() => workflowForRun('video', start, WORKFLOWS, GONE))).toBe('workflow_gone')
  })

  it('is workflow_gone for a draft ID', () => {
    const draft = mossEditReferences.id
    expect(mossEditReferences.status).toBe('draft')
    expect(reasonOf(() => workflowForRun('image_refs', undefined, WORKFLOWS, draft))).toBe(
      'workflow_gone',
    )
  })

  it('is workflow_gone for a known ID of another video start', () => {
    const start = { firstFrame: true, references: false }
    const named = h3TextToVideo.id
    expect(reasonOf(() => workflowForRun('video', start, WORKFLOWS, named))).toBe('workflow_gone')
  })
})

describe('workflowForRun with no ID [CW-7]', () => {
  it('never gives a custom workflow: it stops, sending nothing, when no shipped one fits', () => {
    const list = [customPicture]
    expect(() => workflowForRun('image', undefined, list)).toThrow('No shipped workflow for image')
  })

  it('gives the proven shipped one, as before, with custom ones in the list', () => {
    expect(workflowForRun('image', undefined, [customPicture, ...WORKFLOWS]).id).toBe(
      mossTextToImage.id,
    )
  })
})

describe('the video adapter with an ID not on this computer [CW-7]', () => {
  let stand: StandIn
  afterEach(async () => {
    await stand.close()
  })

  it.each(STARTS)('ends workflow_gone and sends nothing, start %o', async (start) => {
    stand = await startComfyStandIn()
    const { timing } = fakeTiming()
    const video = comfyVideo(
      comfyContext(() => stand.origin),
      {
        timing,
        checks: createServerChecks(),
      },
    )
    const frame = { bytes: greyPng(8, 8), mime: 'image/png' as const }
    const input = {
      image: start.firstFrame ? frame : null,
      references: start.references ? [frame] : [],
      prompt: 'A bottle on a rock',
      durationMs: 2_000,
      width: 1080,
      height: 1920,
      workflowId: GONE,
    }
    const error: unknown = await video.start(input).then(
      () => null,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ProviderFailure)
    expect((error as ProviderFailure).error.reason).toBe('workflow_gone')
    expect(stand.seen).toEqual([])
  })
})
