// S2-5 (spec/screens-campaign.md, "Campaign page: ComfyUI failures in the run row"): what a
// failed run shows in place of one sentence. [REQ: FR-265, FR-266, FR-267, FR-069]
// P4-5: moved to ui/ so the activity panel and the earlier options show it too.
// The sentence comes from the reason when the row has one, else from the kind. The address
// fills the sentence only; the missing items come from the app's own workflow files. A custom
// workflow's row holds only their count (CW-7).
import { useId } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { missingItemText } from '@/renderer/ui/missing-item-text'
import {
  customMissingMessage,
  fillMarks,
  plainMessage,
  reasonMessage,
} from '@/shared/providers/messages'
import type { ProviderErrorReason, ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { useComfyInfo } from '@/renderer/screens/campaign/use-comfy-info'
import { missingCount, missingItems } from './missing-items'
import { ServerMessageBlock, ServerMessageButton, useServerMessage } from './server-message'
import styles from './run-failure.module.css'

// The reasons the user can fix in Settings [FR-265].
const SETTINGS_REASONS: ReadonlySet<ProviderErrorReason> = new Set([
  'address_needed',
  'no_answer',
  'not_comfyui',
  'sign_in_needed',
  'redirect_refused',
  'certificate',
  'address_refused',
])

// Only a row with a reason asks comfy.getInfo, for the address its sentence may name. Before
// the answer the mark reads "the saved address". P4-5 (OI-68): {provider} is the label.
function ReasonSentence(props: {
  reason: ProviderErrorReason
  n: number | undefined
  provider: string
  custom: boolean
}) {
  const info = useComfyInfo()
  const address = info?.address ?? undefined
  const text =
    props.custom && props.n !== undefined
      ? customMissingMessage(props.n)
      : reasonMessage(props.reason)
  return (
    <p className={styles.sentence}>
      {fillMarks(text, { address, n: props.n, provider: props.provider })}
    </p>
  )
}

export function RunFailure(props: {
  row: JobRow
  projectId: string
  provider: ProviderInfo | undefined
  providerLabel: string
}) {
  const { row, provider } = props
  const show = useApp((s) => s.show)
  const message = useServerMessage(props.projectId, row.id)
  const blockId = useId()
  const reason = row.errorReason
  const missing = reason === 'missing_items' ? missingItems(row.result) : []
  // CW-7: a custom workflow's row holds the count only, never the names.
  const counted = reason === 'missing_items' && missing.length === 0
  const count = counted ? missingCount(row.result) : undefined
  const settings = reason !== null && SETTINGS_REASONS.has(reason)
  const serverText = provider?.serverText === true

  return (
    <div className={`${layout.notice} ${layout.danger} ${styles.failure}`}>
      <span className={styles.mark}>
        <Icon name="alert" size="small" />
      </span>
      <div className={styles.content}>
        {reason === null ? (
          <p className={styles.sentence}>
            {plainMessage(row.errorKind ?? 'other', props.providerLabel)}
          </p>
        ) : (
          <ReasonSentence
            reason={reason}
            n={count ?? (missing.length > 0 ? missing.length : undefined)}
            provider={props.providerLabel}
            custom={count !== undefined}
          />
        )}
        {missing.length > 0 && (
          <>
            <p id={`${blockId}-missing`} className={styles.label}>
              What the server is missing
            </p>
            <ul className={styles.items} aria-labelledby={`${blockId}-missing`}>
              {missing.map((item) => (
                <li key={`${item.what}:${item.folder ?? ''}:${item.name}`}>
                  {missingItemText(item)}
                </li>
              ))}
            </ul>
          </>
        )}
        {(settings || serverText) && (
          <div className={styles.actions}>
            {settings && (
              <button type="button" onClick={() => show({ kind: 'settings' })}>
                Open Settings
              </button>
            )}
            {serverText && (
              <ServerMessageButton
                open={message.open}
                loading={message.reply.state === 'loading'}
                blockId={blockId}
                onToggle={() => void message.toggle()}
              />
            )}
          </div>
        )}
        {serverText && message.open && <ServerMessageBlock id={blockId} reply={message.reply} />}
      </div>
    </div>
  )
}
