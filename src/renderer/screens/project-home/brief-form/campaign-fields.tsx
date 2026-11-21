// The brief form's campaign fields (spec/screens-campaign.md, "The brief form", Campaign): six
// one-line fields and the "Message" text area. Values are drawn as typed, as field values.
import type { Ref } from 'react'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
import styles from './brief-form.module.css'

export type CampaignText =
  'campaignName' | 'region' | 'audience' | 'offer' | 'callToAction' | 'tone' | 'message'

const LINES: [CampaignText, string][] = [
  ['campaignName', 'Campaign name'],
  ['region', 'Region'],
  ['audience', 'Audience'],
  ['offer', 'Offer (optional)'],
  ['callToAction', 'Call to action (optional)'],
  ['tone', 'Tone (optional)'],
]

export function CampaignFields(props: {
  values: BriefFormValues
  firstField: Ref<HTMLInputElement>
  onChange: (key: CampaignText, text: string) => void
  onRegionLeave: () => void
}) {
  return (
    <div className={styles.grid}>
      {LINES.map(([key, label]) => (
        <label key={key} className={styles.field}>
          {label}
          <input
            ref={key === 'campaignName' ? props.firstField : undefined}
            value={props.values[key]}
            onChange={(e) => props.onChange(key, e.target.value)}
            onBlur={key === 'region' ? props.onRegionLeave : undefined}
          />
        </label>
      ))}
      <label className={`${styles.field} ${styles.wide}`}>
        Message
        <textarea
          rows={3}
          value={props.values.message}
          onChange={(e) => props.onChange('message', e.target.value)}
        />
      </label>
    </div>
  )
}
