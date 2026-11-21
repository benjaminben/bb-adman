// The panels' provider choice (spec/screens-campaign.md, "The trial mark in the panels"): one
// owner for the trial mark. With `trial` true, "(trial)" follows the chosen name, so the panel
// reads "ComfyUI (trial)", and it is the select's description for a screen reader. The options
// keep their own names, so the end-to-end helpers, which pick an option by its name, still
// find it; the field's label is the caller's ("Provider").
import { useId } from 'react'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import layout from '@/renderer/ui/layout.module.css'
import styles from './provider-select.module.css'

export function ProviderSelect(props: {
  label: string
  providers: ProviderInfo[]
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
              {p.label}
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
