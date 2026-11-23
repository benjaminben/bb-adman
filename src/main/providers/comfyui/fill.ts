// SPEC 6.10.4 [REQ: FR-257, FR-258] (security class), with the 1.39 drop rule: one pure
// function fills a shipped workflow for one submission. It copies the graph and sets exactly
// the inputs the slots name. It adds no node and changes no class_type and no link. The only
// removals are what a shipped spec declares: for an unused reference slot, and its alwaysDrop
// parts (1.59 L-16), both checked for links left dangling. A missing value for a
// slot the workflow has, or a value for one it has not, is a plain Error.
import type { Graph, Pointer, WorkflowSlots, WorkflowSpec } from './workflows/types'
import { isPromptId, isSubfolder } from './values'
import { isLink } from './custom/check-file'

export type FillValues = {
  // Only for a workflow with a prompt slot (P4-9: a cut-out has none).
  prompt?: string
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

type SlotName = Exclude<keyof WorkflowSlots, 'seed' | 'outputNode' | 'minReferences' | 'seedBelow'>
type ValueName = keyof FillValues

// Which value feeds which slot.
const PAIRS: Array<[ValueName, SlotName]> = [
  ['prompt', 'prompt'],
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

// A whole number below `below`: 2^53 unless the spec sets seedBelow (D-104).
const freshSeed = (below = 2 ** 53) => Math.floor(Math.random() * below)

function set(graph: Graph, p: Pointer, value: unknown): void {
  // D-104: fixed sentences, so no node ID or input name of a custom graph reaches an error.
  const node = Object.hasOwn(graph, p.node) ? graph[p.node] : undefined
  if (!node) fail('The graph has no step the workflow names.')
  if (!Object.hasOwn(node.inputs, p.input)) fail('A step has no input the workflow names.')
  node.inputs[p.input] = value
}

function drop(graph: Graph, parts: { nodes: string[]; inputs: Pointer[] }): void {
  for (const node of parts.nodes) delete graph[node]
  for (const p of parts.inputs) delete graph[p.node]?.inputs[p.input]
}

function fillReferences(graph: Graph, slots: WorkflowSlots, names: string[]): void {
  const refs = slots.references ?? []
  const min = slots.minReferences ?? 1
  if (names.length < min || names.length > refs.length) fail('Not a number of pictures it takes')
  refs.forEach((slot, i) => {
    const name = names[i]
    if (name !== undefined) return set(graph, slot.image, fileName(name))
    drop(graph, slot.dropWhenUnused)
  })
  if (slots.alwaysDrop) drop(graph, slots.alwaysDrop)
  // No input left may link to a node that is not there. D-104: a link is what the file checks
  // call one, and the node must be the graph's own, so a plain value is never taken for one.
  for (const node of Object.values(graph)) {
    for (const value of Object.values(node.inputs)) {
      if (isLink(value) && !Object.hasOwn(graph, value[0])) {
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

  const graph = structuredClone(spec.graph)
  if (slots.prompt) {
    set(graph, slots.prompt, typeof values.prompt === 'string' ? values.prompt : fail('No prompt'))
  }
  for (const p of slots.seed) set(graph, p, freshSeed(slots.seedBelow))
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
