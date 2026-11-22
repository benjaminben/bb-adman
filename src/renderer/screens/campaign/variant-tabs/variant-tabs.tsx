// spec/editor.md, "Variant tabs" and "What each tab keeps" [FR-212, FR-213, Q-042]; CAMP-3
// (C-10): the campaign's one tab strip, "Campaign". The views come first (Variants, Checks,
// Translations, given by the overview; alone, one "Variants" tab), a thin divider, then one tab
// per open variant with its marks and a close button. Choosing a view shows the overview
// (OVERVIEW_TAB in the nav store) at that view; choosing a variant shows it. `end` (Undo and
// Redo) sits at the strip's right while a view shows. Only the shown tab's content is drawn; a
// variant tab's content comes from renderVariant, given the tab's kept view. Closing a tab whose
// attached jobs still run asks first (spec/screens-ai.md, "Where it shows").
import * as Tabs from '@radix-ui/react-tabs'
import { useCallback, type ReactNode } from 'react'
import { useNav } from '@/renderer/app/nav-context'
import { OVERVIEW_TAB, campaignNav, tabView, type TabView } from '@/renderer/stores/nav-store'
import { variantJobs } from '@/renderer/stores/attached-store'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { TabRow, type TabItem } from '@/renderer/ui/tab-row'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { variantItems } from './variant-items'
import styles from './variant-tabs.module.css'

export type ViewChange = (change: Partial<TabView>) => void

// The view tabs: their items (values are view names), the shown view and its setter.
export type ViewTabs = { items: TabItem[]; value: string; onChange: (value: string) => void }

export type VariantTabsProps = {
  projectId: string
  campaignId: string
  variants: VariantSummary[]
  overview: ReactNode
  renderVariant: (variantId: string, view: TabView, onView: ViewChange) => ReactNode
  views?: ViewTabs
  end?: ReactNode
}

// View tab values carry a prefix, so a view never meets a variant id.
const VIEW = 'view:'
const ALONE: ViewTabs = {
  items: [{ value: OVERVIEW_TAB, label: 'Variants' }],
  value: OVERVIEW_TAB,
  onChange: () => {},
}

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
  const views = props.views ?? ALONE
  const nav = useNav((s) => campaignNav(s, projectId, campaignId))
  const showVariant = useNav((s) => s.showVariant)
  const closeVariant = useNav((s) => s.closeVariant)
  const { ask, warning } = useCloseWarning('tab')
  const close = (variantId: string) =>
    ask(
      (s) => variantJobs(s, projectId, [variantId]),
      () => closeVariant(projectId, campaignId, variantId),
    )
  const open = nav.variantTabs
    .map((id) => props.variants.find((v) => v.id === id))
    .filter((v) => v !== undefined)
  const shown = open.some((v) => v.id === nav.shown) ? nav.shown : OVERVIEW_TAB
  const onOverview = shown === OVERVIEW_TAB
  const viewItems = views.items.map((item) => ({ ...item, value: VIEW + item.value }))
  const items = [...viewItems, ...variantItems(projectId, props.variants, open, close)]
  const value = onOverview ? VIEW + views.value : shown

  const choose = (tab: string) => {
    if (!tab.startsWith(VIEW)) return showVariant(projectId, campaignId, tab)
    showVariant(projectId, campaignId, OVERVIEW_TAB)
    views.onChange(tab.slice(VIEW.length))
  }

  return (
    <Tabs.Root value={value} onValueChange={choose} className={styles.tabs}>
      <div className={styles.strip}>
        <div className={styles.row}>
          <TabRow label="Campaign" items={items} value={value} />
        </div>
        {onOverview && props.end !== undefined && <div className={styles.end}>{props.end}</div>}
      </div>
      {viewItems.map((item) => (
        <Tabs.Content key={item.value} value={item.value} className={styles.overview}>
          {props.overview}
        </Tabs.Content>
      ))}
      {open.map((v) => (
        <Tabs.Content key={v.id} value={v.id} className={styles.variant}>
          <VariantContent {...props} variantId={v.id} />
        </Tabs.Content>
      ))}
      {warning}
    </Tabs.Root>
  )
}
