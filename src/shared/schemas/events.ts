// SPEC 4.4 events from the main process to the window. Phase 1 emits
// project.changed and app.stateChanged; the others arrive with later phases.
import type { TableName } from './rows/keys'

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
  // Not in SPEC 4.4: tells every window to re-read app.getState after a project
  // opens or closes or settings change, including opens started by the OS.
  'app.stateChanged': Record<string, never>
}

export type EventName = keyof EventMap
export const EVENT_NAMES: EventName[] = ['project.changed', 'app.stateChanged']
