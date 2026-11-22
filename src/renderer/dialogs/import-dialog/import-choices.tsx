// The import dialog's choices: the library, the copy box and the subject
// (spec/screens-campaign.md, "The import dialog"). R2C-7: the subject list ends with
// "New subject…", which shows the field "Subject name" (focused). DLG-3b: the library is a
// Segmented "Assets" | "References" (radios keeping their old names), each with its long words
// in an InfoTip; the subject select shows "Subject" and keeps the name "Attach to a subject".
import { useId } from 'react'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './import-dialog.module.css'

export type Library = 'asset' | 'reference'
export type Choices = { library: Library; copy: boolean; subjectId: string; subjectName: string }

// The select's value for "New subject…": never a subject ID (SPEC 3.2 IDs have no colon).
export const NEW_SUBJECT = ':new'

export const START_CHOICES: Choices = {
  library: 'asset',
  copy: false,
  subjectId: '',
  subjectName: '',
}

type LibraryChoice = { value: Library; words: string; label: string; tip: string }

const LIBRARIES: LibraryChoice[] = [
  {
    value: 'asset',
    words: 'Assets',
    label: 'Asset library (can go on a post)',
    tip: 'Files that can go on a post.',
  },
  {
    value: 'reference',
    words: 'References',
    label: 'Reference library (only to guide AI pictures)',
    tip: 'Only to guide AI pictures. They never go on a post.',
  },
]

export type ImportChoicesProps = {
  choices: Choices
  subjects: SubjectRow[]
  disabled: boolean
  problem: boolean
  onChange: (next: Choices) => void
}

export function ImportChoices(props: ImportChoicesProps) {
  const id = useId()
  const { choices, disabled, onChange } = props
  return (
    <>
      <fieldset className={styles.library} disabled={disabled}>
        <legend className={styles.hidden}>Put them in</legend>
        <span className={styles.seg}>
          {LIBRARIES.map((library) => (
            <span key={library.value} className={styles.segment}>
              <input
                type="radio"
                id={`${id}-${library.value}`}
                name={`${id}-library`}
                value={library.value}
                aria-label={library.label}
                checked={choices.library === library.value}
                onChange={() => onChange({ ...choices, library: library.value })}
              />
              <label htmlFor={`${id}-${library.value}`}>{library.words}</label>
            </span>
          ))}
        </span>
        {LIBRARIES.map((library) => (
          <InfoTip key={library.value} about={library.words}>
            {library.tip}
          </InfoTip>
        ))}
      </fieldset>
      <div className={styles.group}>
        <label className={styles.choice}>
          <input
            type="checkbox"
            checked={choices.copy}
            disabled={disabled}
            aria-describedby={`${id}-copy-hint`}
            onChange={(e) => onChange({ ...choices, copy: e.target.checked })}
          />
          Copy into the project&apos;s assets folder
        </label>
        <p id={`${id}-copy-hint`} className={styles.hint}>
          Not ticked: the files stay where they are, and the project links to them.
        </p>
      </div>
      <div className={`${layout.field} ${styles.field}`}>
        <label htmlFor={`${id}-subject`}>Subject</label>
        <select
          id={`${id}-subject`}
          aria-label="Attach to a subject"
          value={choices.subjectId}
          disabled={disabled}
          onChange={(e) => onChange({ ...choices, subjectId: e.target.value })}
        >
          <option value="">No subject</option>
          {props.subjects.map((s) => (
            <option key={s.id} value={s.id}>{`${s.name} (${s.id})`}</option>
          ))}
          <option value={NEW_SUBJECT}>New subject…</option>
        </select>
      </div>
      {choices.subjectId === NEW_SUBJECT && (
        <div className={`${layout.field} ${styles.field}`}>
          <label htmlFor={`${id}-subject-name`}>Subject name</label>
          <input
            id={`${id}-subject-name`}
            type="text"
            autoFocus
            value={choices.subjectName}
            disabled={disabled}
            aria-invalid={props.problem}
            onChange={(e) => onChange({ ...choices, subjectName: e.target.value })}
          />
        </div>
      )}
    </>
  )
}
