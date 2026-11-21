// spec/screens-campaign.md, "The trial mark in the panels" (S2-7): offeredFor finds the
// workflow comfy.getInfo marks offered for the run a panel would start.
import { describe, expect, it } from 'vitest'
import { offeredFor } from '@/renderer/screens/campaign/offered-workflow'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { info, workflow } from '../settings/comfy-fixture'

const TEXT = workflow({ id: 'moss-text-to-image', job: 'image' })
const TEXT_HIDDEN = workflow({ id: 'moss-text-to-image', job: 'image', offered: false })
const REFS = workflow({ id: 'flux3-klein-edit-references', job: 'image_refs', status: 'proven' })
const REFS_HIDDEN = workflow({ id: 'moss-edit-references', job: 'image_refs', offered: false })
const PROMPT_VIDEO = workflow({
  id: 'h3-text-to-video',
  job: 'video',
  videoStart: { firstFrame: false, references: false },
})
const FRAME_VIDEO = workflow({
  id: 'h3-image-to-video',
  job: 'video',
  videoStart: { firstFrame: true, references: false },
})

const ALL = info({ workflows: [TEXT_HIDDEN, TEXT, REFS_HIDDEN, REFS, PROMPT_VIDEO, FRAME_VIDEO] })
const NONE_OFFERED = info({ workflows: [TEXT_HIDDEN, REFS_HIDDEN] })

type Case = [
  string,
  ComfyInfo | null,
  WorkflowInfo['job'],
  WorkflowInfo['videoStart'],
  WorkflowInfo | undefined,
]

describe('offeredFor [S2-7]', () => {
  it.each<Case>([
    ['a picture from a prompt (no ticks)', ALL, 'image', undefined, TEXT],
    ['a picture with ticked references', ALL, 'image_refs', undefined, REFS],
    [
      'a video from a first frame',
      ALL,
      'video',
      { firstFrame: true, references: false },
      FRAME_VIDEO,
    ],
    ['a video from a prompt', ALL, 'video', { firstFrame: false, references: false }, PROMPT_VIDEO],
    [
      'a video start with no workflow',
      ALL,
      'video',
      { firstFrame: false, references: true },
      undefined,
    ],
    ['nothing offered for the job', NONE_OFFERED, 'image', undefined, undefined],
    ['before comfy.getInfo answers', null, 'image', undefined, undefined],
  ])('%s', (_name, given, job, pair, expected) => {
    expect(offeredFor(given, job, pair)).toBe(expected)
  })
})
