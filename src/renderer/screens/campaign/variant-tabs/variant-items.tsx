// The open variants' tabs in the campaign's one strip (CAMP-3, C-10): each named "{sizeLabel} ·
// {language}", with the title first only when titles differ within the campaign; a small
// thumbnail before the name (hidden from assistive tech), its marks, and "Close tab". The first
// variant tab draws the thin divider after the views.
import type { ReactNode } from 'react'
import { TabMarks, anyMark } from '@/renderer/ui/tab-marks'
import type { TabItem } from '@/renderer/ui/tab-row'
import { useThumbnail } from '@/renderer/ui/variant-thumbnail/use-thumbnail'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import styles from './variant-tabs.module.css'

export const titlesDiffer = (variants: VariantSummary[]) =>
  new Set(variants.map((v) => v.title)).size > 1

export const tabName = (v: VariantSummary, withTitle: boolean) =>
  withTitle ? `${v.title} · ${v.sizeLabel} · ${v.language}` : `${v.sizeLabel} · ${v.language}`

// Only a ready picture is drawn: "No preview" would add words to the tab's name.
function TabThumb(props: { projectId: string; variant: VariantSummary }) {
  const view = useThumbnail(props.projectId, props.variant.id, props.variant.rev)
  return (
    <span className={styles.thumb} aria-hidden="true">
      {view.kind === 'picture' && <img src={view.url} alt="" />}
    </span>
  )
}

function label(projectId: string, v: VariantSummary, name: string): ReactNode {
  return (
    <span className={styles.label}>
      <TabThumb projectId={projectId} variant={v} />
      {name}
    </span>
  )
}

export function variantItems(
  projectId: string,
  all: VariantSummary[],
  open: VariantSummary[],
  onClose: (variantId: string) => void,
): TabItem[] {
  const withTitle = titlesDiffer(all)
  return open.map((v, index) => {
    const { jobRunning, resultUnseen, outOfDate } = v.badges
    const marks = { running: jobRunning, unseen: resultUnseen, attention: outOfDate }
    return {
      value: v.id,
      label: label(projectId, v, tabName(v, withTitle)),
      marks: anyMark(marks) && <TabMarks {...marks} />,
      close: { label: 'Close tab', onClose: () => onClose(v.id) },
      divider: index === 0,
    }
  })
}
