// The brief form's "Languages" field (spec/screens-campaign.md, "The brief form", Languages;
// FR-026; HOME-3a): tags typed as text, split on commas and spaces by the model. Under it the
// tags as chips in order: ★ on the first (the main language), a pencil on each language the
// brief gave copy for. The hint is in an InfoTip and is the field's description.
import { useId } from 'react'
import { splitLanguages } from '@/renderer/screens/project-home/brief-form-model'
import { Icon } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brief-form.module.css'

const HINT =
  "Language tags such as en or fr-CA, separated by commas. The first is the campaign's main language."

export function LanguageField(props: {
  value: string
  copyGiven: string[]
  onChange: (text: string) => void
}) {
  const id = useId()
  const tags = splitLanguages(props.value)
  return (
    <div className={styles.block}>
      <div className={`${layout.field} ${layout.inline}`}>
        <label htmlFor={`${id}-field`}>Languages</label>
        <span className={styles.withTip}>
          <input
            id={`${id}-field`}
            placeholder="en, fr-CA"
            value={props.value}
            aria-describedby={`${id}-hint`}
            onChange={(e) => props.onChange(e.target.value)}
          />
          <InfoTip about="Languages">{HINT}</InfoTip>
        </span>
      </div>
      <span id={`${id}-hint`} className={styles.hidden}>
        {HINT}
      </span>
      {tags.length > 0 && (
        <ul aria-label="Languages in order" className={styles.tags}>
          {tags.map((tag, i) => (
            <li key={`${i}-${tag}`} className={styles.tag}>
              {i === 0 && (
                <span
                  role="img"
                  aria-label="Main language"
                  title="Main language"
                  className={styles.tagMark}
                >
                  <Icon name="star" />
                </span>
              )}
              {tag}
              {props.copyGiven.includes(tag) && (
                <span
                  role="img"
                  aria-label="Copy given"
                  title="Copy given"
                  className={styles.tagMark}
                >
                  <Icon name="pencil" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
