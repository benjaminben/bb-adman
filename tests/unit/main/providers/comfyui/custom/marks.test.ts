import { describe, it, expect } from 'vitest'
import { readMarks } from '@/main/providers/comfyui/custom/marks'
import type { Graph } from '@/main/providers/comfyui/workflows/types'
import { basePicture, node } from './graph'

const marksOf = (graph: Graph) => {
  const read = readMarks(graph)
  if (!read.ok) throw new Error(`refused: ${read.reason}`)
  return read.marks
}

const reasonOf = (graph: Graph) => {
  const read = readMarks(graph)
  return read.ok ? 'accepted' : read.reason
}

describe('readMarks: the title rule [D-104]', () => {
  it('reads the three marks every workflow needs', () => {
    expect(marksOf(basePicture())).toEqual({
      prompt: { node: '1', input: 'text' },
      seed: [{ node: '2', input: 'seed' }],
      references: [],
      output: '3',
    })
  })

  it.each([
    ['ADMAN: PROMPT', 'Adman: Seed', 'adMan: OutPut'],
    ['  adman:prompt  ', 'adman:SEED', 'ADMAN:output'],
  ])('takes every mark word and adman: in any letter case (%s)', (p, s, o) => {
    const g = basePicture()
    g['1'] = node('MadeUpTextBox', { text: '' }, p)
    g['2'] = node('MadeUpSampler', { seed: 1 }, s)
    g['3'] = node('MadeUpPreview', {}, o)
    expect(marksOf(g).prompt).toEqual({ node: '1', input: 'text' })
  })

  it('takes several marks in one title, split by spaces and by commas', () => {
    const g = basePicture()
    g['4'] = node(
      'MadeUpVideoSize',
      { width: 640, height: 480, length: 33 },
      'adman: Width,HEIGHT ,  frames',
    )
    g['5'] = node('MadeUpLoad', { image: 'a.png' }, 'adman:first-frame')
    const marks = marksOf(g)
    expect(marks.width).toEqual({ node: '4', input: 'width' })
    expect(marks.height).toEqual({ node: '4', input: 'height' })
    expect(marks.frames).toEqual({ node: '4', input: 'length' })
    expect(marks.firstFrame).toEqual({ node: '5', input: 'image' })
  })

  it('takes =input as written, even when a listed input is there', () => {
    const g = basePicture()
    g['2'] = node('MadeUpSampler', { seed: 1, noise_seed: 2 }, 'adman: seed=noise_seed')
    expect(marksOf(g).seed).toEqual([{ node: '2', input: 'noise_seed' }])
    g['2'] = node('MadeUpSampler', { noise_seed: 2 }, 'adman: seed=Noise_Seed')
    expect(reasonOf(g)).toBe('workflow_mark_no_input')
    g['2'] = node('MadeUpSampler', { steps: 2 }, 'adman: SEED=steps')
    expect(marksOf(g).seed).toEqual([{ node: '2', input: 'steps' }])
  })

  it('tries the inputs in the listed order and takes the first of the right kind', () => {
    const g = basePicture()
    g['1'] = node('MadeUpTextBox', { value: 'v', prompt: 'p', text: 't' }, 'adman: prompt')
    expect(marksOf(g).prompt).toEqual({ node: '1', input: 'text' })
    g['1'] = node('MadeUpTextBox', { value: 'v', prompt: 'p' }, 'adman: prompt')
    expect(marksOf(g).prompt).toEqual({ node: '1', input: 'prompt' })
    g['1'] = node('MadeUpTextBox', { text: 3, string: 's' }, 'adman: prompt')
    expect(marksOf(g).prompt).toEqual({ node: '1', input: 'string' })
    g['2'] = node('MadeUpSampler', { seed: 1.5, noise_seed: 4, value: 9 }, 'adman: seed')
    expect(marksOf(g).seed).toEqual([{ node: '2', input: 'noise_seed' }])
    g['4'] = node('MadeUpFrames', { frames: 'x', num_frames: 33 }, 'adman: frames')
    expect(marksOf(g).frames).toEqual({ node: '4', input: 'num_frames' })
  })

  it('never chooses a link', () => {
    const g = basePicture()
    g['1'] = node('MadeUpTextBox', { text: ['9', 0], value: 'v' }, 'adman: prompt')
    expect(marksOf(g).prompt).toEqual({ node: '1', input: 'value' })
    g['1'] = node('MadeUpTextBox', { text: ['3', 0] }, 'adman: prompt')
    expect(reasonOf(g)).toBe('workflow_mark_no_input')
    g['1'] = node('MadeUpTextBox', { text: ['3', 0] }, 'adman: prompt=text')
    expect(reasonOf(g)).toBe('workflow_mark_no_input')
  })

  it('ignores a title that does not start with adman:', () => {
    const g = basePicture()
    g['4'] = node('MadeUpTextBox', { text: 'x' }, 'my prompt')
    g['5'] = node('MadeUpTextBox', { text: 'y' }, 'not adman: prompt')
    g['6'] = node('MadeUpTextBox', { text: 'z' }, 'adman prompt')
    g['7'] = node('MadeUpTextBox', { text: 'w' })
    expect(marksOf(g).prompt).toEqual({ node: '1', input: 'text' })
  })

  it('allows several seed marks and several marks on one node', () => {
    const g = basePicture()
    g['2'] = node('MadeUpSampler', { seed: 1, noise_seed: 2 }, 'adman: seed seed=noise_seed')
    expect(marksOf(g).seed).toEqual([
      { node: '2', input: 'seed' },
      { node: '2', input: 'noise_seed' },
    ])
  })

  it.each([
    ['adman:', 'workflow_unknown_mark'],
    ['adman: , ,', 'workflow_unknown_mark'],
    ['adman: negative', 'workflow_unknown_mark'],
    ['adman: ref9', 'workflow_unknown_mark'],
    ['adman: ref0', 'workflow_unknown_mark'],
    ['adman: ref01', 'workflow_unknown_mark'],
    ['adman: output=images', 'workflow_unknown_mark'],
    ['adman: seed=', 'workflow_unknown_mark'],
    ['adman: seed seed', 'workflow_mark_shared'],
  ])('refuses the title %j as %s', (title, reason) => {
    const g = basePicture()
    g['4'] = node('MadeUpSampler', { seed: 3 }, title)
    expect(reasonOf(g)).toBe(reason)
  })
})

describe('readMarks: more mark words and input lists', () => {
  it('takes ref1 to ref8, first-frame and frames in any letter case', () => {
    const g = basePicture()
    const titles = ['ref1', 'REF2', 'Ref3', 'rEf4', 'REF5', 'reF6', 'Ref7', 'REF8']
    titles.forEach(
      (t, i) => (g[`r${i}`] = node('MadeUpLoad', { image: `${i}.png` }, `adman: ${t}`)),
    )
    g['f'] = node('MadeUpLoad', { image: 'f.png' }, 'ADMAN: First-FRAME')
    g['n'] = node('MadeUpFrames', { length: 9 }, 'Adman: FrAmEs')
    const marks = marksOf(g)
    expect(marks.references).toEqual(titles.map((_, i) => ({ node: `r${i}`, input: 'image' })))
    expect(marks.firstFrame).toEqual({ node: 'f', input: 'image' })
    expect(marks.frames).toEqual({ node: 'n', input: 'length' })
  })

  it('falls back to value for width and height', () => {
    const g = basePicture()
    g['w'] = node('MadeUpInt', { value: 640 }, 'adman: width')
    g['h'] = node('MadeUpInt', { value: 480, height: 'x' }, 'adman: height')
    const marks = marksOf(g)
    expect(marks.width).toEqual({ node: 'w', input: 'value' })
    expect(marks.height).toEqual({ node: 'h', input: 'value' })
  })

  it('tries length first for frames, then each name in order, then value', () => {
    const inputs = ['length', 'frames', 'num_frames', 'frame_count', 'video_frames', 'value']
    for (let i = 0; i < inputs.length; i++) {
      const g = basePicture()
      const present = Object.fromEntries(inputs.slice(i).map((name) => [name, 9]))
      g['n'] = node('MadeUpFrames', present, 'adman: frames')
      expect(marksOf(g).frames).toEqual({ node: 'n', input: inputs[i] })
    }
  })

  it.each([
    ['prompt', '1'],
    ['seed', '2'],
    ['output', '3'],
  ])('refuses a workflow with no %s mark, naming that mark', (mark, id) => {
    const g = basePicture()
    g[id] = { ...g[id], _meta: { title: 'Plain title' } } as Graph[string]
    expect(readMarks(g)).toEqual({ ok: false, reason: 'workflow_mark_missing', mark })
  })
})
