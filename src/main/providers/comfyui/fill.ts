// SPEC 6.10.4 [REQ: FR-257, FR-258] (security class), with the 1.39 drop rule: one pure
// function fills a shipped workflow for one submission. It copies the graph and sets exactly
// the inputs the slots name. It adds no node and changes no class_type and no link. The one
// removal is what a shipped spec declares for an unused reference slot. A missing value for a
// slot the workflow has, or a value for one it has not, is a plain Error.
import type { Graph, Pointer, WorkflowSlots, WorkflowSpec } from './workflows/types'
import { isPromptId, isSubfolder } from './values'

export type FillValues = {
  prompt: string
  width?: number
  height?: number
  // The uploaded file names as the server gave them, in slot order.
  references?: string[]
  firstFrame?: string
  frames?: number
  pad?: { left: number; top: number; right: number; bottom: number }
  // Gives the output prefix adman/{promptId}.
  promptId?: string
}

type SlotName = Exclude<keyof WorkflowSlots, 'seed' | 'outputNode' | 'minReferences'>
type ValueName = Exclude<keyof FillValues, 'prompt'>

// Which value feeds which slot.
const PAIRS: Array<[ValueName, SlotName]> = [
  ['width', 'width'],
  ['height', 'height'],
  ['references', 'references'],
  ['firstFrame', 'firstFrame'],
  ['frames', 'frames'],
  ['pad', 'pad'],
  ['promptId', 'outputPrefix'],
]

function fail(message: string): never {
  throw new Error(message)
}

const whole = (n: number, min: number) =>
  Number.isSafeInteger(n) && n >= min ? n : fail('Not a whole number in range')

// A file name the server gave, with its subfolder: no '..', no leading '/', no '\'.
const fileName = (name: string) =>
  name !== '' && isSubfolder(name) ? name : fail('Not a file name the app can use')

// A whole number below 2^53.
const freshSeed = () => Math.floor(Math.random() * 2 ** 53)

function set(graph: Graph, p: Pointer, value: unknown): void {
  const node = graph[p.node] ?? fail(`The graph has no node ${p.node}`)
  if (!Object.hasOwn(node.inputs, p.input)) fail(`Node ${p.node} has no input ${p.input}`)
  node.inputs[p.input] = value
}

function fillReferences(graph: Graph, slots: WorkflowSlots, names: string[]): void {
  const refs = slots.references ?? []
  const min = slots.minReferences ?? 1
  if (names.length < min || names.length > refs.length) fail('Not a number of pictures it takes')
  refs.forEach((slot, i) => {
    const name = names[i]
    if (name !== undefined) return set(graph, slot.image, fileName(name))
    for (const node of slot.dropWhenUnused.nodes) delete graph[node]
    for (const p of slot.dropWhenUnused.inputs) delete graph[p.node]?.inputs[p.input]
  })
  // No input left may link to a node that is not there.
  for (const node of Object.values(graph)) {
    for (const value of Object.values(node.inputs)) {
      if (Array.isArray(value) && typeof value[0] === 'string' && !graph[value[0]]) {
        fail('A link points at a node that was dropped')
      }
    }
  }
}

export function fillWorkflow(spec: WorkflowSpec, values: FillValues): Graph {
  const slots = spec.slots
  for (const [value, slot] of PAIRS) {
    const has = slots[slot] !== undefined
    const given = values[value] !== undefined
    if (has !== given) fail(has ? `No value for ${slot}` : `This workflow has no ${slot}`)
  }
  if (typeof values.prompt !== 'string') fail('No prompt')

  const graph = structuredClone(spec.graph)
  set(graph, slots.prompt, values.prompt)
  for (const p of slots.seed) set(graph, p, freshSeed())
  if (slots.width && slots.height) {
    set(graph, slots.width, whole(values.width ?? 0, 1))
    set(graph, slots.height, whole(values.height ?? 0, 1))
  }
  if (slots.frames) set(graph, slots.frames, whole(values.frames ?? 0, 1))
  if (slots.firstFrame) set(graph, slots.firstFrame, fileName(values.firstFrame ?? ''))
  if (slots.pad && values.pad) {
    for (const side of ['left', 'top', 'right', 'bottom'] as const) {
      set(graph, slots.pad[side], whole(values.pad[side], 0))
    }
  }
  if (slots.outputPrefix) {
    const id = values.promptId ?? ''
    set(graph, slots.outputPrefix, isPromptId(id) ? `adman/${id}` : fail('Not a prompt ID'))
  }
  if (slots.references) fillReferences(graph, slots, values.references ?? [])
  return graph
}
