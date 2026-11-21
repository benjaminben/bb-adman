import { describe, it, expect } from 'vitest'
import { fillWorkflow } from '@/main/providers/comfyui/fill'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import {
  h3ImageToVideo,
  h3ReferenceToVideo,
  h3TextToVideo,
} from '@/main/providers/comfyui/workflows/h3'

const PROMPT_ID = '0b7e8f52-5d1c-4c1e-9a3e-2f6f1d9b7c10'
const SIZE = { width: 1024, height: 1024 }

// A small spec of its own, so the drop rule can be tested on a known graph.
const twoRefs: WorkflowSpec = {
  ...mossTextToImage,
  graph: {
    a: { class_type: 'LoadImage', inputs: { image: 'x.png' } },
    b: { class_type: 'LoadImage', inputs: { image: 'x.png' } },
    c: { class_type: 'Combine', inputs: { text: '', first: ['a', 0], second: ['b', 0] } },
    k: { class_type: 'KSampler', inputs: { seed: 0, positive: ['c', 0] } },
    out: { class_type: 'PreviewImage', inputs: { images: ['k', 0] } },
  },
  slots: {
    prompt: { node: 'c', input: 'text' },
    seed: [{ node: 'k', input: 'seed' }],
    references: [
      { image: { node: 'a', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
      {
        image: { node: 'b', input: 'image' },
        dropWhenUnused: { nodes: ['b'], inputs: [{ node: 'c', input: 'second' }] },
      },
    ],
    outputNode: 'out',
  },
}

describe('fillWorkflow [SPEC 6.10.4, FR-258]', () => {
  it('sets the prompt as a plain text value, and the size', () => {
    const prompt = 'a "quoted" prompt }, {"x": 1}'
    const g = fillWorkflow(mossTextToImage, { prompt, ...SIZE })
    expect(g['4']?.inputs.text).toBe(prompt)
    expect(g['6']?.inputs).toMatchObject({ width: 1024, height: 1024 })
  })

  it('puts a fresh whole-number seed below 2^53 in every seed slot', () => {
    const seeds = new Set<unknown>()
    for (let i = 0; i < 20; i++) {
      const seed = fillWorkflow(mossTextToImage, { prompt: 'p', ...SIZE })['7']?.inputs.seed
      expect(Number.isSafeInteger(seed)).toBe(true)
      expect(seed as number).toBeGreaterThanOrEqual(0)
      seeds.add(seed)
    }
    expect(seeds.size).toBeGreaterThan(1)
  })

  it('does not change the shipped graph', () => {
    const before = JSON.stringify(mossTextToImage.graph)
    fillWorkflow(mossTextToImage, { prompt: 'p', ...SIZE })
    expect(JSON.stringify(mossTextToImage.graph)).toBe(before)
  })

  it('fills the frames, the first frame and the output prefix adman/{promptId}', () => {
    const g = fillWorkflow(h3ImageToVideo, {
      prompt: 'p',
      ...SIZE,
      frames: 57,
      firstFrame: 'adman/adman-0123456789abcdef.png',
      promptId: PROMPT_ID,
    })
    expect(g['5']?.inputs.length).toBe(57)
    expect(g['15']?.inputs.image).toBe('adman/adman-0123456789abcdef.png')
    expect(g['14']?.inputs.filename_prefix).toBe(`adman/${PROMPT_ID}`)
  })

  it.each([
    ['no prompt', { ...SIZE }],
    ['no width', { prompt: 'p', height: 1024 }],
    ['a size that is not a whole number', { prompt: 'p', width: 10.5, height: 1024 }],
    ['references for a workflow with no reference slot', { prompt: 'p', ...SIZE, references: [] }],
    ['a first frame for a workflow with none', { prompt: 'p', ...SIZE, firstFrame: 'a.png' }],
    ['frames for a picture workflow', { prompt: 'p', ...SIZE, frames: 9 }],
    [
      'a pad for a workflow with none',
      { prompt: 'p', ...SIZE, pad: { left: 1, top: 1, right: 1, bottom: 1 } },
    ],
    [
      'a prompt ID for a workflow with no output prefix',
      { prompt: 'p', ...SIZE, promptId: PROMPT_ID },
    ],
  ])('throws a plain Error for %s', (_name, values) => {
    expect(() => fillWorkflow(mossTextToImage, values as never)).toThrow(Error)
  })

  it.each([
    ['no frames', { prompt: 'p', ...SIZE, promptId: PROMPT_ID }],
    ['no prompt ID', { prompt: 'p', ...SIZE, frames: 57 }],
    ['a prompt ID that is not a UUID', { prompt: 'p', ...SIZE, frames: 57, promptId: '../x' }],
  ])('throws a plain Error for a video fill with %s', (_name, values) => {
    expect(() => fillWorkflow(h3TextToVideo, values as never)).toThrow(Error)
  })

  it('refuses a file name that could reach outside the server folder', () => {
    const values = { prompt: 'p', ...SIZE, frames: 57, promptId: PROMPT_ID }
    for (const firstFrame of ['../secret.png', '/etc/x.png', 'a\\b.png', '']) {
      expect(() => fillWorkflow(h3ImageToVideo, { ...values, firstFrame })).toThrow(Error)
    }
  })
})

describe('fillWorkflow: unused reference slots [SPEC 14 1.39]', () => {
  it('fills the slots in order and drops the declared nodes and inputs of an unused one', () => {
    const g = fillWorkflow(twoRefs, { prompt: 'p', references: ['adman/one.png'] })
    expect(g.a?.inputs.image).toBe('adman/one.png')
    expect(g.b).toBeUndefined()
    expect(g.c?.inputs).toEqual({ text: 'p', first: ['a', 0] })
  })

  it('drops nothing when every slot is used', () => {
    const g = fillWorkflow(twoRefs, { prompt: 'p', references: ['one.png', 'two.png'] })
    expect(Object.keys(g).sort()).toEqual(['a', 'b', 'c', 'k', 'out'])
    expect(g.b?.inputs.image).toBe('two.png')
  })

  it('throws when a link left in the graph points at a dropped node', () => {
    const broken: WorkflowSpec = {
      ...twoRefs,
      slots: {
        ...twoRefs.slots,
        references: [
          twoRefs.slots.references![0]!,
          { image: { node: 'b', input: 'image' }, dropWhenUnused: { nodes: ['b'], inputs: [] } },
        ],
      },
    }
    expect(() => fillWorkflow(broken, { prompt: 'p', references: ['one.png'] })).toThrow(Error)
  })

  it('throws for fewer pictures than minReferences, or more than there are slots', () => {
    expect(() => fillWorkflow(twoRefs, { prompt: 'p', references: [] })).toThrow(Error)
    expect(() => fillWorkflow(twoRefs, { prompt: 'p' })).toThrow(Error)
    expect(() =>
      fillWorkflow(twoRefs, { prompt: 'p', references: ['1.png', '2.png', '3.png'] }),
    ).toThrow(Error)
  })

  it('allows no pictures when minReferences is 0', () => {
    const g = fillWorkflow(
      { ...twoRefs, slots: { ...twoRefs.slots, minReferences: 0 } },
      {
        prompt: 'p',
        references: [],
      },
    )
    expect(g.a).toBeDefined()
    expect(g.b).toBeUndefined()
  })

  it('drops what alwaysDrop declares on every fill, with the link check after [1.59 L-16]', () => {
    const one: WorkflowSpec = {
      ...twoRefs,
      slots: {
        ...twoRefs.slots,
        references: twoRefs.slots.references?.slice(0, 1),
        alwaysDrop: { nodes: ['b'], inputs: [{ node: 'c', input: 'second' }] },
      },
    }
    const g = fillWorkflow(one, { prompt: 'p', references: ['1.png'] })
    expect(g.b).toBeUndefined()
    expect(g.c?.inputs).not.toHaveProperty('second')
    expect(g.a?.inputs.image).toBe('1.png')
    const dangling: WorkflowSpec = {
      ...one,
      slots: { ...one.slots, alwaysDrop: { nodes: ['b'], inputs: [] } },
    }
    expect(() => fillWorkflow(dangling, { prompt: 'p', references: ['1.png'] })).toThrow(
      'A link points at a node that was dropped',
    )
  })

  it('drops for the H3 reference workflow only what its spec declares', () => {
    const g = fillWorkflow(h3ReferenceToVideo, {
      prompt: 'p',
      ...SIZE,
      frames: 57,
      promptId: PROMPT_ID,
      references: ['one.png'],
    })
    expect(g['16']).toBeUndefined()
    expect(g['5']?.inputs).not.toHaveProperty('ref_images.ref_image_1')
    expect(g['5']?.inputs['ref_images.ref_image_0']).toEqual(['15', 0])
  })
})
