// The brief form (spec/screens-campaign.md, "The brief form"; FR-020 to FR-026, FR-034): the
// campaign fields, the subject rows, sizes, languages, rules, the problems, and "Create
// campaign" / "Cancel". It is not an HTML form, so Enter in a field sends nothing. While
// creating, the fieldset disables every control in it. The problems sit in one box with the
// buttons, so an empty problems region leaves no gap above them.
import { useEffect, useId, useRef, useState } from 'react'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { primaryLanguageFor } from '@/shared/brief/languages'
import {
  planFromForm,
  splitLanguages,
  type BriefFormValues,
  type CampaignPlan,
} from '@/renderer/screens/project-home/brief-form-model'
import { RuleFields } from '@/renderer/screens/project-home/rule-fields'
import { SizeFields } from '@/renderer/screens/project-home/size-fields'
import { SubjectRows } from '@/renderer/screens/project-home/subject-rows'
import { PlacePhotoField } from '@/renderer/screens/project-home/subject-photos'
import { CampaignFields, type CampaignText } from './campaign-fields'
import { LanguageField } from './language-field'
import { useProjectImages } from './use-project-images'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brief-form.module.css'

export type BriefFormProps = {
  projectId: string
  initial: BriefFormValues
  subjects: SubjectRow[]
  // The project's campaigns, for "Copy the rules from another campaign" (S2-14).
  campaigns: CampaignSummary[]
  creating: boolean
  // May give a change for the form, applied once it resolves (SP-4: rows after a refused step).
  onCreate: (
    plan: Extract<CampaignPlan, { ok: true }>,
  ) => Promise<((v: BriefFormValues) => BriefFormValues) | void>
  onCancel: () => void
  // Told the values after every change (SP-4: brief-load removes added photos on Cancel).
  onValues?: (values: BriefFormValues) => void
}

export function BriefForm(props: BriefFormProps) {
  const [values, setValues] = useState(props.initial)
  const firstField = useRef<HTMLInputElement>(null)
  const ids = useId()
  const held = props.subjects.map((s) => s.id)
  const { images, refusal } = useProjectImages(props.projectId)
  const plan = planFromForm(props.projectId, values, held, images, refusal !== null)
  // The photos the form opened with: only a loaded brief's import puts any there (A-125).
  const [briefPhotoCount] = useState(() =>
    props.initial.subjects.reduce((sum, s) => sum + s.photos.length, 0),
  )

  useEffect(() => firstField.current?.focus(), [])
  const { onValues } = props
  useEffect(() => {
    onValues?.(values)
  }, [onValues, values])

  const setText = (key: CampaignText, text: string) => setValues((v) => ({ ...v, [key]: text }))
  function fillLanguages() {
    const language = primaryLanguageFor(values.region)
    if (values.languages.trim() === '' && language !== null)
      setValues((v) => ({ ...v, languages: language }))
  }

  const copyLanguages = Object.keys(values.copy ?? {})
  return (
    <section className={styles.form} aria-labelledby={`${ids}-title`}>
      <h3 id={`${ids}-title`}>Brief</h3>
      <fieldset className={styles.body} disabled={props.creating}>
        <CampaignFields
          values={values}
          firstField={firstField}
          onChange={setText}
          onRegionLeave={fillLanguages}
        />
        {refusal !== null && <p role="alert">{refusal}</p>}
        {briefPhotoCount > 0 && (
          <p className={styles.copy}>
            This brief added {briefPhotoCount} photo(s) from its folder. Check them before you
            create the campaign.
          </p>
        )}
        <SubjectRows
          projectId={props.projectId}
          subjects={values.subjects}
          held={props.subjects}
          images={images}
          onChange={(subjects) => setValues((v) => ({ ...v, subjects }))}
          onUpdate={(change) => setValues((v) => ({ ...v, subjects: change(v.subjects) }))}
        />
        <PlacePhotoField
          checked={values.placeSubjectPhoto}
          onChange={(placeSubjectPhoto) => setValues((v) => ({ ...v, placeSubjectPhoto }))}
        />
        <SizeFields
          sizes={values.sizes}
          onChange={(sizes) => setValues((v) => ({ ...v, sizes }))}
        />
        <LanguageField
          value={values.languages}
          onChange={(languages) => setValues((v) => ({ ...v, languages }))}
        />
        <RuleFields
          rules={values.rules}
          languages={splitLanguages(values.languages)}
          campaigns={props.campaigns}
          onChange={(rules) => setValues((v) => ({ ...v, rules }))}
        />
        {copyLanguages.length > 0 && (
          <p className={styles.copy}>Copy given for: {copyLanguages.join(', ')}</p>
        )}
        <div className={styles.end}>
          <div aria-live="polite">
            {!plan.ok && (
              <div className={styles.problems}>
                <h4 id={`${ids}-problems`}>Before the campaign can be made</h4>
                <ul aria-labelledby={`${ids}-problems`}>
                  {plan.problems.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {props.creating && <p className={layout.muted}>Creating the campaign…</p>}
          <div className={layout.row}>
            <button
              type="button"
              className={layout.primary}
              disabled={!plan.ok}
              onClick={() => {
                if (!plan.ok) return
                void Promise.resolve(props.onCreate(plan)).then((change) => {
                  if (change) setValues(change)
                })
              }}
            >
              Create campaign
            </button>
            <button type="button" onClick={props.onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </fieldset>
    </section>
  )
}
