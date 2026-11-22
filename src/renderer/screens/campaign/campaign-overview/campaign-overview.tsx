// R2C-1 (spec/phases/round-2-campaign.md, design addition 1, items 9 and R-8): the overview's
// view bar, the tab list "Campaign views" on the left and the campaign's Undo and Redo on the
// right, then the shown view. Variants holds what the page gives it; Checks the check panel then
// the rule set it runs against (A-305); Translations the translation panel, or one line when
// every language is the primary one (A-304). Which view shows is the page's state.
import * as Tabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { CampaignUndo } from '@/renderer/screens/campaign/campaign-undo'
import { CheckPanel } from '@/renderer/screens/campaign/check-panel'
import { RuleSetPanel } from '@/renderer/screens/campaign/rule-set-panel'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import { languageName } from '@/renderer/screens/campaign/translation-panel/translation-words'
import { TabRow } from '@/renderer/ui/tab-row'
import layout from '@/renderer/ui/layout.module.css'
import styles from './campaign-overview.module.css'
import type { CampaignTabProps } from './tab-props'
import { useViewTabItems, type CampaignViewName } from './view-tab-items'

export type CampaignOverviewProps = CampaignTabProps & {
  view: CampaignViewName
  onView: (view: CampaignViewName) => void
  variants: ReactNode
}

const VIEWS: readonly string[] = ['variants', 'checks', 'translations']
const isView = (value: string): value is CampaignViewName => VIEWS.includes(value)

function Translations(props: CampaignTabProps) {
  const { primaryLanguage, languages } = props.data.campaign
  if (languages.some((language) => language !== primaryLanguage))
    return <TranslationPanel {...props} />
  return (
    <p className={layout.muted}>
      This campaign has one language, {languageName(primaryLanguage)}, so there is nothing to
      translate.
    </p>
  )
}

export function CampaignOverview(props: CampaignOverviewProps) {
  const { projectId, campaignId, data, view, onView } = props
  const items = useViewTabItems(projectId, campaignId)
  const tab = { projectId, campaignId, data }
  return (
    <Tabs.Root
      value={view}
      onValueChange={(value) => isView(value) && onView(value)}
      className={styles.overview}
    >
      <div className={styles.bar}>
        <div className={styles.views}>
          <TabRow label="Campaign views" items={items} value={view} />
        </div>
        <div className={styles.undo}>
          <CampaignUndo projectId={projectId} campaignId={campaignId} />
        </div>
      </div>
      <Tabs.Content value="variants" className={styles.panel}>
        {props.variants}
      </Tabs.Content>
      <Tabs.Content value="checks" className={styles.panel}>
        <CheckPanel {...tab} />
        <RuleSetPanel {...tab} />
      </Tabs.Content>
      <Tabs.Content value="translations" className={styles.panel}>
        <Translations {...tab} />
      </Tabs.Content>
    </Tabs.Root>
  )
}
