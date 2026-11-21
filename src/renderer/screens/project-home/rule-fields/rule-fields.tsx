// The brief form's rules (spec/screens-campaign.md, "The brief form", Rules; FR-034, A-44): a
// fieldset "Rules" with "Use these word lists" (two word lists per language) or "Copy the
// rules from another campaign" (a select of the project's campaigns, sent as
// copyRuleSetFrom). With no campaign the copy choice is disabled and a line says why.
import { useId } from 'react'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
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
  const name = useId()
  const none = campaigns.length === 0
  const set = (patch: Partial<Rules>) => props.onChange({ ...rules, ...patch })

  return (
    <div className={styles.rules}>
      <fieldset className={styles.box}>
        <legend>Rules</legend>
        <div className={styles.modes}>
          <label>
            <input
              type="radio"
              name={name}
              checked={rules.mode === 'words'}
              onChange={() => set({ mode: 'words' })}
            />
            Use these word lists
          </label>
          <label>
            <input
              type="radio"
              name={name}
              checked={rules.mode === 'copy'}
              disabled={none}
              onChange={() => set({ mode: 'copy' })}
            />
            Copy the rules from another campaign
          </label>
        </div>
        {none && <p className={styles.muted}>This project has no other campaign.</p>}
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
      </fieldset>
      <p className={styles.muted}>Colours and required files are set after the campaign is made.</p>
    </div>
  )
}
