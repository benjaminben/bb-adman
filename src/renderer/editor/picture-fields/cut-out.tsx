// P4-19, spec/screens-ai.md "Cut-out" [REQ: FR-307]: "Cut out the subject…" for a layer with a
// picture, shown when some provider can cut out (the run dialog's own rule: ComfyUI with an
// offered `cutout` workflow, or another available provider that lists `cutout`). It opens the
// run dialog (job cutout, no count); Confirm sends one generation.cutOut. The result is a new
// asset, found under Earlier options; the layer is not changed here. A refusal stays in the
// run dialog. licenceConfirmed is never sent from here (see the P4-19 report).
import { useState } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import { runChoices } from '@/renderer/dialogs/run-dialog/provider-choice'
import { useComfyInfo } from '@/renderer/screens/campaign/use-comfy-info'
import type { JobStarted } from '@/shared/schemas/commands/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { CutOutStatus } from './cut-out-status'
import styles from './picture-fields.module.css'

export function CutOut(props: { projectId: string; layer: LayerRow }) {
  const { projectId, layer } = props
  const command = useApp((s) => s.command)
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const info = useComfyInfo()
  const [open, setOpen] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const canRun = runChoices('cutout', [...providers], info, 0).some((c) => c.enabled)

  async function confirm(provider: string) {
    const reply = await command('generation.cutOut', {
      projectId,
      variantId: layer.variantId,
      layerId: layer.id,
      provider,
    })
    const started = reply.ok ? (reply.data as Partial<JobStarted> | null)?.jobId : undefined
    if (typeof started === 'string') {
      setJobId(started)
      setOpen(false)
    }
    return reply
  }

  if (!canRun) return null
  return (
    <div className={styles.cutOut}>
      <div className={styles.buttons}>
        <button type="button" disabled={layer.locked} onClick={() => setOpen(true)}>
          Cut out the subject…
        </button>
      </div>
      {jobId !== null && <CutOutStatus projectId={projectId} layerId={layer.id} jobId={jobId} />}
      <RunDialog
        open={open}
        projectId={projectId}
        job="cutout"
        title="Cut out the subject"
        confirmLabel="Cut out"
        onConfirm={(provider) => confirm(provider)}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}
