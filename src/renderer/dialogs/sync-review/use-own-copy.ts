// The variant's own text per layer key, read with variant.get, so the sync review can show it
// beside the master's new text (DLG-7). A read only; an unreadable variant gives no texts.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { VariantGet } from '@/shared/schemas/queries/variant'

const NONE: ReadonlyMap<string, string> = new Map()

export function useOwnCopy(projectId: string, variantId: string): ReadonlyMap<string, string> {
  const api = useApi()
  const [copy, setCopy] = useState<{ id: string; texts: ReadonlyMap<string, string> }>()
  useEffect(() => {
    let live = true
    void api.query('variant.get', { projectId, variantId }).then((reply) => {
      if (!live) return
      const layers = reply.ok ? ((reply.data as VariantGet | null)?.layers ?? []) : []
      const texts = new Map<string, string>()
      for (const layer of layers)
        if (typeof layer.copy === 'string') texts.set(layer.key, layer.copy)
      setCopy({ id: variantId, texts })
    })
    return () => {
      live = false
    }
  }, [api, projectId, variantId])
  return copy?.id === variantId ? copy.texts : NONE
}
