// P7-22: what the "Make a video" card needs to know of its post, from the variant store
// (variant.get, kept current from project.changed): its format, null until it is read, and
// whether its background layer has a picture.
import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useApi } from '@/renderer/app/app-context'
import { createVariantStore } from '@/renderer/stores/variant-store'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type Post = { format: VariantRow['format'] | null; backgroundPicture: boolean }

export function usePost(projectId: string, variantId: string): Post {
  const api = useApi()
  const [store] = useState(() => createVariantStore(api, projectId, variantId))
  const format = useStore(store, (s) => s.variant?.format ?? null)
  const backgroundPicture = useStore(store, (s) =>
    Object.values(s.layers).some((l) => l.type === 'background' && l.source != null),
  )

  useEffect(() => {
    const stop = store.getState().subscribe()
    void store.getState().load()
    return stop
  }, [store])

  return { format, backgroundPicture }
}
