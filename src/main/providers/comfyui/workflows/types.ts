// SPEC 6.10.4 [REQ: FR-258, FR-278] (security class), with the 1.39 reference slots: a
// workflow is a shipped graph plus this typed description. No function in the adapter takes
// a workflow, a node or a model file name from its caller.
import type { WorkflowFacts } from '@/shared/schemas/queries/comfy'

export type { WorkflowId } from '@/shared/schemas/queries/comfy'

// One input of one node in the graph.
export type Pointer = { node: string; input: string }

export type GraphNode = { class_type: string; inputs: Record<string, unknown> }
// ComfyUI's "API" form (V-3).
export type Graph = Record<string, GraphNode>

export type ReferenceSlot = {
  // The Load Image input that takes the uploaded file name.
  image: Pointer
  // Removed when this slot gets no picture ([1.39]).
  dropWhenUnused: { nodes: string[]; inputs: Pointer[] }
}

export type WorkflowSlots = {
  prompt: Pointer
  seed: Pointer[]
  width?: Pointer
  height?: Pointer
  // One per reference picture, in order; its length is the most the workflow takes.
  references?: ReferenceSlot[]
  // The fewest pictures the workflow runs with; default 1.
  minReferences?: number
  // [1.59] L-16: graph parts kept as data but removed on every fill, such as a reference
  // slot the workflow does not declare yet. Only with references.
  alwaysDrop?: { nodes: string[]; inputs: Pointer[] }
  firstFrame?: Pointer
  frames?: Pointer
  outputPrefix?: Pointer
  // Extend only.
  pad?: { left: Pointer; top: Pointer; right: Pointer; bottom: Pointer }
  // The one node whose result the app fetches.
  outputNode: string
}

export type WorkflowSpec = WorkflowFacts & {
  // Bumped whenever the graph file changes.
  version: number
  graph: Graph
  slots: WorkflowSlots
  // Where the graph came from, and each hand change.
  source: { template: string; exportedFrom: string; changes: string[] }
}
