// R2E-3 (spec/phases/round-2-editor.md D3, "In the editor"): under the font field, while the
// project has no font of its own, "Built-in styles": five looks made from Inter alone. The one
// matching the layer is pressed; a click sends one layer.update of weight, capitals and spacing
// with the font back to the default (one undo entry). A refusal shows under the group.
import { useId, useState } from 'react'
import { useApi, useApp, useHasApp } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import { TYPE_STYLES, typeStyleOf, typeStylePatch } from '@/shared/config/type-styles'
import type { AdmanApi } from '@/shared/schemas/api'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { useHasFonts } from './use-has-fonts'
import styles from './type-styles.module.css'

export type TypeStylesProps = {
  layer: LayerRow
  // Resolves to the refusal message, or null when the layer was updated.
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

function Group(props: TypeStylesProps & { api: AdmanApi; projectId: string }) {
  const { layer } = props
  const id = useId()
  const hasFonts = useHasFonts(props.api, props.projectId)
  const [error, setError] = useState<string | null>(null)
  if (hasFonts !== false) return null
  const current = typeStyleOf(layer.style as TextStyle)

  async function choose(styleId: (typeof TYPE_STYLES)[number]['id']) {
    setError(await props.onUpdate({ style: typeStylePatch(styleId) }))
  }

  return (
    <div className={styles.field}>
      <span id={`${id}-label`} className={styles.label}>
        Built-in styles
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className={styles.styles}
      >
        {TYPE_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${layout.small} ${styles.style}`}
            aria-pressed={current === s.id}
            disabled={layer.locked}
            onClick={() => void choose(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p id={`${id}-hint`} className={styles.hint}>
        This project has no fonts of its own. Use Upload font… to add one.
      </p>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}

function InProject(props: TypeStylesProps) {
  const api = useApi()
  const projectId = useApp((s) => (s.view.kind === 'project' ? s.view.projectId : null))
  if (projectId === null) return null
  return <Group {...props} api={api} projectId={projectId} />
}

// Text settings is also drawn alone, with no app around it (its own tests); then there is no
// project to read and the group is left out.
export function TypeStyles(props: TypeStylesProps) {
  return useHasApp() ? <InProject {...props} /> : null
}
