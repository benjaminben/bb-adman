// The "Brand and legal rules" section of the campaign overview (spec/phases/phase-06.md, design
// addition 8; P6-10): "Palette", "Required files" and "Words". Every change sends
// ruleSet.update with the one list changed; a refusal's own message shows under that list.
import type { CampaignTabProps as CampaignSectionProps } from '@/renderer/screens/campaign/campaign-overview'
import layout from '@/renderer/ui/layout.module.css'
import { PaletteList } from './palette-list'
import { RequiredFiles } from './required-files'
import { useRuleSet } from './use-rule-set'
import { WordListFields } from './word-list-fields'

export function RuleSetPanel(props: CampaignSectionProps) {
  const { lists, refusals, save } = useRuleSet(props)
  return (
    <section className={layout.card} aria-label="Brand and legal rules">
      <h2>Brand and legal rules</h2>
      <PaletteList
        palette={lists.palette}
        refusal={refusals.palette}
        onSave={(palette) => save('palette', { palette })}
      />
      <RequiredFiles
        ids={lists.requiredAssetIds}
        projectId={props.projectId}
        refusal={refusals.requiredAssetIds}
        onSave={(requiredAssetIds) => save('requiredAssetIds', { requiredAssetIds })}
      />
      <WordListFields
        languages={props.data.campaign.languages}
        lists={lists}
        refusals={refusals}
        onSave={save}
      />
    </section>
  )
}
