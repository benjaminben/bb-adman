// The generate fields (spec/screens-ai.md, "Generate fields"; FR-062, FR-063, workflow 5.1
// step 5): "Prompt", "Reference pictures" with the reference dialog, and "Generate…", which
// opens the run dialog. Its Confirm sends one generation.runImages for this layer; the
// provider is asked for the layer box's shape by the command (OI-70). The prompt and the
// chosen pictures are the layer's draft (A-70). A locked layer's fields are disabled.
import { useId, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import { ReferenceDialog } from '@/renderer/dialogs/reference-dialog'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import { MAX_IMAGES_PER_RUN } from '@/shared/config/defaults'
import type { JobStarted } from '@/shared/schemas/commands/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { RunStatus } from './run-status'
import layout from '@/renderer/ui/layout.module.css'
import { useFirstDraft } from './use-first-draft'
import styles from './generate-fields.module.css'

export type GenerateFieldsProps = {
  projectId: string
  campaignId: string | null
  layer: LayerRow
}

export function GenerateFields(props: GenerateFieldsProps) {
  const { projectId, layer } = props
  const command = useApp((s) => s.command)
  const perRun = useApp((s) => s.app?.settings.generation.optionsPerRun ?? 1)
  const { key, draft, subjectId } = useFirstDraft(projectId, props.campaignId, layer)
  const [dialog, setDialog] = useState<'run' | 'references' | null>(null)
  const promptId = useId()
  const disabled = layer.locked || draft === undefined
  const chosen = draft?.referenceAssetIds ?? []
  const change = generateDrafts.getState().change
  const count = Math.min(Math.max(perRun, 1), MAX_IMAGES_PER_RUN)

  async function confirm(provider: string, n: number | null) {
    const sent = n ?? count
    const reply = await command('generation.runImages', {
      projectId,
      variantId: layer.variantId,
      layerId: layer.id,
      prompt: draft?.prompt ?? '',
      referenceAssetIds: chosen,
      count: sent,
      provider,
    })
    const jobId = reply.ok ? (reply.data as Partial<JobStarted> | null)?.jobId : undefined
    if (typeof jobId === 'string') {
      change(key, { run: { jobId, count: sent } })
      setDialog(null)
    }
    return reply
  }

  return (
    <div className={styles.fields}>
      <label htmlFor={promptId} className={styles.label}>
        Prompt
      </label>
      <textarea
        id={promptId}
        className={`${styles.prompt} ${layout.reading}`}
        rows={5}
        value={draft?.prompt ?? ''}
        disabled={disabled}
        onChange={(e) => change(key, { prompt: e.target.value })}
      />
      <p className={styles.label}>Reference pictures</p>
      {draft && (
        <p className={styles.count}>
          {chosen.length > 0 ? `${chosen.length} chosen` : 'None chosen'}
        </p>
      )}
      <div className={styles.buttons}>
        <button type="button" disabled={disabled} onClick={() => setDialog('references')}>
          Choose reference pictures…
        </button>
        <button type="button" disabled={disabled} onClick={() => setDialog('run')}>
          Generate…
        </button>
      </div>
      {draft?.run && <RunStatus projectId={projectId} layerId={layer.id} run={draft.run} />}
      <ReferenceDialog
        open={dialog === 'references'}
        projectId={projectId}
        layerName={layer.name}
        subjectId={subjectId}
        chosen={chosen}
        onDone={(ids) => {
          change(key, { referenceAssetIds: ids })
          setDialog(null)
        }}
        onCancel={() => setDialog(null)}
      />
      <RunDialog
        open={dialog === 'run'}
        projectId={projectId}
        job="image"
        title="Make pictures"
        confirmLabel="Generate"
        count={{ label: 'Pictures', value: count, min: 1, max: MAX_IMAGES_PER_RUN }}
        referenceCount={chosen.length}
        {...(props.campaignId === null ? {} : { campaignId: props.campaignId })}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      />
    </div>
  )
}
