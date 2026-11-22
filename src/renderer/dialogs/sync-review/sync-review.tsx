// spec/screens-variants.md, "Sync review": "Sync {direction name}". It reads sync.preview on
// open and lists each out-of-date variant's changes. "Accept all" and "Accept selected" send
// sync.apply with the reply's masterRev through the app store's command, so a refusal also
// reaches the banner. On master_changed the message stays and the changes are read again; on
// success the dialog closes. Changes left unticked stay out of date. The button mounts it
// afresh for each opening, so each opening starts unticked. P6-16: translated copy changes
// start their sync translations (use-sync-translations.ts) and are read again when one ends.
// P6-18: with a paid text provider each waiting language gets a "Translate" line instead.
// DLG-7: kind="review", two panes: the variants listed on the left (sync-list.tsx), the picked
// one's changes on the right (variant-changes.tsx). Ticks and choices are kept here, so
// picking another row changes nothing that is sent.
import { useCallback, useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { DirectionControlProps } from '@/renderer/screens/campaign/direction-header'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { SyncDecision } from '@/shared/schemas/links'
import type { SyncPreview, SyncPreviewReply } from '@/shared/schemas/queries/sync'
import { acceptAll, acceptSelected, type Choices } from './decisions'
import type { PaidAsk } from './translate-ask'
import { SyncList, type SyncRowState, waitsForText } from './sync-list'
import { VariantChanges } from './variant-changes'
import { typedTranslation } from './typed-translation'
import { useSyncTranslations } from './use-sync-translations'
import styles from './sync-review.module.css'

export type SyncReviewProps = DirectionControlProps & { open: boolean; onClose: () => void }

type View =
  | { kind: 'reading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; reply: SyncPreviewReply }

const ALERT = `${layout.notice} ${layout.danger}`

const isMasterChanged = (details: Record<string, unknown> | undefined) =>
  details?.reason === 'master_changed'

export function SyncReview(props: SyncReviewProps) {
  const { projectId, direction, open } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const [view, setView] = useState<View>({ kind: 'reading' })
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const [choices, setChoices] = useState<Choices>({})
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [reads, setReads] = useState(0)
  const [picked, setPicked] = useState<string>()

  useEffect(() => {
    if (!open) return
    let live = true
    void api.query('sync.preview', { projectId, directionId: direction.id }).then((reply) => {
      if (!live) return
      if (!reply.ok) setView({ kind: 'failed', message: reply.error.message })
      else setView({ kind: 'ready', reply: reply.data as SyncPreviewReply })
    })
    return () => {
      live = false
    }
  }, [api, open, projectId, direction.id, reads])

  const reply = view.kind === 'ready' ? view.reply : null
  const variants = reply?.variants ?? []
  const summaries = props.campaign.variants
  const languageOf = useCallback(
    (id: string) => summaries.find((v) => v.id === id)?.language,
    [summaries],
  )
  const readAgain = useCallback(() => setReads((n) => n + 1), [])
  const translations = useSyncTranslations({
    projectId,
    directionId: direction.id,
    reply,
    languageOf,
    onDone: readAgain,
  })
  const paid = translations.paid
  const askOf = (language: string): PaidAsk | null =>
    paid?.asking.has(language)
      ? {
          label: paid.label,
          onConfirm: () => translations.confirm(language),
          onCancel: () => translations.cancel(language),
        }
      : null
  const rowState = (preview: SyncPreview): SyncRowState => {
    const language = languageOf(preview.variantId) ?? ''
    const run = translations.runs[language]
    const waiting = waitsForText(preview)
    return {
      offer: waiting && run === undefined && paid !== null && paid.needs.includes(language),
      ask: askOf(language),
      untranslated: waiting && (run === undefined || run.kind === 'failed'),
    }
  }
  const shown = variants.find((v) => v.variantId === picked) ?? variants[0]
  const onType = (variantId: string) => async (layerKey: string, text: string) => {
    const refusal = await typedTranslation(api, command, { projectId, variantId, layerKey, text })
    if (refusal === null) readAgain()
    return refusal
  }

  function close() {
    setRefusal(null)
    props.onClose()
  }

  async function send(decisions: SyncDecision[]) {
    if (!reply) return
    setSending(true)
    setRefusal(null)
    const input = { projectId, directionId: direction.id, masterRev: reply.masterRev, decisions }
    const result = await command('sync.apply', input)
    setSending(false)
    if (result.ok) return close()
    setRefusal(result.error.message)
    if (!isMasterChanged(result.error.details)) return
    setView({ kind: 'reading' })
    setTicked(new Set())
    setChoices({})
    setReads((n) => n + 1)
  }

  const tick = (key: string, on: boolean) =>
    setTicked((was) => {
      const next = new Set(was)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const foot = (
    <>
      <button type="button" disabled={sending} onClick={close}>
        Cancel
      </button>
      <button
        type="button"
        disabled={sending || ticked.size === 0}
        onClick={() => void send(acceptSelected(variants, ticked, choices))}
      >
        Accept selected
      </button>
      <button
        type="button"
        className={layout.primary}
        disabled={sending || variants.length === 0}
        onClick={() => void send(acceptAll(variants, choices))}
      >
        Accept all
      </button>
    </>
  )

  return (
    <DialogFrame
      open={open}
      onClose={close}
      title={`Sync ${direction.name}`}
      closable={!sending}
      footer={foot}
      kind="review"
    >
      <div className={styles.body}>
        {refusal !== null && (
          <p role="alert" className={ALERT}>
            {refusal}
          </p>
        )}
        {view.kind === 'reading' && (
          <p role="status" className={styles.reading}>
            <BusySpinner />
            Reading the changes…
          </p>
        )}
        {view.kind === 'failed' && (
          <p role="alert" className={ALERT}>
            {view.message}
          </p>
        )}
        {reply && variants.length === 0 && <p>Every variant is up to date.</p>}
        {shown && (
          <div className={styles.panes}>
            <SyncList
              projectId={projectId}
              variants={variants}
              summaries={summaries}
              picked={shown.variantId}
              disabled={sending}
              stateOf={rowState}
              onPick={setPicked}
              onAsk={(id) => translations.ask(languageOf(id) ?? '')}
            />
            <VariantChanges
              key={shown.variantId}
              projectId={projectId}
              variant={summaries.find((v) => v.id === shown.variantId)}
              preview={shown}
              ticked={ticked}
              choices={choices}
              disabled={sending}
              onTick={tick}
              onChoose={(key, choice) => setChoices((was) => ({ ...was, [key]: choice }))}
              run={translations.runs[languageOf(shown.variantId) ?? '']}
              ask={askOf(languageOf(shown.variantId) ?? '')}
              onRetry={() => translations.retry(languageOf(shown.variantId) ?? '')}
              onType={onType(shown.variantId)}
            />
          </div>
        )}
      </div>
    </DialogFrame>
  )
}
