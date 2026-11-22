// Quick look (spec/screens-variants.md, "Quick look") [REQ: FR-244]: one variant's picture at
// 1024, view only, no tab opens (A-142). Title "{title} · {sizeLabel} · {language}". "Previous"
// and "Next", and the Left and Right arrow keys, move through every variant of the campaign in
// the grids' order, wrapping at the ends. Escape or "Close" closes; the dialog frame gives
// focus back to the "Quick look" button that opened it. DLG-7: kind="review"; "Previous" and
// "Next" are icon buttons on the picture's sides, the count reads "{i} / {n}", and while the
// picture draws a spinner shows with "Drawing the variant…" as a hidden status.
import { useEffect, useState } from 'react'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { Icon } from '@/renderer/ui/icon'
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

function Step(props: { label: 'Previous' | 'Next'; onClick: () => void }) {
  return (
    <button
      type="button"
      className={layout.iconButton}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      <Icon name={props.label === 'Previous' ? 'left' : 'right'} />
    </button>
  )
}

function Picture(props: { projectId: string; variant: VariantSummary | null }) {
  const v = props.variant
  const view = useVariantPicture(props.projectId, v?.id ?? null, v?.rev ?? 0)
  if (view.kind === 'failed') return <p className={layout.muted}>The picture could not be drawn.</p>
  if (view.kind === 'drawing') {
    return (
      <p role="status" className={styles.drawing}>
        <BusySpinner />
        <span className={styles.hidden}>Drawing the variant…</span>
      </p>
    )
  }
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
      kind="review"
      footer={
        <>
          <span className={styles.count}>{`${index + 1} / ${variants.length}`}</span>
          <button type="button" onClick={props.onClose}>
            Close
          </button>
        </>
      }
    >
      <div className={styles.view}>
        <Step label="Previous" onClick={() => move(-1)} />
        <div className={styles.frame}>
          <Picture projectId={props.projectId} variant={open ? shown : null} />
        </div>
        <Step label="Next" onClick={() => move(1)} />
      </div>
    </DialogFrame>
  )
}
