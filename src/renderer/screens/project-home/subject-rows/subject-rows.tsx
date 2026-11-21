// The brief form's subject rows (spec/screens-campaign.md, "The brief form", Subjects): a list
// "Subjects" of groups "Subject {i}", each with a name, a description, and either a new
// subject's ID or one of the project's subjects. "Add subject" puts focus on the new row's
// Name; "Remove" puts it on "Add subject".
import { useEffect, useId, useRef } from 'react'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { emptySubject, type SubjectChoice } from '@/renderer/screens/project-home/brief-form-model'
import { subjectIds } from '@/renderer/screens/project-home/brief-form-problems'
import styles from './subject-rows.module.css'

type Props = {
  subjects: SubjectChoice[]
  held: SubjectRow[]
  onChange: (subjects: SubjectChoice[]) => void
}

export function SubjectRows(props: Props) {
  const { subjects } = props
  const ids = useId()
  // A blank "Subject ID" shows the ID made from the name, the one that is sent.
  const sentIds = subjectIds(subjects)
  const names = useRef<(HTMLInputElement | null)[]>([])
  const add = useRef<HTMLButtonElement>(null)
  // Where focus goes once the changed rows are drawn.
  const focusNext = useRef<number | 'add' | null>(null)

  useEffect(() => {
    const target = focusNext.current
    focusNext.current = null
    if (target === 'add') add.current?.focus()
    else if (target !== null) names.current[target]?.focus()
  })

  const change = (i: number, patch: Partial<SubjectChoice>) =>
    props.onChange(subjects.map((s, n) => (n === i ? { ...s, ...patch } : s)))
  // Choosing "Use a subject this project has" picks the subject whose ID the row already names.
  const chooseExisting = (s: SubjectChoice, i: number) =>
    change(i, {
      mode: 'existing',
      existingId: s.existingId ?? (props.held.some((h) => h.id === s.newId) ? s.newId : null),
    })

  return (
    <div className={styles.subjects}>
      <ul aria-label="Subjects" className={styles.list}>
        {subjects.map((s, i) => {
          const n = i + 1
          const key = `${ids}-${n}`
          return (
            <li key={i}>
              <fieldset className={styles.row}>
                <legend>Subject {n}</legend>
                <label className={styles.field}>
                  Name
                  <input
                    ref={(el) => {
                      names.current[i] = el
                    }}
                    value={s.name}
                    onChange={(e) => change(i, { name: e.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  Description (optional)
                  <input
                    value={s.description}
                    onChange={(e) => change(i, { description: e.target.value })}
                  />
                </label>
                <div className={styles.modes}>
                  <label>
                    <input
                      type="radio"
                      name={`${key}-mode`}
                      checked={s.mode === 'new'}
                      onChange={() => change(i, { mode: 'new' })}
                    />
                    New subject
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`${key}-mode`}
                      checked={s.mode === 'existing'}
                      disabled={props.held.length === 0}
                      onChange={() => chooseExisting(s, i)}
                    />
                    Use a subject this project has
                  </label>
                </div>
                {s.mode === 'new' ? (
                  <label className={styles.field}>
                    Subject ID
                    <input
                      value={s.newId}
                      placeholder={s.newId === '' ? sentIds[i] || undefined : undefined}
                      onChange={(e) => change(i, { newId: e.target.value })}
                    />
                  </label>
                ) : (
                  <label className={styles.field}>
                    Project subject
                    <select
                      value={s.existingId ?? ''}
                      onChange={(e) => change(i, { existingId: e.target.value || null })}
                    >
                      <option value="">Choose a subject</option>
                      {props.held.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.id})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove subject ${n}`}
                  disabled={subjects.length === 1}
                  onClick={() => {
                    props.onChange(subjects.filter((_, k) => k !== i))
                    focusNext.current = 'add'
                  }}
                >
                  Remove
                </button>
              </fieldset>
            </li>
          )
        })}
      </ul>
      <button
        ref={add}
        type="button"
        className={styles.add}
        onClick={() => {
          props.onChange([...subjects, emptySubject()])
          focusNext.current = subjects.length
        }}
      >
        Add subject
      </button>
    </div>
  )
}
