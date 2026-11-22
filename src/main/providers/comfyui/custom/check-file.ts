// spec/comfyui-custom.md "The file checks" (D-104), security class: the one gate for every
// workflow a person or an agent brings in, and for every stored file read at start. Pure.
// Steps in the spec's order; the first failure ends the check. Every refusal is a fixed
// sentence from custom-workflow-messages.ts and holds no text from the file (rule 12).
import {
  MAX_WORKFLOW_BYTES,
  MAX_WORKFLOW_NODES,
  type CustomJob,
} from '@/shared/comfy/custom-workflow'
import {
  customWorkflowRefusal,
  type CustomWorkflowReason,
} from '@/shared/providers/custom-workflow-messages'
import type { MarkWord } from '@/shared/comfy/custom-workflow'
import type { Result } from '@/shared/schemas/result'
import type { Graph, GraphNode, WorkflowSlots } from '@/main/providers/comfyui/workflows/types'
import { readMarks, type Marks } from './marks'

export type CheckedWorkflow = {
  // Per node only class_type, inputs and _meta.title.
  graph: Graph
  job: CustomJob
  // Set exactly when the job is video.
  videoStart?: { firstFrame: boolean; references: boolean }
  slots: WorkflowSlots
  // Every class_type, sorted, once each.
  nodeTypes: string[]
  nodeCount: number
}

export type WorkflowCheck = Result<CheckedWorkflow>

// D-104: some community nodes refuse seeds above 2^32.
const CUSTOM_SEED_BELOW = 2 ** 32
const MAX_NAME = 128
const MAX_DEPTH = 8
const NODE_ID = /^[A-Za-z0-9_:.-]{1,64}$/
// Control and format characters; a class name also takes no line or paragraph separator.
const CONTROL = /[\p{Cc}\p{Cf}]/u
const BREAK = /[\p{Zl}\p{Zp}]/u

const refuse = (reason: CustomWorkflowReason, mark?: MarkWord): WorkflowCheck => ({
  ok: false,
  error: customWorkflowRefusal(reason, mark),
})

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isName = (v: unknown): v is string =>
  typeof v === 'string' && v.length >= 1 && v.length <= MAX_NAME && !CONTROL.test(v)

// Text, a number, true, false, null, or a list or object of these, at most 8 levels deep.
function isPlain(value: unknown, levels: number): boolean {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (levels >= MAX_DEPTH || typeof value !== 'object') return false
  const items = Array.isArray(value) ? value : Object.values(value)
  return items.every((item) => isPlain(item, levels + 1))
}

// Step 5: the node as kept, or null when its shape is wrong.
function keptNode(value: unknown): GraphNode | null {
  if (!isRecord(value)) return null
  const { class_type: classType, inputs, _meta: meta } = value
  if (!isName(classType) || BREAK.test(classType) || !isRecord(inputs)) return null
  for (const [name, input] of Object.entries(inputs)) {
    if (!isName(name) || !isPlain(input, 0)) return null
  }
  const node: GraphNode = { class_type: classType, inputs }
  if (isRecord(meta) && typeof meta.title === 'string') node._meta = { title: meta.title }
  return node
}

// A two-item list of text and a whole number from 0.
const isLink = (v: unknown): v is [string, number] =>
  Array.isArray(v) &&
  v.length === 2 &&
  typeof v[0] === 'string' &&
  Number.isInteger(v[1]) &&
  (v[1] as number) >= 0

function slotsFrom(marks: Marks): WorkflowSlots {
  const slots: WorkflowSlots = {
    prompt: marks.prompt,
    seed: marks.seed,
    outputNode: marks.output,
    seedBelow: CUSTOM_SEED_BELOW,
  }
  for (const key of ['width', 'height', 'frames', 'firstFrame'] as const) {
    const pointer = marks[key]
    if (pointer) slots[key] = pointer
  }
  if (marks.references.length > 0) {
    slots.references = marks.references.map((image) => ({
      image,
      dropWhenUnused: { nodes: [], inputs: [] },
    }))
    slots.minReferences = marks.references.length
  }
  return slots
}

// Steps 3 to 8, on a parsed value. The start-up read of a stored graph uses it too.
export function checkWorkflowValue(value: unknown): WorkflowCheck {
  if (!isRecord(value)) return refuse('workflow_bad_shape')
  if (Array.isArray(value.nodes) && Array.isArray(value.links)) {
    return refuse('workflow_canvas_format')
  }
  const entries = Object.entries(value)
  if (entries.length === 0) return refuse('workflow_bad_shape')
  if (entries.length > MAX_WORKFLOW_NODES) return refuse('workflow_too_many_nodes')

  const kept: Array<[string, GraphNode]> = []
  for (const [id, raw] of entries) {
    const node = NODE_ID.test(id) ? keptNode(raw) : null
    if (!node) return refuse('workflow_bad_shape')
    kept.push([id, node])
  }
  // Own entries only: a node named __proto__ stays a node.
  const graph: Graph = Object.fromEntries(kept)
  for (const [, node] of kept) {
    for (const input of Object.values(node.inputs)) {
      if (isLink(input) && !Object.hasOwn(graph, input[0])) return refuse('workflow_bad_link')
    }
  }

  const read = readMarks(graph)
  if (!read.ok) return refuse(read.reason, read.mark)
  const { marks } = read
  const firstFrame = marks.firstFrame !== undefined
  const references = marks.references.length > 0
  if (firstFrame && !marks.frames) return refuse('workflow_first_frame_needs_frames')
  if (firstFrame && references) return refuse('workflow_job_not_offered')

  const job: CustomJob = marks.frames ? 'video' : references ? 'image_refs' : 'image'
  const workflow: CheckedWorkflow = {
    graph,
    job,
    slots: slotsFrom(marks),
    nodeTypes: [...new Set(kept.map(([, n]) => n.class_type))].sort(),
    nodeCount: kept.length,
  }
  if (job === 'video') workflow.videoStart = { firstFrame, references }
  return { ok: true, data: workflow }
}

export function checkWorkflowText(text: string): WorkflowCheck {
  // Each UTF-16 unit is at least one byte, so a long text is refused before it is measured.
  if (text.length > MAX_WORKFLOW_BYTES || Buffer.byteLength(text, 'utf8') > MAX_WORKFLOW_BYTES) {
    return refuse('workflow_too_large')
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    // The parser's error is dropped: it can quote the file.
    return refuse('workflow_not_json')
  }
  return checkWorkflowValue(value)
}
