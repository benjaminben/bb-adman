// spec/editor.md, "Properties panel", "Text" [REQ: FR-093, FR-249]. ED-2
// (spec/phases/design-wave-screens-a.md, "Text layer"): Copy first, with no title, "Suggest
// copy…" in its corner and a translated text's mark under it; then the line "This text does not
// fit its box." when it overflows (kept on the page, never folded); then the Type Section. The
// text is never shrunk for the user.
import type { ReactNode } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { TranslationStatus } from '@/renderer/editor/translation-status'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { CopyField } from './copy-field'
import { SuggestCopy } from './suggest-copy'
import { TypeSection } from './type-section'
import styles from './text-fields.module.css'

export type TextFieldsProps = {
  layer: LayerRow
  palette: string[]
  font: ReactNode
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

// No action for the headline slot (SuggestCopy draws nothing there), so the corner stays empty.
const actionFor = (layer: LayerRow) =>
  layer.slot === 'headline' ? undefined : <SuggestCopy layer={layer} />

// P6-14 (A-162): a translated text's Copy sends translation.set for the shown project, and its
// status mark sits under it.
function TranslatedCopy(props: { layer: LayerRow }) {
  const { layer } = props
  const api = useApi()
  const projectId = useApp((s) => (s.view.kind === 'project' ? s.view.projectId : null))
  if (projectId === null) return null
  async function commit(text: string): Promise<string | null> {
    const input = { projectId, layerId: layer.id, text, applyToSameLanguage: false }
    const result = await api.command('translation.set', input)
    return result.ok ? null : result.error.message
  }
  return (
    <>
      <CopyField
        copy={layer.copy ?? ''}
        disabled={layer.locked}
        action={actionFor(layer)}
        onCommit={commit}
      />
      <TranslationStatus projectId={projectId} layer={layer} />
    </>
  )
}

export function TextFields(props: TextFieldsProps) {
  const { layer } = props
  return (
    <div className={styles.fields}>
      {layer.translationStatus === null ? (
        <CopyField
          copy={layer.copy ?? ''}
          disabled={layer.locked}
          action={actionFor(layer)}
          onCommit={(copy) => props.onUpdate({ copy })}
        />
      ) : (
        <TranslatedCopy layer={layer} />
      )}
      {layer.overflow && <p className={styles.overflow}>This text does not fit its box.</p>}
      <TypeSection {...props} />
    </div>
  )
}
