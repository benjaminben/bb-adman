// The word lists of the brief form's rules: for each language in the list, "Required words
// ({language})" and "Prohibited words ({language})", one word or phrase per line. A plain list
// the brief gave with no language (kept under "") shows under the main language.
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
import styles from './rule-fields.module.css'

type Rules = BriefFormValues['rules']
type Kind = 'requiredWords' | 'prohibitedWords'

const KINDS: [Kind, string][] = [
  ['requiredWords', 'Required words'],
  ['prohibitedWords', 'Prohibited words'],
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
  const { rules } = props
  return (
    <div className={styles.lists}>
      {props.languages.map((tag, i) => (
        <div key={`${i}-${tag}`} className={styles.language}>
          {KINDS.map(([kind, label]) => (
            <label key={kind} className={styles.field}>
              {label} ({tag})
              <textarea
                rows={3}
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
      ))}
    </div>
  )
}
