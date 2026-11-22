// spec/screens-variants.md, "Fan-out": the fit groups show only when the master's background
// has a picture.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { VariantGet } from '@/shared/schemas/queries/variant'

// Whether the master's background shows a picture; null until variant.get answers.
export function useHasPicture(projectId: string, variantId: string): boolean | null {
  const api = useApi()
  const [picture, setPicture] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    void api.query('variant.get', { projectId, variantId }).then((r) => {
      const layers = r.ok ? (r.data as VariantGet).layers : []
      if (live) setPicture(layers.some((l) => l.type === 'background' && l.source !== null))
    })
    return () => {
      live = false
    }
  }, [api, projectId, variantId])
  return picture
}
