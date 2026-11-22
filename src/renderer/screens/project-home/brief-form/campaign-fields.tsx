// The brief form's campaign fields (spec/screens-campaign.md, "The brief form", Campaign;
// HOME-3a): inline fields "Name", "Region", "Audience" and "Message" stacked (the message in
// the reading face), then one row of three small optional fields. Each input keeps its old
// accessible name ("Campaign name", "Offer (optional)"). Values are drawn as typed.
import { useId, type Ref } from 'react'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brief-form.module.css'

export type CampaignText =
  'campaignName' | 'region' | 'audience' | 'offer' | 'callToAction' | 'tone' | 'message'

// The key, the visible label, and the old accessible name where it differs.
const MAIN: [CampaignText, string, string?][] = [
  ['campaignName', 'Name', 'Campaign name'],
  ['region', 'Region'],
  ['audience', 'Audience'],
]

const OPTIONAL: [CampaignText, string, string][] = [
  ['offer', 'Offer', 'Offer (optional)'],
  ['callToAction', 'Call to action', 'Call to action (optional)'],
  ['tone', 'Tone', 'Tone (optional)'],
]

export function CampaignFields(props: {
  values: BriefFormValues
  firstField: Ref<HTMLInputElement>
  onChange: (key: CampaignText, text: string) => void
  onRegionLeave: () => void
}) {
  const id = useId()
  const line = (key: CampaignText, label: string, name?: string, small = false) => (
    <div key={key} className={`${layout.field} ${layout.inline} ${small ? styles.small : ''}`}>
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <input
        id={`${id}-${key}`}
        ref={key === 'campaignName' ? props.firstField : undefined}
        aria-label={name}
        placeholder={small ? 'Optional' : undefined}
        value={props.values[key]}
        onChange={(e) => props.onChange(key, e.target.value)}
        onBlur={key === 'region' ? props.onRegionLeave : undefined}
      />
    </div>
  )
  return (
    <div className={styles.fields}>
      {MAIN.map(([key, label, name]) => line(key, label, name))}
      <div className={`${layout.field} ${layout.inline} ${styles.message}`}>
        <label htmlFor={`${id}-message`}>Message</label>
        <textarea
          id={`${id}-message`}
          rows={3}
          className={layout.reading}
          value={props.values.message}
          onChange={(e) => props.onChange('message', e.target.value)}
        />
      </div>
      <div className={styles.trio}>
        {OPTIONAL.map(([key, label, name]) => line(key, label, name, true))}
      </div>
    </div>
  )
}
