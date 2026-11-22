// spec/comfyui-custom.md "Marks" (D-104), security class: reads the adman: marks from the
// step titles of a checked graph and finds the input each one fills. It reads only titles,
// input names and whether a value is a plain value of the right kind; it never uses a value.
// A refusal names only a reason and, at most, a word of the marks table.
import { MARK_WORDS, type MarkWord } from '@/shared/comfy/custom-workflow'
import type { CustomWorkflowRefusal } from '@/shared/providers/custom-workflow-messages'
import type { Graph, Pointer } from '@/main/providers/comfyui/workflows/types'

export type Marks = {
  prompt: Pointer
  seed: Pointer[]
  width?: Pointer
  height?: Pointer
  // In order: ref1, ref2 …
  references: Pointer[]
  firstFrame?: Pointer
  frames?: Pointer
  output: string
}

export type MarksRefusal = { ok: false } & CustomWorkflowRefusal
export type MarksRead = { ok: true; marks: Marks } | MarksRefusal

type Kind = 'text' | 'whole'
const FRAMES = ['length', 'frames', 'num_frames', 'frame_count', 'video_frames', 'value']
const PICTURE: [Kind, string[]] = ['text', ['image']]

// What each mark fills: the kind of value, and the inputs tried in order.
const TRIES: Record<Exclude<MarkWord, 'output'>, [Kind, string[]]> = {
  prompt: ['text', ['text', 'prompt', 'positive', 'value', 'string']],
  seed: ['whole', ['seed', 'noise_seed', 'value']],
  width: ['whole', ['width', 'value']],
  height: ['whole', ['height', 'value']],
  ref1: PICTURE,
  ref2: PICTURE,
  ref3: PICTURE,
  ref4: PICTURE,
  ref5: PICTURE,
  ref6: PICTURE,
  ref7: PICTURE,
  ref8: PICTURE,
  'first-frame': PICTURE,
  frames: ['whole', FRAMES],
}

// The marks that may appear at most once.
const ONCE: MarkWord[] = MARK_WORDS.filter((w) => w !== 'seed')
const REQUIRED: MarkWord[] = ['prompt', 'seed', 'output']
const WORDS = new Set<string>(MARK_WORDS)

const isKind = (value: unknown, kind: Kind) =>
  kind === 'text' ? typeof value === 'string' : Number.isInteger(value)

type Found = { word: MarkWord; node: string; input?: string }
type Step = { ok: true; found: Found[] } | MarksRefusal

const refuse = (refusal: CustomWorkflowRefusal): MarksRefusal => ({ ok: false, ...refusal })

// The marks of one title, or null when it is not a mark title.
function titleMarks(title: unknown): Array<{ word: string; input?: string }> | null {
  if (typeof title !== 'string') return null
  const trimmed = title.trim()
  if (trimmed.slice(0, 6).toLowerCase() !== 'adman:') return null
  return trimmed
    .slice(6)
    .split(/[\s,]+/)
    .filter((t) => t !== '')
    .map((token) => {
      const at = token.indexOf('=')
      if (at < 0) return { word: token.toLowerCase() }
      return { word: token.slice(0, at).toLowerCase(), input: token.slice(at + 1) }
    })
}

function findAll(graph: Graph): Step {
  const found: Found[] = []
  for (const [id, node] of Object.entries(graph)) {
    const marks = titleMarks(node._meta?.title)
    if (marks === null) continue
    if (marks.length === 0) return refuse({ reason: 'workflow_unknown_mark' })
    for (const { word, input } of marks) {
      if (!WORDS.has(word) || input === '') return refuse({ reason: 'workflow_unknown_mark' })
      const mark = word as MarkWord
      if (mark === 'output') {
        if (input !== undefined) return refuse({ reason: 'workflow_unknown_mark' })
        found.push({ word: mark, node: id })
        continue
      }
      const [kind, tries] = TRIES[mark]
      const names = input === undefined ? tries : [input]
      const name = names.find((n) => Object.hasOwn(node.inputs, n) && isKind(node.inputs[n], kind))
      if (name === undefined) return refuse({ reason: 'workflow_mark_no_input' })
      found.push({ word: mark, node: id, input: name })
    }
  }
  return { ok: true, found }
}

function countRefusal(found: Found[]): MarksRefusal | null {
  const inputs = found.filter((f) => f.input !== undefined).map((f) => `${f.node}\n${f.input}`)
  if (new Set(inputs).size !== inputs.length) return refuse({ reason: 'workflow_mark_shared' })
  const count = (word: MarkWord) => found.filter((f) => f.word === word).length
  const repeated = ONCE.find((w) => count(w) > 1)
  if (repeated) return refuse({ reason: 'workflow_mark_repeated', mark: repeated })
  const missing = REQUIRED.find((w) => count(w) === 0)
  if (missing) return refuse({ reason: 'workflow_mark_missing', mark: missing })
  if (count('width') !== count('height')) return refuse({ reason: 'workflow_size_marks' })
  const refs = ONCE.filter((w) => w.startsWith('ref')).map(count)
  if (refs.some((n, i) => n === 1 && refs[i - 1] === 0))
    return refuse({ reason: 'workflow_ref_gap' })
  return null
}

export function readMarks(graph: Graph): MarksRead {
  const step = findAll(graph)
  if (!step.ok) return step
  const refusal = countRefusal(step.found)
  if (refusal) return refusal
  const one = (word: MarkWord): Pointer | undefined => {
    const f = step.found.find((x) => x.word === word)
    return f && f.input !== undefined ? { node: f.node, input: f.input } : undefined
  }
  const all = (word: MarkWord) => step.found.filter((f) => f.word === word)
  const marks: Marks = {
    prompt: one('prompt') as Pointer,
    seed: all('seed').map((f) => ({ node: f.node, input: f.input as string })),
    references: ONCE.filter((w) => w.startsWith('ref')).flatMap((w) => one(w) ?? []),
    output: (all('output')[0] as Found).node,
  }
  for (const [key, word] of [
    ['width', 'width'],
    ['height', 'height'],
    ['firstFrame', 'first-frame'],
    ['frames', 'frames'],
  ] as const) {
    const pointer = one(word)
    if (pointer) marks[key] = pointer
  }
  return { ok: true, marks }
}
