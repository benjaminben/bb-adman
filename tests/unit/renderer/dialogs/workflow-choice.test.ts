// CW-5 (spec/comfyui-custom.md, "Screens", the workflow picker): which workflows fit a run, in
// comfy.getInfo order, the words of each option, and where the picker starts.
import { describe, expect, it } from 'vitest'
import {
  choiceKey,
  fittingWorkflows,
  optionWords,
  startWorkflow,
} from '@/renderer/dialogs/run-dialog/workflow-choice'
import { offeredFor } from '@/renderer/screens/campaign/offered-workflow'
import { info, workflow } from '../screens/settings/comfy-fixture'
import {
  CLIP_FROM_ONE,
  HARBOUR_FIRST,
  PORTRAIT,
  TIDE_CLIP,
  TWO_PICTURES,
  customWorkflow,
} from '../screens/settings/custom-workflow-fixture'

const MOSS = workflow({ id: 'moss-text-to-image', label: 'MOSS picture from a prompt' })
const MOSS_HIDDEN = workflow({ id: 'moss-text-to-image', offered: false, isDefault: false })
const EDIT = workflow({
  id: 'flux3-klein-edit-references',
  label: 'FLUX edit',
  job: 'image_refs',
})
const H3_FRAME = workflow({
  id: 'h3-image-to-video',
  label: 'H3 from a first frame',
  job: 'video',
  videoStart: { firstFrame: true, references: false },
})
const AGENT_POSTER = customWorkflow(
  { id: 'custom-5a6b7c8d9e0f', label: 'Night poster' },
  { addedBy: 'agent' },
)
const ALL = info({
  workflows: [MOSS, EDIT, H3_FRAME, PORTRAIT, TIDE_CLIP, HARBOUR_FIRST, TWO_PICTURES, AGENT_POSTER],
})

describe('choiceKey [CW-5]', () => {
  it.each([
    ['image', 0, undefined, 'image'],
    ['image', 2, undefined, 'image_refs'],
    ['video', 0, 'prompt', 'video_prompt'],
    ['video', 1, 'first_frame', 'video_first_frame'],
    ['video', 1, 'reference', 'video_references'],
    ['video', 1, 'background', null],
    ['cutout', 0, undefined, null],
    ['text', 0, undefined, null],
  ] as const)('%s with %i pictures from %s is %s', (job, refs, start, key) => {
    expect(choiceKey(job, refs, start)).toBe(key)
  })
})

describe('fittingWorkflows [CW-5]', () => {
  it('lists the offered workflows of the job, in comfy.getInfo order', () => {
    expect(fittingWorkflows(ALL, 'image').map((w) => w.id)).toEqual([
      MOSS.id,
      PORTRAIT.id,
      AGENT_POSTER.id,
    ])
  })

  it('leaves out a shipped workflow that is not offered', () => {
    const given = info({ workflows: [MOSS_HIDDEN, PORTRAIT] })
    expect(fittingWorkflows(given, 'image')).toEqual([PORTRAIT])
  })

  it('matches the start pair for a video', () => {
    expect(fittingWorkflows(ALL, 'video_first_frame')).toEqual([H3_FRAME, HARBOUR_FIRST])
    expect(fittingWorkflows(ALL, 'video_prompt')).toEqual([TIDE_CLIP])
    expect(fittingWorkflows(info({ workflows: [CLIP_FROM_ONE] }), 'video_references')).toEqual([
      CLIP_FROM_ONE,
    ])
  })

  it('lists none before comfy.getInfo answers or with no key', () => {
    expect(fittingWorkflows(null, 'image')).toEqual([])
    expect(fittingWorkflows(ALL, null)).toEqual([])
  })
})

describe('optionWords [CW-5]', () => {
  it('names a workflow by its name, and one an agent added with the words after it', () => {
    expect(optionWords(PORTRAIT)).toBe('Studio portrait')
    expect(optionWords(MOSS)).toBe('MOSS picture from a prompt')
    expect(optionWords(AGENT_POSTER)).toBe('Night poster (added by an agent)')
  })
})

describe('startWorkflow [CW-5]', () => {
  const fitting = [MOSS, PORTRAIT, AGENT_POSTER]
  it('starts at the remembered ID when it fits', () => {
    expect(startWorkflow(fitting, PORTRAIT.id)).toBe(PORTRAIT)
  })

  it.each([
    ['removed', 'custom-ffffffffffff'],
    ['for another job', TIDE_CLIP.id],
    ['not set', undefined],
  ])('starts at the default when the remembered ID is %s', (_name, remembered) => {
    expect(startWorkflow(fitting, remembered)).toBe(MOSS)
  })

  it('starts at the default even when it is not listed first', () => {
    const shipped = { ...MOSS, isDefault: false }
    const custom = { ...PORTRAIT, isDefault: true }
    expect(startWorkflow([shipped, custom], undefined)).toBe(custom)
  })

  it('has none when nothing fits', () => {
    expect(startWorkflow([], PORTRAIT.id)).toBeUndefined()
  })
})

describe('offeredFor reads isDefault [CW-5]', () => {
  it('gives the default, not the first offered one', () => {
    const custom = { ...PORTRAIT, isDefault: true }
    const shipped = { ...MOSS, isDefault: false }
    expect(offeredFor(info({ workflows: [shipped, custom] }), 'image')).toBe(custom)
  })
})
