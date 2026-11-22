// "Export {campaign}" [P8-11; DLG-6a] (spec/phases/phase-08.md "The output folder", "Export
// run"). The user ticks ads, picks a folder with the system picker and a format; nothing is
// sent before "Export". The warnings gate shows its step, where "Export anyway" sends the same
// input again with proceedDespiteWarnings and the trimmed reason. Then the job's bar and end
// marks. From a send until its reply every button is disabled and the dialog cannot close.
import { useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { ExportRunInput } from '@/shared/schemas/commands/export'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { PickedPath } from '@/shared/schemas/queries/dialog'
import { AdTicks } from './ad-ticks'
import { ExportEnd } from './export-end'
import { ExportOptions, qualityOf, type ExportChoices } from './export-options'
import { ExportWarnings } from './export-warnings'
import { FolderRow } from './folder-row'
import { useExportJob } from './use-export-job'
import styles from './export-dialog.module.css'

export type ExportDialogProps = { projectId: string; campaignId: string; onClose: () => void }

type Loaded = { name: string | null; ads: VariantSummary[] }

function useAds(projectId: string, campaignId: string): Loaded | null {
  const api = useApi()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    let live = true
    void api.query('campaign.get', { projectId, campaignId }).then((reply) => {
      const got = reply.ok ? (reply.data as CampaignGet | null) : null
      if (live) setLoaded({ name: got?.campaign.name ?? null, ads: got?.variants ?? [] })
    })
    return () => {
      live = false
    }
  }, [api, projectId, campaignId])
  return loaded
}

export function ExportDialog(props: ExportDialogProps) {
  const { projectId, campaignId } = props
  const api = useApi()
  const settings = useApp((s) => s.app?.settings.export)
  const loaded = useAds(projectId, campaignId)
  const ads = loaded?.ads ?? null
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
    <button type="button" className={layout.quiet} disabled={sending} onClick={onClick}>
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

  return (
    <DialogFrame
      open
      onClose={props.onClose}
      title={`Export ${loaded?.name ?? 'campaign'}`}
      closable={!sending}
      footer={footer}
      kind="publish"
    >
      <div className={styles.body}>
        {ads === null && <p className={layout.muted}>Loading the ads…</p>}
        {ads !== null && step.kind === 'choose' && (
          <>
            <AdTicks
              projectId={projectId}
              ads={ads}
              ticked={shown}
              disabled={sending}
              onChange={setTicked}
            />
            <FolderRow
              folder={folder}
              disabled={sending}
              onChooseFolder={() => void chooseFolder()}
            />
            <ExportOptions
              choices={choices}
              showFps={showFps}
              disabled={sending}
              onChange={setChoices}
            />
          </>
        )}
        {ads !== null && step.kind === 'warnings' && (
          <ExportWarnings
            projectId={projectId}
            warnings={step.warnings}
            ads={ads}
            reason={reason}
            disabled={sending}
            onReason={setReason}
          />
        )}
        <ExportEnd step={step} />
      </div>
    </DialogFrame>
  )
}
