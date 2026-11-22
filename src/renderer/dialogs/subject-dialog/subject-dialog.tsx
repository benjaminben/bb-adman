// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject dialog"). New: a
// name, a description and picked photos; nothing is sent before "Create subject", which sends
// subject.create, then asset.import with the photos and the attach step. Edit: the name and the
// description; "Save" sends only what changed. Each opening starts from the subject's values,
// and the picked paths go when the dialog closes. DLG-3b: the `form` kind; the problems and a
// refusal are one DialogAlert at the top of the body; the result line uses a real plural.
import { useId, useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { importPhotos, pickPhotos } from '@/renderer/screens/assets/subject-card/use-add-photos'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { plural } from '@/renderer/ui/plural'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { PickedPhotos } from './picked-photos'
import { newSubjectId, subjectProblems, type SubjectProblem } from './subject-plan'
import styles from './subject-dialog.module.css'

export type SubjectDialogProps = {
  projectId: string
  open: boolean
  subjects: SubjectRow[]
  subject?: SubjectRow
  onClose: () => void
}

type Form = {
  name: string
  description: string
  paths: string[]
  problems: SubjectProblem[]
  refusal: string | null
  busy: boolean
  result: string[] | null
}

const start = (subject?: SubjectRow): Form => ({
  name: subject?.name ?? '',
  description: subject?.description ?? '',
  paths: [],
  problems: [],
  refusal: null,
  busy: false,
  result: null,
})

export function SubjectDialog(props: SubjectDialogProps) {
  const { projectId, subject } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const [form, setForm] = useState<Form>(() => start(subject))
  const [shownOpen, setShownOpen] = useState(props.open)
  const nameRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const nameId = useId()
  const descriptionId = useId()
  if (props.open !== shownOpen) {
    setShownOpen(props.open)
    setForm(start(subject))
  }
  const change = (part: Partial<Form>) => setForm((f) => ({ ...f, ...part }))
  // A field the user changes clears the lines of the last try.
  const edit = (part: (f: Form) => Partial<Form>) =>
    setForm((f) => ({ ...f, ...part(f), problems: [], refusal: null }))

  function problemsFound(): boolean {
    const problems = subjectProblems({ name: form.name, photos: subject ? null : form.paths })
    change({ problems, refusal: null })
    if (problems[0]?.field === 'name') nameRef.current?.focus()
    if (problems[0]?.field === 'photos') addRef.current?.focus()
    return problems.length > 0
  }

  async function addPhotos() {
    const picked = await pickPhotos(api)
    if (picked.length > 0) edit((f) => ({ paths: [...f.paths, ...picked] }))
  }

  async function create() {
    if (problemsFound()) return
    const name = form.name.trim()
    const id = newSubjectId(name, props.subjects)
    change({ busy: true })
    const made = await command('subject.create', {
      projectId,
      id,
      name,
      description: form.description,
    })
    if (!made.ok) return change({ busy: false, refusal: made.error.message })
    const paths = form.paths
    const to = { projectId, paths, subjectId: id, subjects: props.subjects }
    const added = await importPhotos(api, command, to)
    const result = added.ok
      ? [`${name} was made with ${plural(added.count, 'photo')}.`, ...added.notes]
      : [`${name} was made, but its photos could not be added: ${added.message}`]
    change({ busy: false, paths: [], result })
  }

  async function save(edited: SubjectRow) {
    if (problemsFound()) return
    const name = form.name.trim()
    const changed = {
      ...(name !== edited.name && { name }),
      ...(form.description !== edited.description && { description: form.description }),
    }
    if (Object.keys(changed).length === 0) return props.onClose()
    change({ busy: true })
    const saved = await command('subject.update', { projectId, subjectId: edited.id, ...changed })
    if (!saved.ok) return change({ busy: false, refusal: saved.error.message })
    props.onClose()
  }

  const busy = form.busy
  const alerts = [...form.problems.map((p) => p.message), ...(form.refusal ? [form.refusal] : [])]
  const footer =
    form.result !== null ? (
      <button key="done" type="button" className={layout.primary} autoFocus onClick={props.onClose}>
        Done
      </button>
    ) : (
      <>
        <button type="button" disabled={busy} onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={layout.primary}
          disabled={busy}
          onClick={() => void (subject ? save(subject) : create())}
        >
          {subject ? 'Save' : 'Create subject'}
        </button>
      </>
    )

  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title={subject ? `Edit ${subject.name}` : 'New subject'}
      kind="form"
      closable={!busy}
      footer={footer}
    >
      {form.result !== null ? (
        <div role="status" className={styles.result}>
          {form.result.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : (
        <div className={styles.form}>
          {alerts.length > 0 && (
            <DialogAlert tone="danger">
              {alerts.map((line, i) => (
                <span key={i} className={styles.alertLine}>
                  {line}
                </span>
              ))}
            </DialogAlert>
          )}
          <div className={layout.field}>
            <label htmlFor={nameId}>Name</label>
            <input
              ref={nameRef}
              id={nameId}
              value={form.name}
              disabled={busy}
              aria-required="true"
              aria-invalid={form.problems.some((p) => p.field === 'name')}
              onChange={(e) => edit(() => ({ name: e.target.value }))}
            />
          </div>
          <div className={layout.field}>
            <label htmlFor={descriptionId}>Description (optional)</label>
            <textarea
              id={descriptionId}
              rows={3}
              value={form.description}
              disabled={busy}
              onChange={(e) => edit(() => ({ description: e.target.value }))}
            />
          </div>
          {!subject && (
            <PickedPhotos
              paths={form.paths}
              disabled={busy}
              ref={addRef}
              onAdd={() => void addPhotos()}
              onRemove={(index) => edit((f) => ({ paths: f.paths.filter((_, i) => i !== index) }))}
            />
          )}
          {busy && (
            <p role="status" className={styles.busy}>
              <BusySpinner />
              Making the subject…
            </p>
          )}
        </div>
      )}
    </DialogFrame>
  )
}
