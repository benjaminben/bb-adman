import { describe, it, expect } from 'vitest'
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'
import { fixtureText, type CustomFixture } from '../../../../../fixtures/comfy-custom/load'
import { basePicture, node } from './graph'

const checked = (text: string) => {
  const result = checkWorkflowText(text)
  if (!result.ok) throw new Error(`refused: ${String(result.error.details?.reason)}`)
  return result.data
}
const reasonOf = (text: string) => {
  const result = checkWorkflowText(text)
  return result.ok ? 'accepted' : result.error.details?.reason
}

describe('checkWorkflowText: the job and video start from the marks [D-104]', () => {
  it.each([
    ['picture', 'image', undefined],
    ['two-refs', 'image_refs', undefined],
    ['video-prompt', 'video', { firstFrame: false, references: false }],
    ['video-first-frame', 'video', { firstFrame: true, references: false }],
    ['video-refs', 'video', { firstFrame: false, references: true }],
  ] as const)('%s is %s', (name, job, videoStart) => {
    const w = checked(fixtureText(name as CustomFixture))
    expect(w.job).toBe(job)
    expect(w.videoStart).toEqual(videoStart)
  })

  it('refuses first-frame with a ref mark, and first-frame without frames', () => {
    const g = JSON.parse(fixtureText('video-first-frame'))
    g['9'] = node('LoadImage', { image: 'x.png' }, 'adman: ref1')
    expect(reasonOf(JSON.stringify(g))).toBe('workflow_job_not_offered')
    const h = JSON.parse(fixtureText('video-first-frame'))
    h['3']._meta.title = 'adman: width height'
    expect(reasonOf(JSON.stringify(h))).toBe('workflow_first_frame_needs_frames')
  })

  it('refuses ref9 as an unknown mark', () => {
    const g = basePicture()
    g['9'] = node('LoadImage', { image: 'x.png' }, 'adman: ref9')
    expect(reasonOf(JSON.stringify(g))).toBe('workflow_unknown_mark')
  })

  it('builds the slots: one empty-drop slot per ref mark, the exact count, seeds below 2^32', () => {
    const w = checked(fixtureText('two-refs'))
    expect(w.slots).toEqual({
      prompt: { node: '3', input: 'prompt' },
      seed: [{ node: '3', input: 'noise_seed' }],
      references: [
        { image: { node: '1', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
        { image: { node: '2', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
      ],
      minReferences: 2,
      outputNode: '4',
      seedBelow: 2 ** 32,
    })
    expect(w.nodeTypes).toEqual(['LoadImage', 'MadeUpReferenceEdit', 'SaveImage'])
    expect(w.nodeCount).toBe(4)
  })

  it('sets width, height, frames and first frame only when marked', () => {
    const picture = checked(fixtureText('picture')).slots
    expect(picture.width).toEqual({ node: '5', input: 'width' })
    expect(picture.height).toEqual({ node: '5', input: 'height' })
    expect(picture).not.toHaveProperty('frames')
    expect(picture).not.toHaveProperty('references')
    const video = checked(fixtureText('video-first-frame')).slots
    expect(video.frames).toEqual({ node: '3', input: 'num_frames' })
    expect(video.firstFrame).toEqual({ node: '2', input: 'image' })
    expect(checked(fixtureText('video-refs')).slots).not.toHaveProperty('width')
  })
})

describe('checkWorkflowText: limits and what is kept', () => {
  const withNodes = (n: number) => {
    const g: Record<string, unknown> = basePicture()
    for (let i = 3; i < n; i++) g[`f${i}`] = node('MadeUpFiller', { n: i })
    return JSON.stringify(g)
  }

  it('accepts exactly 500 nodes and refuses 501', () => {
    expect(checked(withNodes(500)).nodeCount).toBe(500)
    expect(reasonOf(withNodes(501))).toBe('workflow_too_many_nodes')
  })

  it('accepts a 2 MiB file and refuses one byte more', () => {
    const text = JSON.stringify(basePicture())
    const exact = text + ' '.repeat(2 * 1024 * 1024 - Buffer.byteLength(text))
    expect(Buffer.byteLength(exact)).toBe(2 * 1024 * 1024)
    expect(reasonOf(exact)).toBe('accepted')
    expect(reasonOf(`${exact} `)).toBe('workflow_too_large')
    // Counted in UTF-8 bytes, not in characters.
    const wide = text + ' '.repeat(2 * 1024 * 1024 - Buffer.byteLength(text) - 1) + 'é'
    expect(wide.length).toBe(2 * 1024 * 1024)
    expect(reasonOf(wide)).toBe('workflow_too_large')
  })

  it('keeps per node only class_type, inputs and _meta.title', () => {
    const g = {
      ...basePicture(),
      '4': {
        class_type: 'MadeUpExtra',
        inputs: { a: 1 },
        is_changed: ['x'],
        _meta: { title: 'Extra', note: 'dropped' },
      },
      '5': { class_type: 'MadeUpNoTitle', inputs: {}, _meta: { title: 7 } },
    }
    const w = checked(JSON.stringify(g))
    expect(w.graph['4']).toEqual({
      class_type: 'MadeUpExtra',
      inputs: { a: 1 },
      _meta: { title: 'Extra' },
    })
    expect(w.graph['5']).toEqual({ class_type: 'MadeUpNoTitle', inputs: {} })
    expect(w.graph['1']).toEqual(basePicture()['1'])
  })

  it('keeps a node named __proto__ as an own node, not as the prototype', () => {
    const text = JSON.stringify(basePicture()).replace(
      /^\{/,
      '{"__proto__":{"class_type":"MadeUpOdd","inputs":{}},',
    )
    const w = checked(text)
    expect(Object.hasOwn(w.graph, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(w.graph)).toBe(Object.prototype)
    expect(w.nodeTypes).toContain('MadeUpOdd')
  })
})
