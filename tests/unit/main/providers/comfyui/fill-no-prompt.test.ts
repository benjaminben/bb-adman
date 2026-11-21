// P4-9 (spec/ai-jobs.md "Cut-out"): WorkflowSlots.prompt is optional. A prompt value for a
// workflow without the slot is refused, and a missing one for a workflow with it, as for every
// other slot.
import { describe, it, expect } from 'vitest'
import { fillWorkflow, type FillValues } from '@/main/providers/comfyui/fill'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'

const noPrompt: WorkflowSpec = {
  ...mossTextToImage,
  graph: {
    '1': { class_type: 'LoadImage', inputs: { image: 'x.png' } },
    '2': { class_type: 'PreviewImage', inputs: { images: ['1', 0] } },
  },
  slots: {
    seed: [],
    references: [
      { image: { node: '1', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
    ],
    minReferences: 1,
    outputNode: '2',
  },
}

const SIZE = { width: 1024, height: 1024 }

describe('fillWorkflow with and without a prompt slot [P4-9]', () => {
  it.each<[string, WorkflowSpec, FillValues, string | null]>([
    ['no slot, no prompt: accepted', noPrompt, { references: ['adman/a.png'] }, null],
    [
      'no slot, a prompt given: refused',
      noPrompt,
      { prompt: 'cut it out', references: ['adman/a.png'] },
      'This workflow has no prompt',
    ],
    [
      'no slot, an empty prompt given: refused',
      noPrompt,
      { prompt: '', references: ['adman/a.png'] },
      'This workflow has no prompt',
    ],
    ['a slot, no prompt: refused', mossTextToImage, { ...SIZE }, 'No value for prompt'],
  ])('%s', (_name, spec, values, error) => {
    const fill = () => fillWorkflow(spec, values)
    if (error === null) expect(fill).not.toThrow()
    else expect(fill).toThrow(error)
  })

  it('fills only the picture name when there is no prompt slot', () => {
    const graph = fillWorkflow(noPrompt, { references: ['adman/a.png'] })
    expect(graph).toEqual({
      '1': { class_type: 'LoadImage', inputs: { image: 'adman/a.png' } },
      '2': { class_type: 'PreviewImage', inputs: { images: ['1', 0] } },
    })
  })
})
