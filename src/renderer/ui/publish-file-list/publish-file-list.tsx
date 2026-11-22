// "Files that will be uploaded" in the publish dialog (spec/phases/phase-09.md "Screens"; R-06,
// A-218): by folder, each display name and full local path as plain text, so the user sees
// exactly which files on this computer will leave it. A project file from someone else can
// point an asset at any file, so this list is the user's check. A font without consent given on
// this computer is marked as not uploaded (A-260).
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { displayName, displayPath } from '@/shared/publish/display-text'
import type {
  PublishComponentFolder,
  PublishInspectComponent,
} from '@/shared/schemas/queries/publish'
import styles from './publish-file-list.module.css'

export type PublishFileListProps = { components: PublishInspectComponent[] }

// The order and names of the published folders (the order publish.inspect sorts by).
const FOLDERS: Array<[PublishComponentFolder, string]> = [
  ['logos', 'Logos'],
  ['subjects', 'Subjects'],
  ['fonts', 'Fonts'],
  ['backgrounds', 'Backgrounds'],
  ['images', 'Images'],
]

function mark(c: PublishInspectComponent): string | null {
  if (c.problem === 'missing') return 'file not found, will be skipped'
  if (c.problem === 'wrong_type') return 'not a usable file, will be skipped'
  if (c.kind === 'font' && c.share !== 'confirmed') return 'will not be uploaded'
  return null
}

export function PublishFileList(props: PublishFileListProps) {
  const headingId = useId()
  const groups = FOLDERS.map(([folder, name]) => ({
    name,
    items: props.components.filter((c) => c.folder === folder),
  })).filter((g) => g.items.length > 0)

  return (
    <section aria-labelledby={headingId} className={styles.list}>
      <h3 id={headingId} className={styles.heading}>
        Files that will be uploaded
      </h3>
      {groups.length === 0 && (
        <p className={layout.muted}>No pictures, videos or fonts are used.</p>
      )}
      {groups.map((group) => (
        <div key={group.name} className={styles.group}>
          <p className={styles.folder}>{group.name}</p>
          <ul aria-label={group.name} className={layout.list}>
            {group.items.map((c) => {
              const line = mark(c)
              return (
                <li key={c.assetId} className={styles.item}>
                  <bdi className={styles.name}>{displayName(c.displayName)}</bdi>
                  <span className={`${layout.path} ${styles.path}`}>
                    {displayPath(c.localPath)}
                  </span>
                  {line !== null && <span className={styles.mark}>{line}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
