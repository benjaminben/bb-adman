// spec/phases/round-2-editor.md, D1 [R2E-1]: whether the variant's text layers already hold
// words, read once from variant.get; null until it answers. A failed or empty read is false.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { hasWordsOnLayers } from '@/shared/generation/prompt'
import type { VariantGet } from '@/shared/schemas/queries/variant'

export function useWordsOnLayers(projectId: string, variantId: string): boolean | null {
  const api = useApi()
  const [words, setWords] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    void api.query('variant.get', { projectId, variantId }).then((r) => {
      const data = r.ok ? (r.data as VariantGet | null) : null
      if (live) setWords(hasWordsOnLayers(data?.layers ?? []))
    })
    return () => {
      live = false
    }
  }, [api, projectId, variantId])
  return words
}
