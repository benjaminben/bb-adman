// spec/scene.md "One draw" step 4: the main process takes a render window's reply only through
// this check. Pure: the Electron event is read through the shape the sender check needs.
import { fromMainFrame, type SenderEvent } from '@/main/ipc'
import { RenderDone } from '@/shared/schemas/render'

export type DoneExpectation = {
  contents: { mainFrame: { processId: number; routingId: number } }
  requestId: string
  textLayerIds: readonly string[]
}

// The overflow map when the reply comes from the render window's main frame, answers the
// awaited request and passes the RenderDone schema; null otherwise. Only text layers of the
// request are kept.
export function acceptDone(
  event: SenderEvent,
  message: unknown,
  expected: DoneExpectation,
): Record<string, boolean> | null {
  if (!fromMainFrame(event, expected.contents)) return null
  const parsed = RenderDone.safeParse(message)
  if (!parsed.success || parsed.data.requestId !== expected.requestId) return null
  const overflow: Record<string, boolean> = {}
  for (const id of expected.textLayerIds) {
    const value = Object.hasOwn(parsed.data.overflow, id) ? parsed.data.overflow[id] : undefined
    if (typeof value === 'boolean') overflow[id] = value
  }
  return overflow
}
