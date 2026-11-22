// The publish dialog's warnings step [P9-13] (spec/phases/phase-09.md "Screens"), built as the
// export dialog's: the warnings publish.run refused with, one line each, "{ad} · {check}:
// {message}", drawn as text with displayName (a message can quote project text); and the
// optional reason, at most 500 characters (DLG-6b: its words are the placeholder and the name),
// which is written into the published report: that line stays visible words. The ads
// are named from campaign.get; an ad not found there is left out of its line. The buttons are
// the dialog's foot.
import { useEffect, useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import { displayName } from '@/shared/publish/display-text'
import { PROCEED_REASON_MAX } from '@/shared/schemas/commands/publish'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { ErrorBody } from '@/shared/schemas/result'
import styles from './publish-dialog.module.css'

export type PublishWarningLine = { variantId: string; title: string; message: string }

const HEADING = 'These ads have warnings'

const isLine = (w: unknown): w is PublishWarningLine =>
  typeof w === 'object' &&
  w !== null &&
  ['variantId', 'title', 'message'].every(
    (k) => typeof (w as Record<string, unknown>)[k] === 'string',
  )

// The warnings of a publish_has_warnings refusal; null for any other refusal.
export function warningsOf(error: ErrorBody): PublishWarningLine[] | null {
  const details = error.details
  if (details?.reason !== 'publish_has_warnings' || !Array.isArray(details.warnings)) return null
  return details.warnings.filter(isLine)
}

function useAdNames(projectId: string, campaignId: string): ReadonlyMap<string, string> {
  const api = useApi()
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    let live = true
    void api.query('campaign.get', { projectId, campaignId }).then((reply) => {
      const ads = reply.ok ? ((reply.data as CampaignGet | null)?.variants ?? []) : []
      const lines = ads.map((ad) => [ad.id, `${ad.title} · ${ad.sizeLabel} · ${ad.language}`])
      if (live) setNames(new Map(lines as Array<[string, string]>))
    })
    return () => {
      live = false
    }
  }, [api, projectId, campaignId])
  return names
}

export type PublishWarningsProps = {
  projectId: string
  campaignId: string
  warnings: PublishWarningLine[]
  reason: string
  disabled: boolean
  onReason: (reason: string) => void
}

export function PublishWarnings(props: PublishWarningsProps) {
  const id = useId()
  const names = useAdNames(props.projectId, props.campaignId)
  const line = (w: PublishWarningLine) => {
    const ad = names.get(w.variantId)
    const check = `${displayName(w.title)}: ${displayName(w.message)}`
    return ad === undefined ? check : `${displayName(ad)} · ${check}`
  }

  return (
    <>
      <p className={styles.heading}>{HEADING}</p>
      <ul aria-label={HEADING} className={styles.warnings}>
        {props.warnings.map((w, i) => (
          <li key={i}>{line(w)}</li>
        ))}
      </ul>
      <div className={layout.field}>
        <input
          type="text"
          aria-label="Why publish anyway? (optional)"
          placeholder="Why publish anyway? (optional)"
          maxLength={PROCEED_REASON_MAX}
          aria-describedby={`${id}-published`}
          value={props.reason}
          disabled={props.disabled}
          onChange={(e) => props.onReason(e.target.value)}
        />
        <p id={`${id}-published`} className={styles.note}>
          This reason is written into the published report.
        </p>
      </div>
    </>
  )
}
