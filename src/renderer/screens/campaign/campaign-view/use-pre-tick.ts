// SP-7 (A-120): when the page opens, and when the chosen variant changes while nothing is
// ticked, the ticks become the variant's subject photos. Heard from the picker's reads, once
// per variant shown: a later read (after "Add pictures") or a read of a variant no longer
// shown changes nothing, and a tick the user set is never replaced. Moved out of
// campaign-view.tsx (P5-14), unchanged.
import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { subjectPhotoIds } from '@/renderer/ui/reference-picker/reference-rows'

export function usePreTick(
  variant: VariantSummary | undefined,
  setTicks: Dispatch<SetStateAction<string[]>>,
) {
  const variantId = variant?.id ?? null
  const subjectKey = JSON.stringify(variant?.subjectIds ?? [])
  const shownId = useRef(variantId)
  const doneFor = useRef<string | null>(null)
  useEffect(() => {
    shownId.current = variantId
  }, [variantId])
  return useCallback(
    (rows: AssetList) => {
      if (variantId === null || shownId.current !== variantId || doneFor.current === variantId)
        return
      doneFor.current = variantId
      const ids = subjectPhotoIds(rows, JSON.parse(subjectKey) as string[])
      setTicks((t) => (t.length > 0 ? t : ids))
    },
    [variantId, subjectKey, setTicks],
  )
}
