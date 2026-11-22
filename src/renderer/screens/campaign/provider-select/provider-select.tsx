// The panels' provider choice (spec/screens-campaign.md, "The trial mark in the panels"): one
// owner for the trial mark. With `trial` true, "(trial)" follows the chosen name, so the panel
// reads "ComfyUI (trial)", and it is the select's description for a screen reader. R3-2: an
// option names its provider and model, "Google Gemini · Nano Banana 2.1"; the field's label is the caller's ("Provider").
import { useId } from 'react'
import { providerModelWords } from '@/shared/providers/model-words'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import layout from '@/renderer/ui/layout.module.css'
import styles from './provider-select.module.css'

export function ProviderSelect(props: {
  label: string
  providers: ProviderInfo[]
  // R3-2: each provider's model for the job, named after it in its option.
  models?: Record<string, string | null>
  value: string | undefined
  onChange: (id: string) => void
  trial: boolean
}) {
  const selectId = useId()
  const markId = useId()
  return (
    <div className={layout.field}>
      <label htmlFor={selectId}>{props.label}</label>
      <div className={layout.row}>
        <select
          id={selectId}
          className={styles.select}
          value={props.value}
          aria-describedby={props.trial ? markId : undefined}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {props.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {providerModelWords(p.label, props.models?.[p.id])}
            </option>
          ))}
        </select>
        {props.trial && (
          <span id={markId} className={layout.muted}>
            (trial)
          </span>
        )}
      </div>
    </div>
  )
}
