// The word lists of the brief form's rules (HOME-3a): with two or more languages, a Segmented
// of the languages picks which pair shows; then "Required" and "Prohibited" side by side, one
// word or phrase per line. Each text area keeps its old name, "Required words ({language})". A
// plain list the brief gave with no language (kept under "") shows under the main language.
import { useState } from 'react'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
import layout from '@/renderer/ui/layout.module.css'
import styles from './rule-fields.module.css'

type Rules = BriefFormValues['rules']
type Kind = 'requiredWords' | 'prohibitedWords'

const KINDS: [Kind, string, string][] = [
  ['requiredWords', 'Required', 'Required words'],
  ['prohibitedWords', 'Prohibited', 'Prohibited words'],
]

const textFor = (texts: Record<string, string>, tag: string, main: boolean) =>
  texts[tag] ?? (main ? texts[''] : undefined) ?? ''

function written(texts: Record<string, string>, tag: string, main: boolean, text: string) {
  const next = { ...texts, [tag]: text }
  if (main) delete next['']
  return next
}

export function WordLists(props: {
  rules: Rules
  languages: string[]
  onChange: (rules: Rules) => void
}) {
  const { rules, languages } = props
  const [chosen, setChosen] = useState(0)
  const i = chosen < languages.length ? chosen : 0
  const tag = languages[i]
  if (tag === undefined) return null
  return (
    <div className={styles.lists}>
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
        {KINDS.map(([kind, label, name]) => (
          <label key={kind} className={styles.field}>
            {label}
            <textarea
              rows={3}
              aria-label={`${name} (${tag})`}
              placeholder="One per line"
              value={textFor(rules[kind], tag, i === 0)}
              onChange={(e) =>
                props.onChange({
                  ...rules,
                  [kind]: written(rules[kind], tag, i === 0, e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  )
}
