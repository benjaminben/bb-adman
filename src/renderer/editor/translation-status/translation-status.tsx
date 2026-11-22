// spec/phases/phase-06.md, design addition 8, "Editor" (P6-14): under Copy, a translated text
// layer's status, "Translation: {Missing | Proposed | Approved}, {source}", drawn from the layer
// row the editor holds (read again on project.changed), and "Approve" on a proposed one. Approve
// sends translation.approve with the copy counter read (P6-4b), so a text changed since is
// refused; the refusal's own sentence shows under the line.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './translation-status.module.css'

export type TranslationStatusProps = { projectId: string; layer: LayerRow }

const STATUS: Record<NonNullable<LayerRow['translationStatus']>, string> = {
  missing: 'Missing',
  proposed: 'Proposed',
  approved: 'Approved',
}

const SOURCE: Record<NonNullable<LayerRow['translationSource']>, string> = {
  ai: 'from AI',
  agent: 'from an agent',
  user: 'from you',
  brief: 'from the brief',
}

function wordsOf(layer: LayerRow): string {
  const status = layer.translationStatus ? STATUS[layer.translationStatus] : ''
  const source = layer.translationSource ? SOURCE[layer.translationSource] : undefined
  return source ? `Translation: ${status}, ${source}` : `Translation: ${status}`
}

export function TranslationStatus(props: TranslationStatusProps) {
  const { layer } = props
  const api = useApi()
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    const result = await api.command('translation.approve', {
      projectId: props.projectId,
      layers: [{ layerId: layer.id, copyRev: layer.revs.copy }],
    })
    setError(result.ok ? null : result.error.message)
  }

  return (
    <>
      <div className={styles.status}>
        <p className={styles.words}>{wordsOf(layer)}</p>
        {layer.translationStatus === 'proposed' && (
          <button type="button" className={layout.small} onClick={() => void approve()}>
            Approve
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  )
}
