// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "The panel"): the project's files
// along the left edge, over the page. A sticky head with "Close assets", the import buttons,
// then the groups. Escape inside it closes it; a dialog it opened keeps its own Escape, as the
// Activity panel does. Closing gives the opener the focus back (the scope does that).
// R2C-6: the Subjects group comes first, one card per subject by name, and "New subject…"
// joins the action row.
// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): compact density, a PanelHead with ✕,
// an action row, then the groups as folding Sections (asset-sections.tsx).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { SubjectDialog } from '@/renderer/dialogs/subject-dialog'
import { ASSETS_PANEL_ID, useAssetsPanel } from '@/renderer/screens/assets/assets-scope'
import { ImportFiles } from '@/renderer/screens/project-home/import-files'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { PanelHead } from '@/renderer/ui/panel-head'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { assetGroups } from './asset-groups'
import { GroupSection, SubjectsSection } from './asset-sections'
import { useAssets } from './use-assets'
import styles from './assets-panel.module.css'

export type AssetsPanelProps = { projectId: string; subjects: SubjectRow[] }

function PanelBody(props: AssetsPanelProps) {
  const { projectId } = props
  const command = useApp((s) => s.command)
  const { read, retry } = useAssets(projectId)
  const onSubject = (assetId: string, subjectId: string | null) =>
    void command('asset.update', { projectId, assetId, subjectId })
  if (read.kind === 'loading') return <p className={styles.empty}>Loading the assets…</p>
  if (read.kind === 'refused')
    return (
      <div role="alert" className={`${layout.notice} ${layout.warn} ${styles.refused}`}>
        {read.message}
        <button type="button" onClick={retry}>
          Retry
        </button>
      </div>
    )
  return (
    <>
      <SubjectsSection {...props} assets={read.assets} />
      {assetGroups(read.assets).map((group) => (
        <GroupSection key={group.key} {...props} group={group} onSubject={onSubject} />
      ))}
    </>
  )
}

export function AssetsPanel(props: AssetsPanelProps) {
  const panel = useAssetsPanel()
  const ref = useRef<HTMLElement>(null)
  const [making, setMaking] = useState(false)
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
        <button
          type="button"
          aria-label="New subject…"
          title="New subject…"
          onClick={() => setMaking(true)}
        >
          <Icon name="plus" />
          Subject
        </button>
        <SubjectDialog
          projectId={props.projectId}
          open={making}
          subjects={props.subjects}
          onClose={() => setMaking(false)}
        />
      </div>
      <div className={styles.groups}>
        <PanelBody {...props} />
      </div>
    </section>
  )
}
