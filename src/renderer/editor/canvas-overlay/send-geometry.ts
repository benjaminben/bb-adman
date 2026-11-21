// spec/editor.md, "Moving, resizing and rotating": a drag or a nudge burst ends in one
// layer.update holding only the geometry fields that changed. The draft is dropped when the
// reply comes, whatever it says (a refusal shows in the app's banner through the app store).
import type { Result } from '@/shared/schemas/result'
import type { Geometry } from '@/shared/schemas/layer'
import type { VariantStore } from '@/renderer/stores/variant-store'

export type Command = (name: string, input: unknown) => Promise<Result<unknown>>

type Moving = Partial<Omit<Geometry, 'crop'>>

function changed(stored: Geometry, moving: Moving): Moving {
  const out: Moving = {}
  for (const key of ['x', 'y', 'width', 'height', 'rotation'] as const) {
    const value = moving[key]
    if (value !== undefined && value !== stored[key]) out[key] = value
  }
  return out
}

export async function sendGeometry(
  store: VariantStore,
  command: Command,
  projectId: string,
): Promise<void> {
  const draft = store.getState().draft
  if (!draft) return
  const stored = store.getState().layers[draft.layerId]
  const patch = stored ? changed(stored.geometry, draft.geometry) : {}
  if (Object.keys(patch).length > 0) {
    await command('layer.update', { projectId, layerId: draft.layerId, patch: { geometry: patch } })
  }
  // A later drag may have started meanwhile; its draft stays.
  if (store.getState().draft === draft) store.getState().dropDraft()
}
