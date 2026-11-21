// "Words" of the rule set panel: per campaign language, the required and prohibited lists, one
// entry per line, saved on leaving the field when its entries changed. Blank lines and the
// space around an entry are dropped. A refusal shows under the field that sent it.
import type { RuleSetValues } from '@/shared/schemas/commands/campaign'
import { Refusal, RuleGroup } from './rule-group'
import type { Refusals, SaveList } from './use-rule-set'
import styles from './rule-set-panel.module.css'

type Kind = 'requiredWords' | 'prohibitedWords'

const KINDS: [Kind, string][] = [
  ['requiredWords', 'Required words'],
  ['prohibitedWords', 'Prohibited words'],
]

const entriesOf = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

export const wordKey = (kind: Kind, tag: string) => `${kind}/${tag}`

export function WordListFields(props: {
  languages: string[]
  lists: Pick<RuleSetValues, Kind>
  refusals: Refusals
  onSave: SaveList
}) {
  function leave(kind: Kind, tag: string, text: string) {
    const entries = entriesOf(text)
    const before = entriesOf((props.lists[kind][tag] ?? []).join('\n'))
    if (entries.join('\n') === before.join('\n')) return
    props.onSave(wordKey(kind, tag), { [kind]: { ...props.lists[kind], [tag]: entries } })
  }

  return (
    <RuleGroup title="Words">
      <div className={styles.languages}>
        {props.languages.map((tag, i) => (
          <div key={`${i}-${tag}`} className={styles.language}>
            {KINDS.map(([kind, label]) => {
              const text = (props.lists[kind][tag] ?? []).join('\n')
              return (
                <div key={kind} className={styles.field}>
                  <label className={styles.field}>
                    {label} ({tag})
                    <textarea
                      key={text}
                      rows={3}
                      defaultValue={text}
                      onBlur={(e) => leave(kind, tag, e.currentTarget.value)}
                    />
                  </label>
                  <Refusal message={props.refusals[wordKey(kind, tag)]} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </RuleGroup>
  )
}
