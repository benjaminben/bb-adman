// comfy.getInfo (SPEC 4.3, 6.10.4, 6.10.10; FR-253, FR-263, FR-285): the address, and the
// app's own shipped workflow data, readable before any run. User-only; contacts nothing.
// These are also the parts of a WorkflowSpec (src/main/providers/comfyui/workflows/types.ts)
// that a window may see: the graph, the slots and the source stay in the main process.
import type { SizeRule } from '@/shared/comfy/fit-size'

// The fixed list of shipped workflows (SPEC 6.10.4, the first set, the seventh of 1.46, and
// P4-9's cut-out).
export const WORKFLOW_IDS = [
  'moss-text-to-image',
  'moss-edit-references',
  'moss-extend',
  'h3-text-to-video',
  'h3-image-to-video',
  'h3-reference-to-video',
  'flux3-klein-edit-references',
  'birefnet-cutout',
] as const
export type ShippedWorkflowId = (typeof WORKFLOW_IDS)[number]
// D-104: a workflow a person or an agent added; the form is CUSTOM_WORKFLOW_ID in
// src/shared/comfy/custom-workflow.ts.
export type CustomWorkflowId = `custom-${string}`
export type WorkflowId = ShippedWorkflowId | CustomWorkflowId

export type WorkflowJob = 'image' | 'image_refs' | 'extend' | 'video' | 'cutout'

// 'draft': the graph is a stand-in for the tests and is never sent to any server.
// 'trial': a real graph, not yet proven; offered only with the hand-test tools on (6.10.11).
// 'custom': added by a person or an agent (D-104); offered as soon as it is added.
export type WorkflowStatus = 'draft' | 'trial' | 'proven' | 'custom'

export type WorkflowNeeds = {
  minComfyVersion: string
  // The server version the owner check passed on; empty until then.
  checkedWith: string
  models: Array<{ folder: string; file: string }>
  nodeClasses: string[]
  addOns: Array<{ name: string; url: string }>
}

// [1.45] B-6: the frame counts a model takes are frameStep × k + frameOffset, k from 0.
export type WorkflowVideo = { fps: number; maxMs: number; frameStep: number; frameOffset: number }

export type WorkflowLicence = { name: string; url: string; commercialNote: string | null }

// The shipped facts of a workflow, the same in every reply.
export type WorkflowFacts = {
  id: WorkflowId
  label: string
  job: WorkflowJob
  videoStart?: { firstFrame: boolean; references: boolean }
  status: WorkflowStatus
  model: { label: string; mainFile: string }
  needs: WorkflowNeeds
  size: SizeRule
  video?: WorkflowVideo
  licence: WorkflowLicence
  leavesOnServer: string[]
}

export type WorkflowInfo = WorkflowFacts & {
  // S2-4: the workflow the user's run of this job (and, for video, start pair) gets now.
  offered: boolean
}

export type ComfyInfo = {
  // The saved origin, for the user's own window only (SPEC 6.10.1).
  address: string | null
  workflows: WorkflowInfo[]
  // Every sentence any workflow has, once each (SPEC 6.10.10).
  leavesOnServer: string[]
}
