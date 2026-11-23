// SPEC 4.4 events from the main process to the window. Phase 1 emits project.changed and
// app.stateChanged. job.updated is declared here by step 0 (SPEC 12, F4); slice D emits it.
// The others arrive with later phases.
import type { TableName } from './rows/keys'
import type { JobRow } from './rows/job'

export type Actor = 'user' | 'agent'

// A row as it leaves the main process (SPEC 4.4): camelCase fields, parsed JSON, booleans.
export type WireRow = Record<string, unknown>

export type ProjectChangedPayload = {
  projectId: string
  changed: { [table in TableName]?: WireRow[] }
  removed: { [table in TableName]?: string[] }
  actor: Actor
}

export type EventMap = {
  'project.changed': ProjectChangedPayload
  // SPEC 4.4: tells every window to re-read app.getState after a project opens or
  // closes, settings change, a key is saved or deleted, or agent access changes.
  'app.stateChanged': Record<string, never>
  // SPEC 3.6, 4.4: sent after every write to a job row.
  'job.updated': JobRow
  // SPEC 4.4; SPEC 14, Slice A rulings point 2b: linked files whose content changed outside
  // the app, sent after asset.checkChanged finds any. The window draws them again.
  'asset.changedOnDisk': { projectId: string; assetIds: string[] }
  // spec/editor-commands.md: a thumbnail file was written or deleted. No picture, no path.
  'thumbnail.changed': { projectId: string; variantId: string }
  // spec/approvals.md: the approvals tables changed. App window only; no email, slug or address.
  'approvals.changed': { projectId: string; campaignId: string }
  // round-2-approvals-video.md "Progress and Stop": before each clip is made and each clip
  // upload of an "Update gallery". App window only; IDs and counts, no path, name or title.
  'approvals.progress': {
    projectId: string
    campaignId: string
    step: 'making' | 'sending'
    done: number
    total: number
  }
  // spec/phases/phase-10.md, ask flow (A-238): an agent waits for the user's answer. The action
  // and target are lines for the dialog; no ID of the target, no input, no path. agentClient is
  // untrusted text from the MCP client, drawn as text only. expiresAt is an ISO time. Round 2
  // (D7): kind says which dialog to draw; fileCount is how many files an import names (0 for a
  // delete). The paths reach the window only through the agent.askFiles reply.
  'agent.permissionRequested': {
    requestId: string
    agentClient: string | null
    action: string
    target: string
    expiresAt: string
    kind: 'delete' | 'import' | 'workflow'
    fileCount: number
  }
  // spec/phases/phase-10.md, activity (A-241): one per tool call. No input, no reply.
  'agent.activity': { tool: string; projectId: string | null; ok: boolean; at: string }
  // spec/phases/round-2-platform.md, D9: show this open project in the window (a Finder open).
  'app.showProject': { projectId: string }
}

export type EventName = keyof EventMap
export const EVENT_NAMES: EventName[] = [
  'project.changed',
  'app.stateChanged',
  'job.updated',
  'asset.changedOnDisk',
  'thumbnail.changed',
  'approvals.changed',
  'approvals.progress',
  'agent.permissionRequested',
  'agent.activity',
  'app.showProject',
]
