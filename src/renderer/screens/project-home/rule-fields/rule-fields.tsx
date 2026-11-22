// The brief form's rules (spec/screens-campaign.md, "The brief form", Rules; FR-034, A-44;
// HOME-3a): a Section "Rules", shut at first, whose summary always says that rules exist
// ("2 required · 1 prohibited" or "From Spring Launch"). Open: a Segmented "Word lists" |
// "Copy from" (a select of the project's campaigns, sent as copyRuleSetFrom). With no other
// campaign "Copy from" is disabled and its title says why.
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
import { InfoTip } from '@/renderer/ui/info-tip'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { ruleSummary } from './rule-summary'
import { WordLists } from './word-lists'
import styles from './rule-fields.module.css'

type Rules = BriefFormValues['rules']

export function RuleFields(props: {
  rules: Rules
  languages: string[]
  campaigns: CampaignSummary[]
  onChange: (rules: Rules) => void
}) {
  const { rules, campaigns } = props
  const none = campaigns.length === 0
  const set = (patch: Partial<Rules>) => props.onChange({ ...rules, ...patch })

  return (
    <Section
      id="brief.rules"
      title="Rules"
      fold="closed"
      summary={ruleSummary(rules, props.languages, campaigns)}
      info={
        <InfoTip about="Rules">
          Colours and required files are set after the campaign is made.
        </InfoTip>
      }
    >
      <div role="group" aria-label="Rules" className={styles.rules}>
        <div role="group" aria-label="Rules from" className={layout.seg}>
          <button
            type="button"
            aria-pressed={rules.mode === 'words'}
            onClick={() => set({ mode: 'words' })}
          >
            Word lists
          </button>
          <button
            type="button"
            aria-pressed={rules.mode === 'copy'}
            disabled={none}
            title={none ? 'No other campaign yet' : undefined}
            onClick={() => set({ mode: 'copy' })}
          >
            Copy from
          </button>
        </div>
        {rules.mode === 'words' ? (
          <WordLists rules={rules} languages={props.languages} onChange={props.onChange} />
        ) : (
          <label className={`${styles.field} ${styles.copy}`}>
            Campaign to copy from
            <select
              value={rules.copyFrom ?? ''}
              onChange={(e) => set({ copyFrom: e.target.value || null })}
            >
              <option value="">Choose a campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </Section>
  )
}
