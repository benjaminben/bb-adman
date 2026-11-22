// One language of the Translations tab (spec/phases/phase-06.md, design addition 8; CAMP-5): a
// Section titled with the language's name, its header holding the approved bar, the running
// jobs' spinners and Stop, "Approve all" and "Translate again…". Under the header the failed
// jobs stay as notices, then the column heads once (the source language and this one) and the
// rows. Edits send translation.set; "Proposed" and "Approve all" send translation.approve with
// each row's copy counter as read (P6-4b). After every reply the rows are read again, so a
// refusal such as "A text changed after you read it." is followed by the newest text. A
// refusal's own message shows on its row, or under the header for "Approve all".
// R3-3: the header is a level 2 heading in the title type role; the rows follow the Variants
// tab's order, split by direction (direction-lists.tsx); a row whose source text changed since
// it was last synced shows "Out of date".
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import { Section } from '@/renderer/ui/section'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type {
  TranslationJobState,
  TranslationRow as Row,
} from '@/shared/schemas/queries/translation'
import type { Result } from '@/shared/schemas/result'
import { DirectionLists } from './direction-lists'
import { GroupHead } from './group-head'
import { FailedNotice } from './job-line'
import { TranslationRow } from './translation-row'
import { type ApproveLayer, approvalOf, languageName } from './translation-words'
import styles from './translation-panel.module.css'

export type LanguageGroupProps = {
  projectId: string
  campaignId: string
  language: string
  primaryLanguage: string // the source texts' language code
  rows: Row[]
  jobs: TranslationJobState[]
  revs: ReadonlyMap<string, number> // each variant's revision, for its thumbnail
  data: CampaignGet // the campaign as the Variants tab draws it, for the order
  outOfDate: ReadonlySet<string> // the layer IDs whose source text changed since their sync
  reload: () => void
}

type Messages = { group: string | null; rows: Record<string, string> }

export function LanguageGroup(props: LanguageGroupProps) {
  const api = useApi()
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Messages>({ group: null, rows: {} })
  const name = languageName(props.language)
  const proposed = approvalOf(props.rows)

  // `layerId` names the row a refusal belongs on; null puts it under the header.
  const send = async (layerId: string | null, call: () => Promise<Result<unknown>>) => {
    setBusy(true)
    setMessages({ group: null, rows: {} })
    const reply = await call()
    setBusy(false)
    if (!reply.ok) {
      const message = reply.error.message
      setMessages(
        layerId === null
          ? { group: message, rows: {} }
          : { group: null, rows: { [layerId]: message } },
      )
    }
    props.reload()
  }
  const approve = (layerId: string | null, layers: ApproveLayer[]) =>
    void send(layerId, () =>
      api.command('translation.approve', { projectId: props.projectId, layers }),
    )
  const save = (layerId: string, text: string, applyToSameLanguage: boolean) =>
    void send(layerId, () =>
      api.command('translation.set', {
        projectId: props.projectId,
        layerId,
        text,
        applyToSameLanguage,
      }),
    )

  const head = (
    <GroupHead
      projectId={props.projectId}
      campaignId={props.campaignId}
      language={props.language}
      rows={props.rows}
      jobs={props.jobs}
      busy={busy}
      proposed={proposed.length}
      onApproveAll={() => approve(null, proposed)}
    />
  )
  return (
    <div className={styles.block}>
      <Section
        id={`translations.${props.language}`}
        title={name}
        level={2}
        size="title"
        fold="none"
        summary={head}
      >
        {props.jobs
          .filter((job) => job.status === 'failed')
          .map((job) => (
            <FailedNotice
              key={job.jobId}
              projectId={props.projectId}
              campaignId={props.campaignId}
              job={job}
            />
          ))}
        {messages.group !== null && (
          <p role="alert" className={`${layout.notice} ${layout.warn}`}>
            {messages.group}
          </p>
        )}
        <div className={styles.heads}>
          <span />
          <span>{languageName(props.primaryLanguage)}</span>
          <span>{name}</span>
        </div>
        <DirectionLists rows={props.rows} data={props.data} label={`${name} translations`}>
          {(row) => (
            <TranslationRow
              key={`${row.layerId}:${row.copyRev}`}
              projectId={props.projectId}
              row={row}
              rev={props.revs.get(row.variantId)}
              language={name}
              outOfDate={props.outOfDate.has(row.layerId)}
              message={messages.rows[row.layerId] ?? null}
              busy={busy}
              onSave={(text, apply) => save(row.layerId, text, apply)}
              onApprove={() =>
                approve(row.layerId, [{ layerId: row.layerId, copyRev: row.copyRev }])
              }
            />
          )}
        </DirectionLists>
      </Section>
    </div>
  )
}
