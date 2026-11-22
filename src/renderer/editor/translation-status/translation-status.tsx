// spec/phases/phase-06.md, design addition 8, "Editor" (P6-14): under Copy, a translated text
// layer's status, drawn from the layer row the editor holds (read again on project.changed).
// ED-2: a StatusMark (Proposed warn, Approved ok, Missing danger) whose tip is the built words
// "Translation: {status}, {source}", and on a proposed one an icon button "Approve". Approve is
// the user's own click: it sends translation.approve with the copy counter read (P6-4b), so a
// text changed since is refused; the refusal's own sentence shows on the page.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark, type StatusTone } from '@/renderer/ui/status-mark'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './translation-status.module.css'

export type TranslationStatusProps = { projectId: string; layer: LayerRow }

type Status = NonNullable<LayerRow['translationStatus']>

const STATUS: Record<Status, [string, StatusTone]> = {
  missing: ['Missing', 'danger'],
  proposed: ['Proposed', 'warn'],
  approved: ['Approved', 'ok'],
}

const SOURCE: Record<NonNullable<LayerRow['translationSource']>, string> = {
  ai: 'from AI',
  agent: 'from an agent',
  user: 'from you',
  brief: 'from the brief',
}

function wordsOf(layer: LayerRow, status: string): string {
  const source = layer.translationSource ? SOURCE[layer.translationSource] : undefined
  return source ? `Translation: ${status}, ${source}` : `Translation: ${status}`
}

export function TranslationStatus(props: TranslationStatusProps) {
  const { layer } = props
  const api = useApi()
  const [error, setError] = useState<string | null>(null)
  if (layer.translationStatus === null) return null
  const [word, tone] = STATUS[layer.translationStatus]

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
        <StatusMark tone={tone} label={word} tip={wordsOf(layer, word)} />
        {layer.translationStatus === 'proposed' && (
          <button
            type="button"
            className={layout.iconButton}
            aria-label="Approve"
            title="Approve"
            onClick={() => void approve()}
          >
            <Icon name="check" />
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
