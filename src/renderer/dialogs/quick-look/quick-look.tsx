// Quick look (spec/screens-variants.md, "Quick look") [REQ: FR-244]: one variant's picture at
// 1024, view only, no tab opens (A-142). Title "{title} · {sizeLabel} · {language}". "Previous"
// and "Next", and the Left and Right arrow keys, move through every variant of the campaign in
// the grids' order, wrapping at the ends, with the line "{i} of {n}". Escape or "Close" closes;
// the dialog frame gives focus back to the "Quick look" button that opened it.
import { useEffect, useState } from 'react'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'
import { useVariantPicture } from './use-variant-picture'
import styles from './quick-look.module.css'

export type QuickLookProps = {
  projectId: string
  // Every variant of the campaign, in the grids' order.
  variants: VariantSummary[]
  // The variant it opens on; null while closed.
  startId: string | null
  onClose: () => void
}

// The variant `by` places on from `index`, wrapping at the ends.
function stepFrom(variants: VariantSummary[], index: number, by: number): string | null {
  const n = variants.length
  return variants[(((index + by) % n) + n) % n]?.id ?? null
}

function Picture(props: { projectId: string; variant: VariantSummary | null }) {
  const v = props.variant
  const view = useVariantPicture(props.projectId, v?.id ?? null, v?.rev ?? 0)
  if (view.kind === 'failed') return <p className={layout.muted}>The picture could not be drawn.</p>
  if (view.kind === 'drawing') return <p className={layout.muted}>Drawing the variant…</p>
  return <img className={styles.picture} src={view.url} alt={v?.title ?? ''} />
}

export function QuickLook(props: QuickLookProps) {
  const { variants } = props
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  if (props.startId !== openedOn) {
    setOpenedOn(props.startId)
    setShownId(props.startId)
  }
  const index = variants.findIndex((v) => v.id === shownId)
  const shown = index === -1 ? null : variants[index]!
  const open = props.startId !== null && shown !== null
  // The shown variant left the campaign (a delete elsewhere): the dialog closes.
  const { onClose } = props
  const gone = props.startId !== null && shown === null
  useEffect(() => {
    if (gone) onClose()
  }, [gone, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setShownId(stepFrom(variants, index, 1))
      else if (event.key === 'ArrowLeft') setShownId(stepFrom(variants, index, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, variants])

  const move = (by: number) => setShownId(stepFrom(variants, index, by))
  const title = shown ? `${shown.title} · ${shown.sizeLabel} · ${shown.language}` : ''

  return (
    <DialogFrame
      open={open}
      onClose={props.onClose}
      title={title}
      size="large"
      footer={
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      }
    >
      <div className={styles.view}>
        <Picture projectId={props.projectId} variant={open ? shown : null} />
      </div>
      <div className={styles.steps}>
        <button type="button" onClick={() => move(-1)}>
          Previous
        </button>
        <span>{`${index + 1} of ${variants.length}`}</span>
        <button type="button" onClick={() => move(1)}>
          Next
        </button>
      </div>
    </DialogFrame>
  )
}
