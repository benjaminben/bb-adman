// spec/editor.md, "Variant tabs" and "What each tab keeps" [FR-212, FR-213, Q-042]: inside a
// campaign tab, "Overview" and then one tab per open variant, named "{title} · {sizeLabel} ·
// {language}", each with its marks and a close button. Only the shown tab's content is drawn;
// a variant tab's content comes from renderVariant, given the tab's kept view.
import * as Tabs from '@radix-ui/react-tabs'
import { useCallback, type ReactNode } from 'react'
import { useNav } from '@/renderer/app/nav-context'
import { OVERVIEW_TAB, campaignNav, tabView, type TabView } from '@/renderer/stores/nav-store'
import { TabMarks, anyMark } from '@/renderer/ui/tab-marks'
import { TabRow, type TabItem } from '@/renderer/ui/tab-row'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import styles from './variant-tabs.module.css'

export type ViewChange = (change: Partial<TabView>) => void

export type VariantTabsProps = {
  projectId: string
  campaignId: string
  variants: VariantSummary[]
  overview: ReactNode
  renderVariant: (variantId: string, view: TabView, onView: ViewChange) => ReactNode
}

export const tabName = (v: VariantSummary) => `${v.title} · ${v.sizeLabel} · ${v.language}`

function VariantContent(props: VariantTabsProps & { variantId: string }) {
  const { projectId, variantId } = props
  const view = useNav((s) => tabView(s, projectId, variantId))
  const setView = useNav((s) => s.setView)
  const onView = useCallback<ViewChange>(
    (change) => setView(projectId, variantId, change),
    [setView, projectId, variantId],
  )
  return props.renderVariant(variantId, view, onView)
}

export function VariantTabs(props: VariantTabsProps) {
  const { projectId, campaignId } = props
  const nav = useNav((s) => campaignNav(s, projectId, campaignId))
  const showVariant = useNav((s) => s.showVariant)
  const closeVariant = useNav((s) => s.closeVariant)
  const open = nav.variantTabs
    .map((id) => props.variants.find((v) => v.id === id))
    .filter((v) => v !== undefined)
  const shown = open.some((v) => v.id === nav.shown) ? nav.shown : OVERVIEW_TAB
  const items: TabItem[] = [
    { value: OVERVIEW_TAB, label: 'Overview' },
    ...open.map((v) => {
      const { jobRunning, resultUnseen, outOfDate } = v.badges
      const marks = { running: jobRunning, unseen: resultUnseen, attention: outOfDate }
      return {
        value: v.id,
        label: tabName(v),
        marks: anyMark(marks) && <TabMarks {...marks} />,
        close: { label: 'Close tab', onClose: () => closeVariant(projectId, campaignId, v.id) },
      }
    }),
  ]

  return (
    <Tabs.Root
      value={shown}
      onValueChange={(tab) => showVariant(projectId, campaignId, tab)}
      className={styles.tabs}
    >
      <TabRow label="Open variants" items={items} value={shown} />
      <Tabs.Content value={OVERVIEW_TAB} className={styles.overview}>
        {props.overview}
      </Tabs.Content>
      {open.map((v) => (
        <Tabs.Content key={v.id} value={v.id} className={styles.variant}>
          <VariantContent {...props} variantId={v.id} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
