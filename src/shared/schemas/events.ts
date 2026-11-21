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
}

export type EventName = keyof EventMap
export const EVENT_NAMES: EventName[] = [
  'project.changed',
  'app.stateChanged',
  'job.updated',
  'asset.changedOnDisk',
]
