// Quick look's picture (spec/screens-variants.md, "Quick look"): variant.render at
// maxDimension 1024, asked for the shown variant and again when its rev changes. The PNG is
// shown through an object URL, freed when a newer picture replaces it or the dialog goes away.
// A reply for a variant no longer shown is dropped.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { VariantRender } from '@/shared/schemas/queries/render'

export type PictureView =
  { kind: 'drawing' } | { kind: 'picture'; url: string } | { kind: 'failed' }

export function useVariantPicture(
  projectId: string,
  variantId: string | null,
  rev: number,
): PictureView {
  const api = useApi()
  const [view, setView] = useState<PictureView>({ kind: 'drawing' })
  const shownUrl = useRef<string | null>(null)

  useEffect(() => {
    const show = (next: PictureView) => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current)
      shownUrl.current = next.kind === 'picture' ? next.url : null
      setView(next)
    }
    show({ kind: 'drawing' })
    if (variantId === null) return
    let live = true
    void api.query('variant.render', { projectId, variantId, maxDimension: 1024 }).then((reply) => {
      if (!live) return
      if (!reply.ok || !reply.data) return show({ kind: 'failed' })
      const { png } = reply.data as VariantRender
      const blob = new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' })
      show({ kind: 'picture', url: URL.createObjectURL(blob) })
    })
    return () => {
      live = false
    }
  }, [api, projectId, variantId, rev])

  useEffect(
    () => () => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current)
      shownUrl.current = null
    },
    [],
  )

  return view
}
