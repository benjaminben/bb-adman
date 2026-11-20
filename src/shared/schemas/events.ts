// SPEC 4.4 events from the main process to the window. Phase 1 emits
// project.changed and app.stateChanged; the others arrive with later phases.
export type Actor = 'user' | 'agent'

export type ProjectChangedPayload = {
  projectId: string
  changed: Record<string, unknown[]>
  removed: Record<string, string[]>
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
