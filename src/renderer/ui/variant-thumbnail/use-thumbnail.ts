// The thumbnail read (spec/editor.md, "Thumbnails on the screens"; spec/editor-commands.md,
// "thumbnail.get"): asks on mount and on each new rev, and again on each thumbnail.changed for
// this variant (a pending answer is followed by one). A ready PNG is shown through an object
// URL, freed when a newer one replaces it or the component goes away. An answer from an older
// ask, an older rev or after removal is dropped. A refused ask is shown as failed.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ThumbnailGet } from '@/shared/schemas/queries/render'

export type ThumbnailView = { kind: 'none' } | { kind: 'picture'; url: string } | { kind: 'failed' }

export function useThumbnail(projectId: string, variantId: string, rev: number): ThumbnailView {
  const api = useApi()
  const [view, setView] = useState<ThumbnailView>({ kind: 'none' })
  const shownUrl = useRef<string | null>(null)

  useEffect(() => {
    let latest = 0
    const show = (next: ThumbnailView) => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current)
      shownUrl.current = next.kind === 'picture' ? next.url : null
      setView(next)
    }
    const ask = async () => {
      const turn = ++latest
      const reply = await api.query('thumbnail.get', { projectId, variantId })
      if (turn !== latest) return
      if (!reply.ok) return show({ kind: 'failed' })
      const answer = reply.data as ThumbnailGet | null
      if (!answer) return
      if (answer.state === 'failed') return show({ kind: 'failed' })
      if (answer.state === 'ready') {
        const blob = new Blob([answer.png as Uint8Array<ArrayBuffer>], { type: 'image/png' })
        show({ kind: 'picture', url: URL.createObjectURL(blob) })
      }
    }
    void ask()
    const stop = api.on('thumbnail.changed', (payload) => {
      if (payload.projectId === projectId && payload.variantId === variantId) void ask()
    })
    return () => {
      latest = -1
      stop()
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
