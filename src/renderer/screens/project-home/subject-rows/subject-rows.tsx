// The brief form's subject rows (spec/screens-campaign.md, "The brief form", Subjects): a list
// "Subjects" of groups "Subject {i}", each with a name, a description, and either a new
// subject's ID or one of the project's subjects. "Add subject" puts focus on the new row's
// Name; "Remove" puts it on "Add subject". Each row holds its "Photos" part
// (spec/subject-photos.md); "Remove" also removes the photos the form added to that row. Rows
// keep their React key when another row goes, so a running "Add photos" stays with its row.
import { useEffect, useId, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { ProjectImages } from '@/renderer/screens/project-home/brief-form-photos'
import { removeAddedPhotos, SubjectPhotos } from '@/renderer/screens/project-home/subject-photos'
import { emptySubject, type SubjectChoice } from '@/renderer/screens/project-home/brief-form-model'
import { subjectIds } from '@/renderer/screens/project-home/brief-form-problems'
import { Icon } from '@/renderer/ui/icon'
import styles from './subject-rows.module.css'

type Props = {
  projectId: string
  subjects: SubjectChoice[]
  held: SubjectRow[]
  images: ProjectImages
  onChange: (subjects: SubjectChoice[]) => void
  // A change made from the newest rows, for a reply that comes after other edits.
  onUpdate: (change: (subjects: SubjectChoice[]) => SubjectChoice[]) => void
}

export function SubjectRows(props: Props) {
  const { subjects } = props
  const api = useApi()
  const ids = useId()
  const keys = useRowKeys(subjects.length)
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

  const update = (i: number) => (fn: (row: SubjectChoice) => SubjectChoice) =>
    props.onUpdate((list) => list.map((s, n) => (n === i ? fn(s) : s)))
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
            <li key={keys.keys[i]}>
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
                    className={styles.reading}
                    value={s.description}
                    onChange={(e) => change(i, { description: e.target.value })}
                  />
                </label>
                <SubjectPhotos
                  projectId={props.projectId}
                  n={n}
                  row={s}
                  images={props.images}
                  update={update(i)}
                />
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
                    removeAddedPhotos(api, props.projectId, s.photos)
                    keys.drop(i)
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
        <Icon name="plus" />
        Add subject
      </button>
    </div>
  )
}

// One stable key per row: a new row gets a new number, a removed row's number goes with it.
function useRowKeys(count: number) {
  const [state, setState] = useState(() => ({ keys: [...Array(count).keys()], next: count }))
  let { keys } = state
  if (keys.length !== count) {
    let { next } = state
    keys = keys.slice(0, count)
    while (keys.length < count) keys.push(next++)
    setState({ keys, next })
  }
  const drop = (i: number) => setState((s) => ({ ...s, keys: s.keys.filter((_, k) => k !== i) }))
  return { keys, drop }
}
