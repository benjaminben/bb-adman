// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "The panel"): the project's files
// along the left edge, over the page. A sticky head with "Close assets", the import buttons,
// then the groups. Escape inside it closes it; a dialog it opened keeps its own Escape, as the
// Activity panel does. Closing gives the opener the focus back (the scope does that).
// R2C-6: the Subjects group comes first, one card per subject by name, and "New subject…"
// joins the action row.
// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): compact density, a PanelHead with ✕,
// an action row, then the groups as folding Sections (the shared list, assets-list/, D-109).
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ASSETS_PANEL_ID, useAssetsPanel } from '@/renderer/screens/assets/assets-scope'
import { AssetsList, NewSubject } from '@/renderer/screens/assets/assets-list'
import { ImportFiles } from '@/renderer/screens/project-home/import-files'
import { PanelHead } from '@/renderer/ui/panel-head'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import styles from './assets-panel.module.css'

export type AssetsPanelProps = { projectId: string; subjects: SubjectRow[] }

export function AssetsPanel(props: AssetsPanelProps) {
  const panel = useAssetsPanel()
  const ref = useRef<HTMLElement>(null)
  const open = panel?.open === true && panel.projectId === props.projectId

  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !ref.current?.contains(e.target as Node)) return
    e.stopPropagation()
    panel?.hide()
  }

  if (!open) return null
  return (
    <section
      ref={ref}
      id={ASSETS_PANEL_ID}
      aria-label="Assets"
      tabIndex={-1}
      className={styles.panel}
      data-density="compact"
      onKeyDown={onKeyDown}
    >
      <div className={styles.top}>
        <PanelHead
          title="Assets"
          icon="box"
          onClose={() => panel.hide()}
          closeLabel="Close assets"
        />
      </div>
      <div className={styles.actions}>
        <ImportFiles projectId={props.projectId} subjects={props.subjects} />
        <NewSubject projectId={props.projectId} subjects={props.subjects} />
      </div>
      <div className={styles.groups}>
        <AssetsList {...props} place="panel" />
      </div>
    </section>
  )
}
