import { describe, it, expect } from 'vitest'
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'
import {
  customWorkflowRefusal,
  type CustomWorkflowRefusal,
} from '@/shared/providers/custom-workflow-messages'
import { fixtureText } from '../../../../../fixtures/comfy-custom/load'
import { node } from './graph'

// Planted in every title, key, class, input name and value of each bad file. No refusal
// may repeat it (security rule 12).
const M = 'Zq7Marker'

// A graph whose every text holds the marker, with the three needed marks unless told not to.
function marked(titles: { prompt?: string; seed?: string; output?: string } = {}) {
  return {
    [`p_${M}`]: node(
      `${M}Text`,
      { text: `${M} words`, [`${M}_in`]: M },
      titles.prompt ?? 'adman: prompt',
    ),
    [`s_${M}`]: node(
      `${M}Sampler`,
      { seed: 1, [`${M}_list`]: [M, { [M]: M }] },
      titles.seed ?? 'adman: seed',
    ),
    [`o_${M}`]: node(`${M}Preview`, { images: [`s_${M}`, 0] }, titles.output ?? 'adman: output'),
    [`d_${M}`]: node(`${M}Decoy`, { [M]: `${M} value` }, `${M} title`),
  }
}
const text = (g: unknown) => JSON.stringify(g)

const CASES: Array<[string, string, string?]> = [
  ['workflow_too_large', text(marked()) + ' '.repeat(2 * 1024 * 1024)],
  ['workflow_not_json', `{"${M}": ${M}`],
  ['workflow_canvas_format', fixtureText('canvas').replace(/adman: prompt/g, `${M} adman: prompt`)],
  ['workflow_bad_shape', text([M])],
  ['workflow_bad_shape', text({ [`n_${M}`]: { class_type: M, inputs: M, _meta: { title: M } } })],
  [
    'workflow_bad_shape',
    text({ ...marked(), [`x_${M}`]: { class_type: `${M}\nline`, inputs: {} } }),
  ],
  [
    'workflow_too_many_nodes',
    text(Object.fromEntries([...Array(501)].map((_, i) => [`${M}${i}`, node(M, { [M]: M }, M)]))),
  ],
  ['workflow_bad_link', text({ ...marked(), [`l_${M}`]: node(M, { [M]: [`gone_${M}`, 0] }, M) })],
  ['workflow_unknown_mark', text(marked({ seed: `adman: seed ${M}` }))],
  ['workflow_mark_no_input', text(marked({ seed: `adman: seed=${M}` }))],
  ['workflow_mark_shared', text(marked({ seed: 'adman: seed seed' }))],
  [
    'workflow_mark_repeated',
    text({ ...marked(), [`q_${M}`]: node(M, { text: M }, 'adman: prompt') }),
    'prompt',
  ],
  ['workflow_mark_missing', text(marked({ output: `${M} out` })), 'output'],
  ['workflow_mark_missing', text(marked({ prompt: `${M} prompt` })), 'prompt'],
  ['workflow_mark_missing', text(marked({ seed: `${M} seed` })), 'seed'],
  ['workflow_size_marks', text({ ...marked(), [`w_${M}`]: node(M, { width: 9 }, 'adman: width') })],
  ['workflow_ref_gap', text({ ...marked(), [`r_${M}`]: node(M, { image: M }, 'adman: ref2') })],
  [
    'workflow_first_frame_needs_frames',
    text({ ...marked(), [`f_${M}`]: node(M, { image: M }, 'adman: first-frame') }),
  ],
  [
    'workflow_job_not_offered',
    text({
      ...marked(),
      [`f_${M}`]: node(M, { image: M, length: 9 }, 'adman: first-frame frames'),
      [`r_${M}`]: node(M, { image: M }, 'adman: ref1'),
    }),
  ],
]

describe('checkWorkflowText: one refusal per reason, with no text from the file [D-104]', () => {
  it.each(CASES)('%s', (reason, file, mark) => {
    expect(file).toContain(M)
    const result = checkWorkflowText(file)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual(
      customWorkflowRefusal((mark ? { reason, mark } : { reason }) as CustomWorkflowRefusal),
    )
    expect(JSON.stringify(result)).not.toContain(M)
    expect(JSON.stringify(result).toLowerCase()).not.toContain(M.toLowerCase())
  })

  it('accepts the marked graph itself, so each case fails only for its own reason', () => {
    expect(checkWorkflowText(text(marked())).ok).toBe(true)
  })

  it('refuses a graph with no nodes as bad shape', () => {
    const result = checkWorkflowText('{}')
    expect(result.ok ? null : result.error.details).toEqual({ reason: 'workflow_bad_shape' })
  })

  it('refuses the canvas format', () => {
    const result = checkWorkflowText(fixtureText('canvas'))
    expect(result.ok ? null : result.error.details).toEqual({ reason: 'workflow_canvas_format' })
  })
})

describe('checkWorkflowText: the shape of each node', () => {
  const base = marked()
  const reasonOf = (extra: Record<string, unknown>) => {
    const result = checkWorkflowText(text({ ...base, ...extra }))
    return result.ok ? 'accepted' : result.error.details?.reason
  }
  const deep = (levels: number): unknown => (levels === 0 ? 1 : [deep(levels - 1)])

  it.each([
    ['a key with a slash', { 'a/b': node('X', {}) }],
    ['a key of 65 characters', { ['k'.repeat(65)]: node('X', {}) }],
    ['a node that is a list', { n: [] }],
    ['a node that is null', { n: null }],
    ['no class_type', { n: { inputs: {} } }],
    ['an empty class_type', { n: node('', {}) }],
    ['a class_type of 129 characters', { n: node('C'.repeat(129), {}) }],
    ['a class_type with a format character', { n: node(`A${String.fromCharCode(0x200e)}B`, {}) }],
    ['a class_type with a line separator', { n: node(`A${String.fromCharCode(0x2028)}B`, {}) }],
    ['inputs that are a list', { n: { class_type: 'X', inputs: [] } }],
    ['no inputs', { n: { class_type: 'X' } }],
    ['an empty input name', { n: node('X', { '': 1 }) }],
    ['an input name of 129 characters', { n: node('X', { ['i'.repeat(129)]: 1 }) }],
    ['an input name with a control character', { n: node('X', { 'a\u0007': 1 }) }],
    ['a value nine levels deep', { n: node('X', { v: deep(9) }) }],
  ])('refuses %s as bad shape', (_, extra) => {
    expect(reasonOf(extra)).toBe('workflow_bad_shape')
  })

  it.each([
    ['a key of 64 allowed characters', { ['Az09_:.-'.repeat(8)]: node('X', {}) }],
    ['a class_type of 128 characters', { n: node('C'.repeat(128), {}) }],
    ['a value eight levels deep', { n: node('X', { v: deep(8) }) }],
    [
      'every plain kind of value',
      { n: node('X', { a: 'x', b: 1.5, c: true, d: false, e: null, f: { g: [1] } }) },
    ],
    [
      'a list that is not a link',
      { n: node('X', { v: ['gone', 'x'], w: [1, 0], x: ['a', 0, 1], y: [['gone', 0], 1] }) },
    ],
    ['a link to an own node, output 0 or more', { n: node('X', { a: ['n', 0], b: ['n', 3] }) }],
  ])('accepts %s', (_, extra) => {
    expect(reasonOf(extra)).toBe('accepted')
  })

  // Ruling C: text and any number is a link; it must name an own node by a whole number from 0.
  it.each([
    ['a link to a missing node', ['gone', 0]],
    ['a link to a missing node with a fraction', ['gone', 1.5]],
    ['a link to an own node with a fraction', ['n', 1.5]],
    ['a link to an own node with a negative number', ['n', -1]],
  ])('refuses %s as a bad link', (_, link) => {
    expect(reasonOf({ n: node('X', { a: 1 }), m: node('X', { v: link }) })).toBe(
      'workflow_bad_link',
    )
  })
})
