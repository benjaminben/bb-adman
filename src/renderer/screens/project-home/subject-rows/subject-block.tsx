// One subject of the brief form (HOME-3b): a block with no box or legend, named "Subject {n}"
// for a screen reader. Its header holds Name, Description, a Segmented "New" | "From project"
// (radios keeping the names "New subject" and "Use a subject this project has"), then the "ID"
// field or the "Project subject" select, and a ✕ "Remove subject {n}". Under it, the photos.
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { ProjectImages } from '@/renderer/screens/project-home/brief-form-photos'
import type { SubjectChoice } from '@/renderer/screens/project-home/brief-form-model'
import { SubjectPhotos, type RowUpdate } from '@/renderer/screens/project-home/subject-photos'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './subject-rows.module.css'

type Props = {
  projectId: string
  n: number
  // Unique per block: the radios' group name and the field ids.
  uid: string
  row: SubjectChoice
  held: SubjectRow[]
  images: ProjectImages
  // The ID that is sent when the field is blank.
  sentId: string
  only: boolean
  bindName: (el: HTMLInputElement | null) => void
  change: (patch: Partial<SubjectChoice>) => void
  chooseExisting: () => void
  update: RowUpdate
  onRemove: () => void
}

export function SubjectBlock(props: Props) {
  const { row: s, n, uid, bindName } = props
  const none = props.held.length === 0
  const mode = (value: 'new' | 'existing', words: string, name: string) => (
    <span className={styles.choice} title={value === 'existing' && none ? NONE : undefined}>
      <input
        type="radio"
        id={`${uid}-${value}`}
        name={`${uid}-mode`}
        aria-label={name}
        checked={s.mode === value}
        disabled={value === 'existing' && none}
        onChange={() => (value === 'new' ? props.change({ mode: 'new' }) : props.chooseExisting())}
      />
      <label htmlFor={`${uid}-${value}`}>{words}</label>
    </span>
  )
  return (
    <div role="group" aria-label={`Subject ${n}`} className={styles.block}>
      <div className={styles.head}>
        <input
          ref={bindName}
          className={styles.name}
          aria-label="Name"
          placeholder="Name"
          value={s.name}
          onChange={(e) => props.change({ name: e.target.value })}
        />
        <input
          className={styles.description}
          aria-label="Description (optional)"
          placeholder="Description"
          value={s.description}
          onChange={(e) => props.change({ description: e.target.value })}
        />
        <button
          type="button"
          className={`${layout.iconButton} ${styles.remove}`}
          aria-label={`Remove subject ${n}`}
          title={props.only ? 'A campaign needs one subject' : `Remove subject ${n}`}
          disabled={props.only}
          onClick={props.onRemove}
        >
          <Icon name="x" />
        </button>
      </div>
      <div className={styles.which}>
        <div role="radiogroup" aria-label={`Subject ${n} is`} className={styles.seg}>
          {mode('new', 'New', 'New subject')}
          {mode('existing', 'From project', 'Use a subject this project has')}
        </div>
        {s.mode === 'new' ? (
          <span className={styles.field}>
            <label htmlFor={`${uid}-id`}>ID</label>
            <input
              id={`${uid}-id`}
              aria-label="Subject ID"
              value={s.newId}
              placeholder={s.newId === '' ? props.sentId || undefined : undefined}
              onChange={(e) => props.change({ newId: e.target.value })}
            />
          </span>
        ) : (
          <span className={styles.field}>
            <label htmlFor={`${uid}-held`}>Project subject</label>
            <select
              id={`${uid}-held`}
              value={s.existingId ?? ''}
              onChange={(e) => props.change({ existingId: e.target.value || null })}
            >
              <option value="">Choose a subject</option>
              {props.held.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.id})
                </option>
              ))}
            </select>
          </span>
        )}
      </div>
      <SubjectPhotos
        projectId={props.projectId}
        n={n}
        row={s}
        images={props.images}
        update={props.update}
      />
    </div>
  )
}

const NONE = 'This project has no subjects yet'
