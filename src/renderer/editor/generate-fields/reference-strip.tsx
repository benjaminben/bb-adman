// The chosen reference pictures as a strip of thumbnails (design wave ED-4a), each named by its
// display name and drawn through assetUrl, each with a ✕ "Remove {name}", then a dashed "+"
// "Choose reference pictures…" that opens the reference dialog. A ✕ changes the draft as the
// dialog does; nothing is sent. The project's images are read once and again when a chosen
// picture is not among them (one just made or added). No path or hash is drawn.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { assetUrl } from '@/renderer/ui/asset-url'
import { PhotoStrip, type StripPhoto } from '@/renderer/ui/photo-strip'
import type { AssetList } from '@/shared/schemas/queries/asset'

export const CHOOSE_REFERENCES = 'Choose reference pictures…'
const UNKNOWN = 'Picture'

function useImages(projectId: string, chosen: readonly string[]) {
  const api = useApi()
  const [images, setImages] = useState<AssetList | null>(null)
  const unknown =
    images === null ? '' : chosen.filter((id) => !images.some((a) => a.id === id)).join(' ')
  useEffect(() => {
    let live = true
    void api.query('asset.list', { projectId, kind: 'image' }).then((got) => {
      if (live) setImages(got.ok ? ((got.data as AssetList | null) ?? []) : [])
    })
    return () => {
      live = false
    }
  }, [api, projectId, unknown])
  return images
}

export type ReferenceStripProps = {
  projectId: string
  chosen: string[]
  disabled: boolean
  onChange: (ids: string[]) => void
  onChoose: () => void
}

export function ReferenceStrip(props: ReferenceStripProps) {
  const { projectId, chosen } = props
  const images = useImages(projectId, chosen)
  const removes = useRef(new Map<string, HTMLButtonElement>())
  const holder = useRef<HTMLDivElement>(null)
  const focusAt = useRef<number | null>(null)

  // After a ✕ the focus goes to the next ✕, else the one before, else the "+".
  useEffect(() => {
    const at = focusAt.current
    if (at === null) return
    focusAt.current = null
    const id = chosen[Math.min(at, chosen.length - 1)]
    const next = id === undefined ? undefined : removes.current.get(id)
    if (next) next.focus()
    else
      holder.current
        ?.querySelector<HTMLButtonElement>(`[aria-label="${CHOOSE_REFERENCES}"]`)
        ?.focus()
  }, [chosen])

  const photos: StripPhoto[] = chosen.map((id) => {
    const row = images?.find((a) => a.id === id)
    const name = row?.displayName ?? UNKNOWN
    return {
      id,
      name,
      src: row === undefined || row.missing ? null : assetUrl(projectId, id),
      removable: true,
      removeLabel: `Remove ${name}`,
    }
  })

  function remove(id: string) {
    focusAt.current = chosen.indexOf(id)
    props.onChange(chosen.filter((c) => c !== id))
  }

  return (
    <div ref={holder}>
      <PhotoStrip
        label="Reference pictures"
        photos={photos}
        size="small"
        disabled={props.disabled}
        addLabel={CHOOSE_REFERENCES}
        adding={false}
        onAdd={props.onChoose}
        onRemove={remove}
        removeRef={(id, el) => {
          if (el) removes.current.set(id, el)
          else removes.current.delete(id)
        }}
      />
    </div>
  )
}
