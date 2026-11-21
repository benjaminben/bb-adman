// spec/editor.md, "Canvas", Measuring [FR-098]: on the Scene's onSettled, when there is no
// draft, send layer.reportOverflow for each text layer whose result differs from its stored
// overflow, with the store's variant.rev. The same report (layer, rev, value) is sent once.
import { useCallback, useRef } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { VariantStore } from '@/renderer/stores/variant-store'
import type { SceneSettled } from '@/shared/scene/types'

export function useOverflowReport(projectId: string, store: VariantStore) {
  const command = useApp((s) => s.command)
  const sent = useRef(new Set<string>())
  return useCallback(
    (result: SceneSettled) => {
      const { draft, layers, variant } = store.getState()
      if (draft || !variant) return
      for (const [layerId, overflow] of Object.entries(result.overflow)) {
        const layer = layers[layerId]
        if (!layer || layer.overflow === overflow) continue
        const key = `${layerId}:${variant.rev}:${overflow}`
        if (sent.current.has(key)) continue
        sent.current.add(key)
        void command('layer.reportOverflow', {
          projectId,
          layerId,
          overflow,
          variantRev: variant.rev,
        })
      }
    },
    [command, projectId, store],
  )
}
