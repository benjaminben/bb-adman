// The "Rules" Section of the Checks tab (CAMP-4; spec/phases/phase-06.md, design addition 8;
// P6-10): "Palette", "Required files" and "Words". It starts closed when any rule is set and
// open when none; its summary "{n} colours · {m} files · {k} words" always shows. Every change
// sends ruleSet.update with the one list changed; a refusal's own message shows under that list.
import type { CampaignTabProps as CampaignSectionProps } from '@/renderer/screens/campaign/campaign-overview'
import { InfoTip } from '@/renderer/ui/info-tip'
import { plural } from '@/renderer/ui/plural'
import { Section } from '@/renderer/ui/section'
import type { RuleSetValues } from '@/shared/schemas/commands/campaign'
import { PaletteList } from './palette-list'
import { RequiredFiles } from './required-files'
import { useRuleSet } from './use-rule-set'
import { WordListFields } from './word-list-fields'
import styles from './rule-set-panel.module.css'

const wordCount = (lists: Record<string, string[]>) =>
  Object.values(lists).reduce((n, words) => n + words.length, 0)

function counts(lists: RuleSetValues) {
  const words = wordCount(lists.requiredWords) + wordCount(lists.prohibitedWords)
  return { colours: lists.palette.length, files: lists.requiredAssetIds.length, words }
}

export function RuleSetPanel(props: CampaignSectionProps) {
  const { lists, refusals, save } = useRuleSet(props)
  const n = counts(lists)
  const any = n.colours + n.files + n.words > 0
  const summary = [
    plural(n.colours, 'colour'),
    plural(n.files, 'file'),
    plural(n.words, 'word'),
  ].join(' · ')
  return (
    <Section
      id="checks.rules"
      title="Rules"
      fold={any ? 'closed' : 'open'}
      summary={summary}
      info={<InfoTip about="Rules">Checks run against these rules.</InfoTip>}
    >
      <div className={styles.rules}>
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
      </div>
    </Section>
  )
}
