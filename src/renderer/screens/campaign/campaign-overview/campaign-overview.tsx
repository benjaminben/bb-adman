// R2C-1 (spec/phases/round-2-campaign.md, design addition 1) and CAMP-3 (C-10): the campaign's
// tabs. One strip "Campaign" (variant-tabs/) holds the three views, Variants, Checks and
// Translations, then the open variants, with the campaign's Undo and Redo at its right while a
// view shows. Variants holds what the page gives it; Checks the check panel then the rule set it
// runs against (A-305); Translations the translation panel, or an EmptyState when every
// language is the primary one (A-304). Which view shows is the page's state.
import type { ReactNode } from 'react'
import { CampaignUndo } from '@/renderer/screens/campaign/campaign-undo'
import { CheckPanel } from '@/renderer/screens/campaign/check-panel'
import { RuleSetPanel } from '@/renderer/screens/campaign/rule-set-panel'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import { languageName } from '@/renderer/screens/campaign/translation-panel/translation-words'
import { VariantTabs, type VariantTabsProps } from '@/renderer/screens/campaign/variant-tabs'
import { EmptyState } from '@/renderer/ui/empty-state'
import type { CampaignTabProps } from './tab-props'
import { useViewTabItems, type CampaignViewName } from './view-tab-items'

export type CampaignOverviewProps = CampaignTabProps & {
  view: CampaignViewName
  onView: (view: CampaignViewName) => void
  variants: ReactNode
  renderVariant?: VariantTabsProps['renderVariant']
}

const VIEWS: readonly string[] = ['variants', 'checks', 'translations']
const isView = (value: string): value is CampaignViewName => VIEWS.includes(value)
const noVariant = () => null

function Translations(props: CampaignTabProps) {
  const { primaryLanguage, languages } = props.data.campaign
  if (languages.some((language) => language !== primaryLanguage))
    return <TranslationPanel {...props} />
  return <EmptyState icon="globe" words={`One language: ${languageName(primaryLanguage)}`} />
}

function ViewPanel(props: CampaignOverviewProps) {
  const tab = { projectId: props.projectId, campaignId: props.campaignId, data: props.data }
  if (props.view === 'checks')
    return (
      <>
        <CheckPanel {...tab} />
        <RuleSetPanel {...tab} />
      </>
    )
  if (props.view === 'translations') return <Translations {...tab} />
  return props.variants
}

export function CampaignOverview(props: CampaignOverviewProps) {
  const { projectId, campaignId, data, view, onView } = props
  const items = useViewTabItems(projectId, campaignId)
  return (
    <VariantTabs
      projectId={projectId}
      campaignId={campaignId}
      variants={data.variants}
      views={{ items, value: view, onChange: (value) => isView(value) && onView(value) }}
      end={<CampaignUndo projectId={projectId} campaignId={campaignId} />}
      overview={<ViewPanel {...props} />}
      renderVariant={props.renderVariant ?? noVariant}
    />
  )
}
