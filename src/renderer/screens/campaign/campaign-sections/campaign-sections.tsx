// The overview's Phase 6 sections under the run list (spec/phases/phase-06.md, design
// addition 8): rule set, checks, translations, in that order. Translations shows only when the
// campaign has a language other than its primary one.
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { CheckPanel } from '@/renderer/screens/campaign/check-panel'
import { RuleSetPanel } from '@/renderer/screens/campaign/rule-set-panel'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'

export type CampaignSectionProps = { projectId: string; campaignId: string; data: CampaignGet }

export function CampaignSections(props: CampaignSectionProps) {
  const { primaryLanguage, languages } = props.data.campaign
  const translated = languages.some((language) => language !== primaryLanguage)
  return (
    <>
      <RuleSetPanel {...props} />
      <CheckPanel {...props} />
      {translated && <TranslationPanel {...props} />}
    </>
  )
}
