// "Export campaign" [P8-11] (spec/phases/phase-08.md "The output folder", "Export run"). The
// user ticks ads, picks a folder with the system picker and a format; nothing is sent before
// "Export". The warnings gate shows its step, where "Export anyway" sends the same input again
// with proceedDespiteWarnings and the trimmed reason. Then the job's percent and end counts.
// From a send until its reply every button is disabled and the dialog cannot close.
import { useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { ExportRunInput } from '@/shared/schemas/commands/export'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { PickedPath } from '@/shared/schemas/queries/dialog'
import { AdTicks } from './ad-ticks'
import { ExportOptions, qualityOf, type ExportChoices } from './export-options'
import { ExportWarnings } from './export-warnings'
import { useExportJob, type ExportStep } from './use-export-job'
import styles from './export-dialog.module.css'

export type ExportDialogProps = { projectId: string; campaignId: string; onClose: () => void }

const ENDED = { failed: 'The export failed.', cancelled: 'The export was cancelled.' }

function useAds(projectId: string, campaignId: string) {
  const api = useApi()
  const [ads, setAds] = useState<VariantSummary[] | null>(null)
  useEffect(() => {
    let live = true
    void api.query('campaign.get', { projectId, campaignId }).then((reply) => {
      if (live) setAds(reply.ok ? ((reply.data as CampaignGet | null)?.variants ?? []) : [])
    })
    return () => {
      live = false
    }
  }, [api, projectId, campaignId])
  return ads
}

function endLine(step: ExportStep): string | null {
  if (step.kind === 'running') return `Exporting… ${step.percent}%`
  if (step.kind === 'done') return `Exported ${step.exported} ads. ${step.failed} failed.`
  return step.kind === 'ended' ? ENDED[step.status] : null
}

export function ExportDialog(props: ExportDialogProps) {
  const { projectId, campaignId } = props
  const api = useApi()
  const settings = useApp((s) => s.app?.settings.export)
  const ads = useAds(projectId, campaignId)
  const { step, sending, send, back } = useExportJob()
  const [ticked, setTicked] = useState<ReadonlySet<string> | null>(null)
  const [folder, setFolder] = useState<string | null>(null)
  const [choices, setChoices] = useState<ExportChoices>({
    imageFormat: settings?.imageFormat ?? 'png',
    jpgQuality: String(settings?.jpgQuality ?? 90),
    fps: settings?.fps ?? 30,
  })
  const [reason, setReason] = useState('')
  // The input the last "Export" sent; "Export anyway" sends it again.
  const [held, setHeld] = useState<ExportRunInput | null>(null)

  if (ads !== null && ticked === null) setTicked(new Set(ads.map((ad) => ad.id)))
  const shown = ticked ?? new Set<string>()
  const variantIds = (ads ?? []).filter((ad) => shown.has(ad.id)).map((ad) => ad.id)
  const showFps = (ads ?? []).some((ad) => shown.has(ad.id) && ad.format === 'video')
  const jpgQuality = qualityOf(choices.jpgQuality)
  const ready = folder !== null && variantIds.length > 0 && jpgQuality !== null

  async function chooseFolder() {
    const picked = await api.query('dialog.pickFolder', { title: 'Export to' })
    const path = picked.ok ? (picked.data as PickedPath | null)?.path : null
    if (typeof path === 'string') setFolder(path)
  }

  function exportNow() {
    if (folder === null || jpgQuality === null || variantIds.length === 0) return
    const { imageFormat, fps } = choices
    const input = { projectId, campaignId, variantIds, outputDir: folder, imageFormat, fps }
    const first = { ...input, jpgQuality, proceedDespiteWarnings: false }
    setHeld(first)
    void send(first)
  }

  function exportAnyway() {
    if (held === null) return
    const trimmed = reason.trim()
    const extra = trimmed === '' ? {} : { reason: trimmed }
    void send({ ...held, proceedDespiteWarnings: true, ...extra })
  }

  const primary = (label: string, onClick: () => void, enabled = true) => (
    <button
      type="button"
      className={layout.primary}
      disabled={sending || !enabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
  const plain = (label: string, onClick: () => void) => (
    <button type="button" disabled={sending} onClick={onClick}>
      {label}
    </button>
  )

  const footer =
    step.kind === 'choose' ? (
      <>
        {plain('Cancel', props.onClose)}
        {primary('Export', exportNow, ready)}
      </>
    ) : step.kind === 'warnings' ? (
      <>
        {plain('Back', back)}
        {primary('Export anyway', exportAnyway)}
      </>
    ) : (
      primary('Close', props.onClose)
    )

  const line = endLine(step)
  return (
    <DialogFrame
      open
      onClose={props.onClose}
      title="Export campaign"
      closable={!sending}
      footer={footer}
      size="wide"
    >
      <div className={styles.body}>
        {ads === null && <p className={layout.muted}>Loading the ads…</p>}
        {ads !== null && step.kind === 'choose' && (
          <>
            <AdTicks ads={ads} ticked={shown} disabled={sending} onChange={setTicked} />
            <ExportOptions
              folder={folder}
              choices={choices}
              showFps={showFps}
              disabled={sending}
              onChooseFolder={() => void chooseFolder()}
              onChange={setChoices}
            />
          </>
        )}
        {ads !== null && step.kind === 'warnings' && (
          <ExportWarnings
            warnings={step.warnings}
            ads={ads}
            reason={reason}
            disabled={sending}
            onReason={setReason}
          />
        )}
        {line !== null && (
          <p role="status" className={styles.line}>
            {line}
          </p>
        )}
      </div>
    </DialogFrame>
  )
}
