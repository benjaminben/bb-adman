// P7-20 (spec/phases/phase-07-slices-2.md): the background row of the timeline. Its lane shows
// the variant's clips from the variant store as blocks, in track order, each named by its file's
// display name ("File not found" when missing, ED-6); a gap is left as empty track, and the
// part of a clip past the variant's end is not drawn. "Add clip…" opens the add list under the
// row; the chosen clip's actions sit over its block, and a refused command's own sentence stands
// last, as an alert. R2E-11 (D7): "Make a video…" beside "Add clip…" calls onMakeVideo, which
// the editor passes.
import { useId, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { AddClipButton, AddClipList } from '@/renderer/editor/add-clip'
import { ClipBlock, type ClipKind } from '@/renderer/editor/clip-block'
import type { HeldAsset, VariantStore } from '@/renderer/stores/variant-store'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './clip-track.module.css'

export type ClipTrackProps = {
  projectId: string
  variant: VariantSummary
  store: VariantStore
  onMakeVideo?: () => void
}

type Shown = { clip: BackgroundClipRow; label: string; kind: ClipKind; fileMs: number | null }

function shownClips(
  clips: Record<string, BackgroundClipRow>,
  assets: Record<string, HeldAsset>,
): Shown[] {
  const ordered = Object.values(clips).sort(
    (a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id),
  )
  return ordered.map((clip) => {
    const asset = assets[clip.assetId]
    const kind: ClipKind = asset?.kind === 'video' ? 'video' : 'image'
    const label = asset?.displayName ?? 'File not found'
    return { clip, label, kind, fileMs: kind === 'video' ? (asset?.durationMs ?? null) : null }
  })
}

export function ClipTrack({ projectId, variant, store, onMakeVideo }: ClipTrackProps) {
  const listId = useId()
  const clips = useStore(store, (s) => s.clips)
  const assets = useStore(store, (s) => s.assets)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const shown = useMemo(() => shownClips(clips, assets), [clips, assets])
  const track = useMemo(
    () => shown.map(({ clip: { id, startMs, inMs, outMs } }) => ({ id, startMs, inMs, outMs })),
    [shown],
  )

  return (
    <div className={styles.track}>
      <div className={styles.row}>
        <div className={styles.name}>
          <span className={styles.title}>Background</span>
          <span className={layout.row}>
            {onMakeVideo && (
              <button type="button" className={layout.small} onClick={onMakeVideo}>
                Make a video…
              </button>
            )}
            <AddClipButton open={adding} listId={listId} onToggle={() => setAdding(!adding)} />
          </span>
        </div>
        <ul className={styles.lane} aria-label="Clips" data-clip-lane>
          {shown.map((s) => (
            <li key={s.clip.id}>
              <ClipBlock
                {...s}
                durationMs={variant.durationMs}
                projectId={projectId}
                track={track}
                selected={s.clip.id === selectedId}
                onSelect={() => setSelectedId(s.clip.id)}
                onResult={setError}
              />
            </li>
          ))}
        </ul>
      </div>
      {adding && (
        <AddClipList
          projectId={projectId}
          listId={listId}
          variantId={variant.id}
          onRefusal={setError}
          onClose={() => setAdding(false)}
        />
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
