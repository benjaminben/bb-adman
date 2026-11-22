// The brief form's subjects (spec/screens-campaign.md, "The brief form", Subjects; HOME-3b): a
// Section "Subjects" whose header holds the count, the photos hint in an InfoTip and "Add"
// (named "Add subject"); then a list "Subjects" of blocks "Subject {i}" (subject-block.tsx).
// "Add subject" puts focus on the new block's Name; removing a subject puts it on "Add subject".
// Removing a subject also removes the photos the form added to it, and only those. Blocks keep
// their React key when another goes, so a running "Add photos" stays with its block.
import { useEffect, useId, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { ProjectImages } from '@/renderer/screens/project-home/brief-form-photos'
import { removeAddedPhotos } from '@/renderer/screens/project-home/subject-photos'
import { emptySubject, type SubjectChoice } from '@/renderer/screens/project-home/brief-form-model'
import { subjectIds } from '@/renderer/screens/project-home/brief-form-problems'
import { Icon } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { SubjectBlock } from './subject-block'
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
  function remove(s: SubjectChoice, i: number) {
    removeAddedPhotos(api, props.projectId, s.photos)
    keys.drop(i)
    props.onChange(subjects.filter((_, k) => k !== i))
    focusNext.current = 'add'
  }

  const header = (
    <span className={styles.headEnd}>
      {subjects.length}
      <button
        ref={add}
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        aria-label="Add subject"
        onClick={() => {
          props.onChange([...subjects, emptySubject()])
          focusNext.current = subjects.length
        }}
      >
        <Icon name="plus" />
        Add
      </button>
    </span>
  )
  return (
    <Section
      id="brief.subjects"
      title="Subjects"
      fold="none"
      summary={header}
      info={
        <InfoTip about="Photos">
          Photos of the product, service or person. PNG, JPEG or WebP. At least one is needed. AI
          pictures are drawn from them.
        </InfoTip>
      }
    >
      <ul aria-label="Subjects" className={styles.list}>
        {subjects.map((s, i) => (
          <li key={keys.keys[i]}>
            <SubjectBlock
              projectId={props.projectId}
              n={i + 1}
              uid={`${ids}-${keys.keys[i]}`}
              row={s}
              held={props.held}
              images={props.images}
              sentId={sentIds[i] ?? ''}
              only={subjects.length === 1}
              bindName={(el) => {
                names.current[i] = el
              }}
              change={(patch) => change(i, patch)}
              chooseExisting={() => chooseExisting(s, i)}
              update={update(i)}
              onRemove={() => remove(s, i)}
            />
          </li>
        ))}
      </ul>
    </Section>
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
