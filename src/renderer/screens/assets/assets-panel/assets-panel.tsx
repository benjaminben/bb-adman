// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "The panel"): the project's files
// along the left edge, over the page. A sticky head with "Close assets", the import buttons,
// then the groups. Escape inside it closes it; a dialog it opened keeps its own Escape, as the
// Activity panel does. Closing gives the opener the focus back (the scope does that).
import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { AssetRow } from '@/renderer/screens/assets/asset-row'
import { ASSETS_PANEL_ID, useAssetsPanel } from '@/renderer/screens/assets/assets-scope'
import { ImportFiles } from '@/renderer/screens/project-home/import-files'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { assetGroups, type AssetGroup } from './asset-groups'
import { useAssets } from './use-assets'
import styles from './assets-panel.module.css'

export type AssetsPanelProps = { projectId: string; subjects: SubjectRow[] }

type GroupProps = AssetsPanelProps & {
  group: AssetGroup
  onSubject: (assetId: string, subjectId: string | null) => void
}

function Group({ group, projectId, subjects, onSubject }: GroupProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={styles.group}>
      <h3 id={headingId} className={styles.heading}>
        {group.title} · {group.items.length}
      </h3>
      {group.items.length === 0 ? (
        <p className={styles.empty}>{group.empty}</p>
      ) : (
        <ul className={styles.list}>
          {group.items.map((asset) => (
            <AssetRow
              key={asset.id}
              projectId={projectId}
              asset={asset}
              subjects={subjects}
              onSubject={onSubject}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

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
      {assetGroups(read.assets).map((group) => (
        <Group key={group.key} {...props} group={group} onSubject={onSubject} />
      ))}
    </>
  )
}

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
      onKeyDown={onKeyDown}
    >
      <div className={styles.top}>
        <h2 className={styles.title}>Assets</h2>
        <button
          type="button"
          className={`${layout.quiet} ${layout.small} ${styles.close}`}
          onClick={() => panel.hide()}
        >
          <Icon name="x" size="small" />
          Close assets
        </button>
      </div>
      <div className={styles.actions}>
        <ImportFiles projectId={props.projectId} subjects={props.subjects} />
      </div>
      <PanelBody {...props} />
    </section>
  )
}
