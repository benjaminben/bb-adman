// "Words" of the Rules section: with two or more campaign languages, a Segmented of the
// languages picks which pair shows; then "Required" and "Prohibited" side by side, one entry
// per line, each keeping its name "Required words ({language})". A list saves on leaving its
// field when its entries changed; blank lines and the space around an entry are dropped. A
// refusal shows under the field that sent it.
import { useState } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import type { RuleSetValues } from '@/shared/schemas/commands/campaign'
import { Refusal, RuleGroup } from './rule-group'
import type { Refusals, SaveList } from './use-rule-set'
import styles from './rule-set-panel.module.css'

type Kind = 'requiredWords' | 'prohibitedWords'

const KINDS: [Kind, string, string][] = [
  ['requiredWords', 'Required', 'Required words'],
  ['prohibitedWords', 'Prohibited', 'Prohibited words'],
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
  const { languages } = props
  const [chosen, setChosen] = useState(0)
  const i = chosen < languages.length ? chosen : 0
  const tag = languages[i]
  if (tag === undefined) return null

  function leave(kind: Kind, text: string) {
    if (tag === undefined) return
    const entries = entriesOf(text)
    const before = entriesOf((props.lists[kind][tag] ?? []).join('\n'))
    if (entries.join('\n') === before.join('\n')) return
    props.onSave(wordKey(kind, tag), { [kind]: { ...props.lists[kind], [tag]: entries } })
  }

  return (
    <RuleGroup title="Words">
      {languages.length > 1 && (
        <div role="group" aria-label="Word list language" className={layout.seg}>
          {languages.map((t, n) => (
            <button
              key={`${n}-${t}`}
              type="button"
              aria-pressed={n === i}
              onClick={() => setChosen(n)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className={styles.language}>
        {KINDS.map(([kind, label, name]) => {
          const text = (props.lists[kind][tag] ?? []).join('\n')
          return (
            <div key={kind} className={styles.field}>
              <label className={styles.field}>
                {label}
                <textarea
                  key={`${tag}/${text}`}
                  rows={3}
                  aria-label={`${name} (${tag})`}
                  placeholder="One per line"
                  defaultValue={text}
                  onBlur={(e) => leave(kind, e.currentTarget.value)}
                />
              </label>
              <Refusal message={props.refusals[wordKey(kind, tag)]} />
            </div>
          )
        })}
      </div>
    </RuleGroup>
  )
}
