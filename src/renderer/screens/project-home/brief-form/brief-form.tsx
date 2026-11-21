// The brief form (spec/screens-campaign.md, "The brief form"; FR-020 to FR-026, FR-034): the
// campaign fields, the subject rows, read-only lines for sizes, languages and rules, the
// problems, and "Create campaign" / "Cancel". It is not an HTML form, so Enter in a field
// sends nothing. While creating, the fieldset disables every control in it.
import { useEffect, useId, useRef, useState } from 'react'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { primaryLanguageFor } from '@/shared/brief/languages'
import {
  planFromForm,
  type BriefFormValues,
  type CampaignPlan,
} from '@/renderer/screens/project-home/brief-form-model'
import { chosenSizes } from '@/renderer/screens/project-home/brief-form-sizes'
import { SubjectRows } from '@/renderer/screens/project-home/subject-rows'
import { CampaignFields, type CampaignText } from './campaign-fields'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brief-form.module.css'

export type BriefFormProps = {
  projectId: string
  initial: BriefFormValues
  subjects: SubjectRow[]
  // The project's campaigns, for "Copy the rules from another campaign" (S2-14).
  campaigns: CampaignSummary[]
  creating: boolean
  onCreate: (plan: Extract<CampaignPlan, { ok: true }>) => void
  onCancel: () => void
}

export function BriefForm(props: BriefFormProps) {
  const [values, setValues] = useState(props.initial)
  const firstField = useRef<HTMLInputElement>(null)
  const ids = useId()
  const held = props.subjects.map((s) => s.id)
  const plan = planFromForm(props.projectId, values, held)

  useEffect(() => firstField.current?.focus(), [])

  const setText = (key: CampaignText, text: string) => setValues((v) => ({ ...v, [key]: text }))
  function fillLanguages() {
    const language = primaryLanguageFor(values.region)
    if (values.languages.trim() === '' && language !== null)
      setValues((v) => ({ ...v, languages: language }))
  }

  const sizeLabels = chosenSizes(values.sizes).sizes.map((s) => s.label)
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
        <SubjectRows
          subjects={values.subjects}
          held={props.subjects}
          onChange={(subjects) => setValues((v) => ({ ...v, subjects }))}
        />
        <div className={styles.lines}>
          <p>Sizes: {sizeLabels.join(', ')}</p>
          <p>Languages: {values.languages}</p>
          <p>Rules: the brief&apos;s word lists</p>
          {copyLanguages.length > 0 && <p>Copy given for: {copyLanguages.join(', ')}</p>}
        </div>
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
            onClick={() => plan.ok && props.onCreate(plan)}
          >
            Create campaign
          </button>
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </section>
  )
}
